BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."pedidos"
  DROP CONSTRAINT "pedidos_estado_check";

ALTER TABLE "public"."pedidos"
  ADD COLUMN "motivo_cancelacion" text;

CREATE OR REPLACE FUNCTION private.cancelar_pedido (
  p_pedido   bigint,
  p_negocio  bigint,
  p_anterior text,
  p_motivo   text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actual public.pedidos; instante timestamptz; motivo text:=btrim(p_motivo,E' \t\n\r');
begin
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'pedidos.ver') or not private.tiene_permiso(p_negocio,'pedidos.actualizar_estado') then
  raise exception 'No tenés permiso para cancelar este pedido.' using errcode='42501';
 end if;
 select * into actual from public.pedidos where id=p_pedido and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'El pedido no está disponible.' using errcode='PT404'; end if;
 if p_anterior is null or actual.estado<>p_anterior then raise exception 'El pedido cambió. Revisá su estado actual.' using errcode='PT409'; end if;
 if actual.estado not in ('Pendiente','Confirmado','En preparación','Listo para entregar') then raise exception 'Este pedido ya no se puede cancelar.' using errcode='22023'; end if;
 if motivo is null or char_length(motivo) not between 1 and 500 then raise exception 'Ingresá un motivo de entre 1 y 500 caracteres.' using errcode='22023'; end if;
 instante:=clock_timestamp();
 update public.pedidos set estado='Cancelado',motivo_cancelacion=motivo,fecha_estado=instante where id=p_pedido;
 insert into public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha) values(p_pedido,actual.estado,'Cancelado',auth.uid(),instante);
 return jsonb_build_object('id',p_pedido,'estado','Cancelado','motivo_cancelacion',motivo,'fecha_estado',instante);
end; $function$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido (
  p_pedido   bigint,
  p_negocio  bigint,
  p_anterior text,
  p_motivo   text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 select private.cancelar_pedido(p_pedido,p_negocio,p_anterior,p_motivo);
$function$;





ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_cancelacion_check" CHECK ((((estado = 'Cancelado'::text) AND (motivo_cancelacion IS
    NOT NULL) AND ((char_length(btrim(motivo_cancelacion)) >= 1) AND (char_length(btrim(motivo_cancelacion)) <= 500))) OR
    ((estado <> 'Cancelado'::text) AND (motivo_cancelacion IS NULL))));

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_estado_check"
    CHECK ((estado = ANY (ARRAY['Pendiente'::text, 'Confirmado'::text, 'En preparación'::text, 'Listo para entregar'::text, 'Entregado'::text, 'Cancelado'::text])));

REVOKE ALL ON FUNCTION "private"."cancelar_pedido"(bigint, bigint, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."cancelar_pedido"(bigint, bigint, text, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."cancelar_pedido"(bigint, bigint, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."cancelar_pedido"(bigint, bigint, text, text) TO "authenticated", "postgres", "service_role";


REVOKE ALL ON FUNCTION private.cancelar_pedido(bigint,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancelar_pedido(bigint,bigint,text,text) FROM PUBLIC,anon;
COMMIT;
