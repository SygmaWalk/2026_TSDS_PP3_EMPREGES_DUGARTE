BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."permisos_miembro"
  DROP CONSTRAINT "permisos_miembro_permiso_check";

CREATE TABLE "public"."clientes_comerciales" (
  "id"                  bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "emprendimiento_id"   bigint                   NOT NULL,
  "nombre"              text                     NOT NULL,
  "telefono"            text                     NOT NULL,
  "direccion"           text                     NOT NULL DEFAULT ''::text,
  "referencia"          text                     NOT NULL DEFAULT ''::text,
  "fecha_creacion"      timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  "fecha_actualizacion" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  "version"             integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "clientes_comerciales_direccion_check" CHECK ((char_length(direccion) <= 200)),
  CONSTRAINT "clientes_comerciales_id_emprendimiento_id_key" UNIQUE (id, emprendimiento_id),
  CONSTRAINT "clientes_comerciales_nombre_check" CHECK (((char_length(btrim(nombre)) >= 2) AND (char_length(btrim(nombre)) <= 100))),
  CONSTRAINT "clientes_comerciales_pkey" PRIMARY KEY (id),
  CONSTRAINT "clientes_comerciales_referencia_check" CHECK ((char_length(referencia) <= 300)),
  CONSTRAINT "clientes_comerciales_version_check" CHECK ((version >= 0))
);

ALTER TABLE "public"."clientes_comerciales"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "cliente_comercial_id" bigint;

CREATE OR REPLACE FUNCTION private.editar_cliente_comercial (
  p_cliente    bigint,
  p_negocio    bigint,
  p_version    integer,
  p_nombre     text,
  p_telefono   text,
  p_direccion  text,
  p_referencia text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actual public.clientes_comerciales;
begin
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'clientes.ver') or not private.tiene_permiso(p_negocio,'clientes.editar') then
 raise exception 'No tenés permiso para editar clientes.' using errcode='42501'; end if;
 select * into actual from public.clientes_comerciales where id=p_cliente and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'La ficha no está disponible.' using errcode='PT404'; end if;
 if p_version is null or actual.version<>p_version then raise exception 'La ficha cambió. Revisá los datos actuales.' using errcode='PT409'; end if;
 if p_nombre is null or char_length(btrim(p_nombre)) not between 2 and 100
 or private.normalizar_telefono_cliente(p_telefono) is null or char_length(private.normalizar_telefono_cliente(p_telefono)) not between 7 and 15
 or char_length(coalesce(p_direccion,''))>200 or char_length(coalesce(p_referencia,''))>300 then
 raise exception 'Revisá nombre, teléfono y dirección.' using errcode='22023'; end if;
 update public.clientes_comerciales set nombre=btrim(p_nombre),telefono=btrim(p_telefono),direccion=btrim(coalesce(p_direccion,'')),referencia=btrim(coalesce(p_referencia,'')),
 fecha_actualizacion=clock_timestamp(),version=version+1 where id=p_cliente returning * into actual;
 return to_jsonb(actual);
exception when unique_violation then
 raise exception 'Ese teléfono ya pertenece a otra ficha del emprendimiento.' using errcode='PT422';
end; $function$;

CREATE OR REPLACE FUNCTION private.normalizar_telefono_cliente (
  valor text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
 select case when btrim(valor) ~ '^\+?[0-9 ()-]{7,30}$' then nullif(regexp_replace(valor,'[^0-9]','','g'),'') else null end;
$function$;

CREATE OR REPLACE FUNCTION private.vincular_cliente_pedido()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 insert into public.clientes_comerciales(emprendimiento_id,nombre,telefono,direccion,referencia)
 values(new.emprendimiento_id,new.nombre_contacto,new.telefono_contacto,coalesce(new.entrega->>'direccion',''),coalesce(new.entrega->>'referencia',''))
 on conflict (emprendimiento_id,telefono_normalizado) do update set telefono=public.clientes_comerciales.telefono
 returning id into new.cliente_comercial_id;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.editar_cliente_comercial (
  p_cliente    bigint,
  p_negocio    bigint,
  p_version    integer,
  p_nombre     text,
  p_telefono   text,
  p_direccion  text,
  p_referencia text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 select private.editar_cliente_comercial(p_cliente,p_negocio,p_version,p_nombre,p_telefono,p_direccion,p_referencia);
$function$;





ALTER TABLE "public"."clientes_comerciales"
  ADD CONSTRAINT "clientes_comerciales_emprendimiento_id_fkey" FOREIGN KEY (emprendimiento_id) REFERENCES public.emprendimientos(id) ON DELETE CASCADE;

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_cliente_comercial_fk" FOREIGN KEY (cliente_comercial_id, emprendimiento_id) REFERENCES public.clientes_comerciales(id, emprendimiento_id);

ALTER TABLE "public"."permisos_miembro"
  ADD CONSTRAINT "permisos_miembro_permiso_check"
    CHECK
    ((permiso = ANY (ARRAY['productos.ver'::text, 'productos.crear'::text, 'productos.editar'::text, 'productos.publicar'::text, 'pedidos.ver'::text,
    'pedidos.actualizar_estado'::text, 'pedidos.registrar_pago'::text, 'entregas.configurar'::text, 'clientes.ver'::text, 'clientes.editar'::text])));

CREATE INDEX pedidos_cliente_comercial_idx ON public.pedidos USING btree (cliente_comercial_id, emprendimiento_id);

CREATE TRIGGER vincular_cliente_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION private.vincular_cliente_pedido();

CREATE POLICY "clientes_comerciales_lectura" ON "public"."clientes_comerciales"
  FOR SELECT
  TO "authenticated"
  USING (private.tiene_permiso(emprendimiento_id, 'clientes.ver'::text));

REVOKE ALL ON FUNCTION "private"."editar_cliente_comercial"(bigint, bigint, integer, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."editar_cliente_comercial"(bigint, bigint, integer, text, text, text, text) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "private"."normalizar_telefono_cliente"(text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."vincular_cliente_pedido"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."vincular_cliente_pedido"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."editar_cliente_comercial"(bigint, bigint, integer, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."editar_cliente_comercial"(bigint, bigint, integer, text, text, text, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."clientes_comerciales" FROM "authenticated";

GRANT SELECT ON TABLE "public"."clientes_comerciales" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes_comerciales" TO "postgres", "service_role";

ALTER TABLE "public"."clientes_comerciales"
  ADD COLUMN "telefono_normalizado" text GENERATED ALWAYS AS (private.normalizar_telefono_cliente(telefono)) STORED NOT NULL;

ALTER TABLE "public"."clientes_comerciales"
  ADD CONSTRAINT "clientes_comerciales_emprendimiento_id_telefono_normalizado_key" UNIQUE (emprendimiento_id, telefono_normalizado);

ALTER TABLE "public"."clientes_comerciales"
  ADD CONSTRAINT "clientes_comerciales_telefono_normalizado_check" CHECK (((char_length(telefono_normalizado) >= 7) AND (char_length(telefono_normalizado) <= 15)));


-- Vincular pedidos anteriores sin modificar sus copias históricas de contacto y entrega.
INSERT INTO public.clientes_comerciales(emprendimiento_id,nombre,telefono,direccion,referencia)
 SELECT DISTINCT ON (emprendimiento_id,private.normalizar_telefono_cliente(telefono_contacto))
 emprendimiento_id,nombre_contacto,telefono_contacto,coalesce(entrega->>'direccion',''),coalesce(entrega->>'referencia','')
 FROM public.pedidos
 WHERE char_length(private.normalizar_telefono_cliente(telefono_contacto)) BETWEEN 7 AND 15
 ORDER BY emprendimiento_id,private.normalizar_telefono_cliente(telefono_contacto),fecha_creacion DESC,id DESC;
UPDATE public.pedidos p SET cliente_comercial_id=c.id FROM public.clientes_comerciales c
 WHERE c.emprendimiento_id=p.emprendimiento_id AND c.telefono_normalizado=private.normalizar_telefono_cliente(p.telefono_contacto);

REVOKE ALL ON public.clientes_comerciales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.clientes_comerciales TO authenticated;
REVOKE ALL ON SEQUENCE public.clientes_comerciales_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.clientes_comerciales_id_seq TO service_role;
REVOKE ALL ON FUNCTION private.vincular_cliente_pedido() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.editar_cliente_comercial(bigint,bigint,integer,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.editar_cliente_comercial(bigint,bigint,integer,text,text,text,text) FROM PUBLIC,anon;
COMMIT;
