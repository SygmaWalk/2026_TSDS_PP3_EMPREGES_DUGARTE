BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."permisos_miembro"
  DROP CONSTRAINT "permisos_miembro_permiso_check";

ALTER TABLE "public"."pedidos"
  ADD COLUMN "estado_pago" text NOT NULL DEFAULT 'Pendiente'::text;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "metodo_pago" text;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "fecha_pago" timestamp WITH time zone;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "usuario_pago" uuid;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "version_pago" integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.registrar_pago_pedido (
  p_pedido  bigint,
  p_negocio bigint,
  p_version integer,
  p_metodo  text,
  p_pagado  boolean
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actual public.pedidos;
begin
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'pedidos.ver') or not private.tiene_permiso(p_negocio,'pedidos.registrar_pago') then
  raise exception 'No tenés permiso para registrar pagos.' using errcode='42501';
 end if;
 select * into actual from public.pedidos where id=p_pedido and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'El pedido no está disponible.' using errcode='PT404'; end if;
 if p_version is null or actual.version_pago<>p_version then raise exception 'El pago cambió. Revisá su estado actual.' using errcode='PT409'; end if;
 if actual.estado='Cancelado' or actual.estado_pago='Pagado' then raise exception 'No se puede modificar el pago de este pedido.' using errcode='22023'; end if;
 if p_metodo is null or p_metodo not in ('Efectivo','Transferencia') or p_pagado is null then raise exception 'Revisá el método y el estado del pago.' using errcode='22023'; end if;
 update public.pedidos set metodo_pago=p_metodo,estado_pago=case when p_pagado then 'Pagado' else 'Pendiente' end,
 fecha_pago=case when p_pagado then clock_timestamp() else null end,
 usuario_pago=case when p_pagado then auth.uid() else null end,version_pago=version_pago+1
 where id=p_pedido returning * into actual;
 return jsonb_build_object('id',actual.id,'estado_pago',actual.estado_pago,'metodo_pago',actual.metodo_pago,'fecha_pago',actual.fecha_pago,'version_pago',actual.version_pago);
end; $function$;



CREATE OR REPLACE FUNCTION public.registrar_pago_pedido (
  p_pedido  bigint,
  p_negocio bigint,
  p_version integer,
  p_metodo  text,
  p_pagado  boolean
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 select private.registrar_pago_pedido(p_pedido,p_negocio,p_version,p_metodo,p_pagado);
$function$;



ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_pago_check"
    CHECK
    (((estado_pago = ANY (ARRAY['Pendiente'::text, 'Pagado'::text])) AND ((metodo_pago IS NULL) OR (metodo_pago = ANY (ARRAY['Efectivo'::text, 'Transferencia'::text]))) AND
    (version_pago >= 0) AND (((estado_pago = 'Pendiente'::text) AND (fecha_pago IS NULL) AND (usuario_pago IS NULL)) OR ((estado_pago = 'Pagado'::text) AND (metodo_pago IS
    NOT NULL) AND (fecha_pago IS NOT NULL)))));

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_usuario_pago_fkey" FOREIGN KEY (usuario_pago) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."permisos_miembro"
  ADD CONSTRAINT "permisos_miembro_permiso_check"
    CHECK
    ((permiso = ANY (ARRAY['productos.ver'::text, 'productos.crear'::text, 'productos.editar'::text, 'productos.publicar'::text, 'pedidos.ver'::text,
    'pedidos.actualizar_estado'::text, 'pedidos.registrar_pago'::text, 'entregas.configurar'::text])));

REVOKE ALL ON FUNCTION "private"."registrar_pago_pedido"(bigint, bigint, integer, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."registrar_pago_pedido"(bigint, bigint, integer, text, boolean) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."registrar_pago_pedido"(bigint, bigint, integer, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."registrar_pago_pedido"(bigint, bigint, integer, text, boolean) TO "authenticated", "postgres", "service_role";


REVOKE ALL ON FUNCTION private.registrar_pago_pedido(bigint,bigint,integer,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.registrar_pago_pedido(bigint,bigint,integer,text,boolean) FROM PUBLIC,anon;
COMMIT;
