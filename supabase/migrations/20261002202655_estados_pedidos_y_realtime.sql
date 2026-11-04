BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."pedidos"
  DROP CONSTRAINT "pedidos_estado_check";

ALTER TABLE "public"."permisos_miembro"
  DROP CONSTRAINT "permisos_miembro_permiso_check";

CREATE TABLE "public"."historial_estados_pedido" (
  "id"              bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "pedido_id"       bigint                   NOT NULL,
  "estado_anterior" text                     NOT NULL,
  "estado_nuevo"    text                     NOT NULL,
  "usuario_id"      uuid,
  "fecha"           timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "historial_estados_pedido_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."historial_estados_pedido"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "fecha_estado" timestamp WITH time zone;

-- Los pedidos existentes conservan la fecha de su estado inicial.
UPDATE public.pedidos SET fecha_estado=fecha_creacion;
ALTER TABLE public.pedidos ALTER COLUMN fecha_estado SET DEFAULT statement_timestamp();
ALTER TABLE public.pedidos ALTER COLUMN fecha_estado SET NOT NULL;

CREATE OR REPLACE FUNCTION private.cambiar_estado_pedido (
  p_pedido   bigint,
  p_negocio  bigint,
  p_anterior text,
  p_estado   text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actual public.pedidos; siguiente text; instante timestamptz;
begin
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'pedidos.ver') or not private.tiene_permiso(p_negocio,'pedidos.actualizar_estado') then
  raise exception 'No tenés permiso para cambiar el estado.' using errcode='42501';
 end if;
 select * into actual from public.pedidos where id=p_pedido and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'El pedido no está disponible.' using errcode='P0002'; end if;
 if p_anterior is null or actual.estado<>p_anterior then
  raise exception 'El pedido cambió. Actualizá antes de continuar.' using errcode='PT409';
 end if;
 siguiente:=case actual.estado when 'Pendiente' then 'Confirmado' when 'Confirmado' then 'En preparación' when 'En preparación' then 'Listo para entregar' when 'Listo para entregar' then 'Entregado' else null end;
 if p_estado is null or siguiente is null or p_estado<>siguiente then
  raise exception 'La transición de estado no está permitida.' using errcode='22023';
 end if;
 instante:=clock_timestamp();
 update public.pedidos set estado=p_estado,fecha_estado=instante where id=p_pedido;
 insert into public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha)
 values(p_pedido,actual.estado,p_estado,auth.uid(),instante);
 return jsonb_build_object('id',p_pedido,'estado',p_estado,'fecha_estado',instante);
end; $function$;

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido (
  p_pedido   bigint,
  p_negocio  bigint,
  p_anterior text,
  p_estado   text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 select private.cambiar_estado_pedido(p_pedido,p_negocio,p_anterior,p_estado);
$function$;



ALTER TABLE "public"."historial_estados_pedido"
  ADD CONSTRAINT "historial_estados_pedido_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;

ALTER TABLE "public"."historial_estados_pedido"
  ADD CONSTRAINT "historial_estados_pedido_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_estado_check"
    CHECK ((estado = ANY (ARRAY['Pendiente'::text, 'Confirmado'::text, 'En preparación'::text, 'Listo para entregar'::text, 'Entregado'::text])));

ALTER TABLE "public"."permisos_miembro"
  ADD CONSTRAINT "permisos_miembro_permiso_check"
    CHECK
    ((permiso = ANY (ARRAY['productos.ver'::text, 'productos.crear'::text, 'productos.editar'::text, 'productos.publicar'::text, 'pedidos.ver'::text,
    'pedidos.actualizar_estado'::text, 'entregas.configurar'::text])));

CREATE INDEX historial_estados_pedido_fecha_idx ON public.historial_estados_pedido USING btree (pedido_id, fecha, id);

CREATE POLICY "historial_pedido_lectura" ON "public"."historial_estados_pedido"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.pedidos p
  WHERE (p.id = historial_estados_pedido.pedido_id))));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."pedidos";

REVOKE ALL ON FUNCTION "private"."cambiar_estado_pedido"(bigint, bigint, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."cambiar_estado_pedido"(bigint, bigint, text, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."cambiar_estado_pedido"(bigint, bigint, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."cambiar_estado_pedido"(bigint, bigint, text, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."historial_estados_pedido" FROM "authenticated";

GRANT SELECT ON TABLE "public"."historial_estados_pedido" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."historial_estados_pedido" TO "postgres", "service_role";


-- ACL explícitas para instalaciones con privilegios predeterminados distintos.
REVOKE ALL ON public.historial_estados_pedido FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.historial_estados_pedido TO authenticated;
REVOKE ALL ON SEQUENCE public.historial_estados_pedido_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.historial_estados_pedido_id_seq TO service_role;
REVOKE ALL ON FUNCTION private.cambiar_estado_pedido(bigint,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cambiar_estado_pedido(bigint,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.cambiar_estado_pedido(bigint,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(bigint,bigint,text,text) TO authenticated;
COMMIT;
