BEGIN;
SET local check_function_bodies = off;

DROP VIEW "public"."stock_productos";

CREATE TABLE "public"."umbrales_stock" (
  "producto_id"       bigint  NOT NULL,
  "emprendimiento_id" bigint  NOT NULL,
  "minimo"            numeric NOT NULL,
  CONSTRAINT "umbrales_stock_minimo_check" CHECK (((minimo >= (0)::numeric) AND (minimo <= 999999999.999) AND (minimo = round(minimo, 3)))),
  CONSTRAINT "umbrales_stock_pkey" PRIMARY KEY (producto_id)
);

ALTER TABLE "public"."umbrales_stock"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.configurar_umbral_stock (
  p_negocio  bigint,
  p_producto bigint,
  p_minimo   numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'productos.ver') OR NOT private.tiene_permiso(p_negocio,'stock.ver') OR NOT private.tiene_permiso(p_negocio,'stock.registrar') THEN
 RAISE EXCEPTION 'No tenés permiso para configurar el stock mínimo.' USING ERRCODE='42501'; END IF;
 IF p_minimo IS NOT NULL AND (p_minimo<0 OR p_minimo>999999999.999 OR p_minimo<>round(p_minimo,3)) THEN
 RAISE EXCEPTION 'Ingresá un mínimo desde cero y con hasta tres decimales.' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.productos WHERE id=p_producto AND emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible.' USING ERRCODE='PT404'; END IF;
 IF p_minimo IS NULL THEN DELETE FROM public.umbrales_stock WHERE producto_id=p_producto;
 ELSE INSERT INTO public.umbrales_stock(producto_id,emprendimiento_id,minimo) VALUES(p_producto,p_negocio,p_minimo)
 ON CONFLICT(producto_id) DO UPDATE SET minimo=excluded.minimo; END IF;
 RETURN jsonb_build_object('producto_id',p_producto,'umbral_stock',p_minimo);
END; $function$;

CREATE OR REPLACE FUNCTION public.configurar_umbral_stock (
  p_negocio  bigint,
  p_producto bigint,
  p_minimo   numeric
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.configurar_umbral_stock(p_negocio,p_producto,p_minimo); $function$;

ALTER TABLE "public"."umbrales_stock"
  ADD CONSTRAINT "umbrales_stock_producto_id_emprendimiento_id_fkey" FOREIGN KEY (producto_id, emprendimiento_id) REFERENCES public.productos(id, emprendimiento_id)
    ON DELETE CASCADE;

CREATE VIEW "public"."stock_productos" WITH (security_invoker=true) AS  SELECT s.producto_id,
    s.emprendimiento_id,
    s.nombre,
    s.visible,
    s.disponible,
    s.ultimo_movimiento,
    s.es_combo,
    s.disponible_para_venta,
    u.minimo AS umbral_stock,
    COALESCE((s.disponible <= u.minimo), false) AS bajo_umbral,
        CASE
            WHEN (s.disponible = (0)::numeric) THEN 'sin_stock'::text
            WHEN (s.disponible <= u.minimo) THEN 'bajo'::text
            ELSE 'normal'::text
        END AS estado_stock
   FROM (( SELECT p.id AS producto_id,
            p.emprendimiento_id,
            p.nombre,
            p.visible,
                CASE
                    WHEN p.es_combo THEN private.disponibilidad_producto(p.emprendimiento_id, p.id)
                    ELSE COALESCE(sum(m.cantidad), (0)::numeric)
                END AS disponible,
            max(m.fecha) AS ultimo_movimiento,
            p.es_combo,
            private.disponibilidad_producto(p.emprendimiento_id, p.id) AS disponible_para_venta
           FROM (public.productos p
             LEFT JOIN public.movimientos_stock m ON (((m.producto_id = p.id) AND (m.emprendimiento_id = p.emprendimiento_id))))
          WHERE (private.tiene_permiso(p.emprendimiento_id, 'stock.ver'::text) AND private.tiene_permiso(p.emprendimiento_id, 'productos.ver'::text))
          GROUP BY p.id, p.emprendimiento_id, p.nombre, p.visible, p.es_combo) s
     LEFT JOIN public.umbrales_stock u ON (((u.producto_id = s.producto_id) AND (u.emprendimiento_id = s.emprendimiento_id))));

CREATE INDEX umbrales_stock_negocio_idx ON public.umbrales_stock USING btree (emprendimiento_id);

CREATE POLICY "umbrales_lectura" ON "public"."umbrales_stock"
  FOR SELECT
  TO "authenticated"
  USING ((private.tiene_permiso(emprendimiento_id, 'stock.ver'::text) AND private.tiene_permiso(emprendimiento_id, 'productos.ver'::text)));

REVOKE ALL ON FUNCTION "private"."configurar_umbral_stock"(bigint, bigint, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."configurar_umbral_stock"(bigint, bigint, numeric) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."configurar_umbral_stock"(bigint, bigint, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."configurar_umbral_stock"(bigint, bigint, numeric) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."umbrales_stock" FROM "authenticated";

GRANT SELECT ON TABLE "public"."umbrales_stock" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."umbrales_stock" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."stock_productos" FROM "authenticated";

GRANT SELECT ON TABLE "public"."stock_productos" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stock_productos" TO "postgres", "service_role";


REVOKE ALL ON public.umbrales_stock,public.stock_productos FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.configurar_umbral_stock(bigint,bigint,numeric),public.configurar_umbral_stock(bigint,bigint,numeric) FROM PUBLIC,anon;
COMMIT;
