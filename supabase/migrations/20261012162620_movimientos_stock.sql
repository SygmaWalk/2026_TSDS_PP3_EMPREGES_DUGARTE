BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."permisos_miembro"
  DROP CONSTRAINT "permisos_miembro_permiso_check";

CREATE TABLE "public"."movimientos_stock" (
  "id"                bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "emprendimiento_id" bigint                   NOT NULL,
  "producto_id"       bigint                   NOT NULL,
  "clave"             uuid                     NOT NULL,
  "tipo"              text                     NOT NULL,
  "cantidad"          numeric                  NOT NULL,
  "motivo"            text                     NOT NULL,
  "referencia"        text                     NOT NULL DEFAULT ''::text,
  "fecha"             timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  "usuario_id"        uuid,
  CONSTRAINT "movimientos_stock_cantidad_check" CHECK (((cantidad <> (0)::numeric) AND (abs(cantidad) <= 999999999.999) AND (cantidad = round(cantidad, 3)))),
  CONSTRAINT "movimientos_stock_check"
    CHECK ((((tipo = 'Ajuste negativo'::text) AND (cantidad < (0)::numeric)) OR ((tipo <> 'Ajuste negativo'::text) AND (cantidad > (0)::numeric)))),
  CONSTRAINT "movimientos_stock_emprendimiento_id_clave_key" UNIQUE (emprendimiento_id, clave),
  CONSTRAINT "movimientos_stock_motivo_check" CHECK (((char_length(btrim(motivo)) >= 2) AND (char_length(btrim(motivo)) <= 300))),
  CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY (id),
  CONSTRAINT "movimientos_stock_referencia_check" CHECK ((char_length(referencia) <= 100)),
  CONSTRAINT "movimientos_stock_tipo_check" CHECK ((tipo = ANY (ARRAY['Entrada'::text, 'Producción'::text, 'Ajuste positivo'::text, 'Ajuste negativo'::text])))
);

ALTER TABLE "public"."movimientos_stock"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.registrar_movimiento_stock (
  p_negocio        bigint,
  p_producto       bigint,
  p_clave          uuid,
  p_tipo           text,
  p_cantidad       numeric,
  p_motivo         text,
  p_referencia     text,
  p_saldo_esperado numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE previo public.movimientos_stock; movimiento public.movimientos_stock; saldo numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'productos.ver') OR NOT private.tiene_permiso(p_negocio,'stock.ver') OR NOT private.tiene_permiso(p_negocio,'stock.registrar') THEN RAISE EXCEPTION 'No tenés permiso para registrar stock.' USING ERRCODE='42501'; END IF;
 IF p_clave IS NULL OR p_tipo IS NULL OR p_tipo NOT IN ('Entrada','Producción','Ajuste positivo','Ajuste negativo')
 OR p_cantidad IS NULL OR p_cantidad<=0 OR p_cantidad>999999999.999 OR p_cantidad<>round(p_cantidad,3)
 OR p_saldo_esperado IS NULL OR p_saldo_esperado<0 OR p_saldo_esperado>999999999.999
 OR p_motivo IS NULL OR char_length(btrim(p_motivo)) NOT BETWEEN 2 AND 300
 OR p_referencia IS NULL OR char_length(btrim(p_referencia))>100 THEN RAISE EXCEPTION 'Revisá cantidad, motivo y referencia.' USING ERRCODE='22023'; END IF;
 -- Serializar todos los movimientos de un producto. ND2026-33 utilizará el mismo bloqueo.
 PERFORM 1 FROM public.productos WHERE id=p_producto AND emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El producto no está disponible.' USING ERRCODE='PT404'; END IF;
 SELECT * INTO previo FROM public.movimientos_stock WHERE emprendimiento_id=p_negocio AND clave=p_clave;
 IF FOUND THEN
  IF previo.producto_id<>p_producto OR previo.tipo<>p_tipo OR abs(previo.cantidad)<>p_cantidad OR previo.motivo<>btrim(p_motivo) OR previo.referencia<>btrim(p_referencia) THEN RAISE EXCEPTION 'El intento ya fue utilizado con otros datos.' USING ERRCODE='PT409'; END IF;
  SELECT coalesce(sum(cantidad),0) INTO saldo FROM public.movimientos_stock WHERE producto_id=p_producto AND emprendimiento_id=p_negocio;
  RETURN jsonb_build_object('id',previo.id,'disponible',saldo,'reutilizado',true);
 END IF;
 SELECT coalesce(sum(cantidad),0) INTO saldo FROM public.movimientos_stock WHERE producto_id=p_producto AND emprendimiento_id=p_negocio;
 IF saldo<>p_saldo_esperado THEN RAISE EXCEPTION 'El stock cambió. Actualizá las existencias antes de registrar.' USING ERRCODE='PT409'; END IF;
 saldo:=saldo+CASE WHEN p_tipo='Ajuste negativo' THEN -p_cantidad ELSE p_cantidad END;
 IF saldo<0 OR saldo>999999999.999 THEN RAISE EXCEPTION 'El ajuste dejaría existencias inválidas.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.movimientos_stock(emprendimiento_id,producto_id,clave,tipo,cantidad,motivo,referencia,usuario_id)
 VALUES(p_negocio,p_producto,p_clave,p_tipo,CASE WHEN p_tipo='Ajuste negativo' THEN -p_cantidad ELSE p_cantidad END,btrim(p_motivo),btrim(p_referencia),auth.uid()) RETURNING * INTO movimiento;
 RETURN jsonb_build_object('id',movimiento.id,'disponible',saldo,'reutilizado',false);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'El intento ya fue utilizado. Actualizá el stock.' USING ERRCODE='PT409';
END; $function$;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_stock (
  p_negocio        bigint,
  p_producto       bigint,
  p_clave          uuid,
  p_tipo           text,
  p_cantidad       numeric,
  p_motivo         text,
  p_referencia     text,
  p_saldo_esperado numeric
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.registrar_movimiento_stock(p_negocio,p_producto,p_clave,p_tipo,p_cantidad,p_motivo,p_referencia,p_saldo_esperado); $function$;

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_emprendimiento_id_fkey" FOREIGN KEY (emprendimiento_id) REFERENCES public.emprendimientos(id);

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."permisos_miembro"
  ADD CONSTRAINT "permisos_miembro_permiso_check"
    CHECK
    ((permiso = ANY (ARRAY['productos.ver'::text, 'productos.crear'::text, 'productos.editar'::text, 'productos.publicar'::text, 'pedidos.ver'::text,
    'pedidos.actualizar_estado'::text,
    'pedidos.registrar_pago'::text, 'entregas.configurar'::text, 'clientes.ver'::text, 'clientes.editar'::text, 'stock.ver'::text, 'stock.registrar'::text])));

ALTER TABLE "public"."productos"
  ADD CONSTRAINT "productos_id_negocio_key" UNIQUE (id, emprendimiento_id);

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_producto_id_emprendimiento_id_fkey" FOREIGN KEY (producto_id, emprendimiento_id) REFERENCES public.productos(id, emprendimiento_id);

CREATE VIEW "public"."stock_productos" WITH (security_invoker=true) AS  SELECT p.id AS producto_id,
    p.emprendimiento_id,
    p.nombre,
    p.visible,
    COALESCE(sum(m.cantidad), (0)::numeric) AS disponible,
    max(m.fecha) AS ultimo_movimiento
   FROM (public.productos p
     LEFT JOIN public.movimientos_stock m ON (((m.producto_id = p.id) AND (m.emprendimiento_id = p.emprendimiento_id))))
  WHERE (private.tiene_permiso(p.emprendimiento_id, 'stock.ver'::text) AND private.tiene_permiso(p.emprendimiento_id, 'productos.ver'::text))
  GROUP BY p.id, p.emprendimiento_id, p.nombre, p.visible;

CREATE INDEX movimientos_stock_producto_fecha_idx ON public.movimientos_stock USING btree (emprendimiento_id, producto_id, fecha DESC, id DESC);

CREATE POLICY "movimientos_stock_lectura" ON "public"."movimientos_stock"
  FOR SELECT
  TO "authenticated"
  USING ((private.tiene_permiso(emprendimiento_id, 'stock.ver'::text) AND private.tiene_permiso(emprendimiento_id, 'productos.ver'::text)));

REVOKE ALL ON FUNCTION "private"."registrar_movimiento_stock"(bigint, bigint, uuid, text, numeric, text, text, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."registrar_movimiento_stock"(bigint, bigint, uuid, text, numeric, text, text, numeric) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."registrar_movimiento_stock"(bigint, bigint, uuid, text, numeric, text, text, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."registrar_movimiento_stock"(bigint, bigint, uuid, text, numeric, text, text, numeric) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."movimientos_stock" FROM "authenticated";

GRANT SELECT ON TABLE "public"."movimientos_stock" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos_stock" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."stock_productos" FROM "authenticated";

GRANT SELECT ON TABLE "public"."stock_productos" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stock_productos" TO "postgres", "service_role";


REVOKE ALL ON public.movimientos_stock,public.stock_productos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.movimientos_stock,public.stock_productos TO authenticated;
REVOKE ALL ON SEQUENCE public.movimientos_stock_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.movimientos_stock_id_seq TO service_role;
REVOKE ALL ON FUNCTION private.registrar_movimiento_stock(bigint,bigint,uuid,text,numeric,text,text,numeric),public.registrar_movimiento_stock(bigint,bigint,uuid,text,numeric,text,text,numeric) FROM PUBLIC,anon;
COMMIT;
