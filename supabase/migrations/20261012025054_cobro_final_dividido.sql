BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."pedidos"
  DROP CONSTRAINT "pedidos_pago_check";

ALTER TABLE "public"."pedidos"
  ADD COLUMN "pago_efectivo" numeric NOT NULL DEFAULT 0;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "pago_transferencia" numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.finalizar_entrega_dividida (
  p_pedido        bigint,
  p_negocio       bigint,
  p_anterior      text,
  p_version_pago  integer,
  p_efectivo      numeric,
  p_transferencia numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE entrega jsonb; pago jsonb;
BEGIN
 -- El RPC existente valida permiso, estado y versión y mantiene el bloqueo.
 -- Si el cobro falla, toda la transacción (incluida la entrega) se revierte.
 entrega:=private.finalizar_entrega_pedido(p_pedido,p_negocio,p_anterior,p_version_pago,NULL,false);
 pago:=private.registrar_pago_dividido(p_pedido,p_negocio,p_version_pago,p_efectivo,p_transferencia);
 RETURN entrega || pago;
END; $function$;

CREATE OR REPLACE FUNCTION private.registrar_pago_dividido (
  p_pedido        bigint,
  p_negocio       bigint,
  p_version       integer,
  p_efectivo      numeric,
  p_transferencia numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE actual public.pedidos;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'pedidos.ver') OR NOT private.tiene_permiso(p_negocio,'pedidos.registrar_pago') THEN RAISE EXCEPTION 'No tenés permiso para registrar pagos.' USING ERRCODE='42501'; END IF;
 SELECT * INTO actual FROM public.pedidos WHERE id=p_pedido AND emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no disponible.' USING ERRCODE='PT404'; END IF;
 IF p_version IS NULL OR actual.version_pago<>p_version THEN RAISE EXCEPTION 'El pago cambió.' USING ERRCODE='PT409'; END IF;
 IF actual.estado='Cancelado' OR actual.estado_pago='Pagado' THEN RAISE EXCEPTION 'El pedido no admite cobros.' USING ERRCODE='22023'; END IF;
 IF p_efectivo IS NULL OR p_transferencia IS NULL OR p_efectivo<0 OR p_transferencia<0
 OR p_efectivo>actual.total OR p_transferencia>actual.total
 OR p_efectivo<>round(p_efectivo,2) OR p_transferencia<>round(p_transferencia,2)
 OR p_efectivo+p_transferencia<>actual.total THEN RAISE EXCEPTION 'Los importes deben sumar el total del pedido, con hasta dos decimales.' USING ERRCODE='22023'; END IF;
 UPDATE public.pedidos SET pago_efectivo=p_efectivo,pago_transferencia=p_transferencia,
 metodo_pago=CASE WHEN p_transferencia=0 THEN 'Efectivo' WHEN p_efectivo=0 THEN 'Transferencia' ELSE 'Mixto' END,
 estado_pago='Pagado',fecha_pago=clock_timestamp(),usuario_pago=auth.uid(),version_pago=version_pago+1 WHERE id=p_pedido RETURNING * INTO actual;
 RETURN jsonb_build_object('id',actual.id,'estado_pago',actual.estado_pago,'metodo_pago',actual.metodo_pago,'pago_efectivo',actual.pago_efectivo,'pago_transferencia',actual.pago_transferencia,'fecha_pago',actual.fecha_pago,'version_pago',actual.version_pago);
END; $function$;

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
DECLARE actual public.pedidos;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'pedidos.ver') OR NOT private.tiene_permiso(p_negocio,'pedidos.registrar_pago') THEN RAISE EXCEPTION 'No tenés permiso para registrar pagos.' USING ERRCODE='42501'; END IF;
 SELECT * INTO actual FROM public.pedidos WHERE id=p_pedido AND emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El pedido no está disponible.' USING ERRCODE='PT404'; END IF;
 IF p_version IS NULL OR actual.version_pago<>p_version THEN RAISE EXCEPTION 'El pago cambió.' USING ERRCODE='PT409'; END IF;
 IF actual.estado='Cancelado' OR actual.estado_pago='Pagado' THEN RAISE EXCEPTION 'No se puede modificar el pago.' USING ERRCODE='22023'; END IF;
 IF p_metodo IS NULL OR p_metodo NOT IN ('Efectivo','Transferencia') OR p_pagado IS NULL THEN RAISE EXCEPTION 'Método inválido.' USING ERRCODE='22023'; END IF;
 IF p_pagado THEN
   RETURN private.registrar_pago_dividido(p_pedido,p_negocio,p_version,CASE WHEN p_metodo='Efectivo' THEN actual.total ELSE 0 END,CASE WHEN p_metodo='Transferencia' THEN actual.total ELSE 0 END);
 END IF;
 UPDATE public.pedidos SET metodo_pago=p_metodo,version_pago=version_pago+1 WHERE id=p_pedido RETURNING * INTO actual;
 RETURN jsonb_build_object('id',actual.id,'estado_pago',actual.estado_pago,'metodo_pago',actual.metodo_pago,'fecha_pago',actual.fecha_pago,'version_pago',actual.version_pago);
END; $function$;

CREATE OR REPLACE FUNCTION public.finalizar_entrega_dividida (
  p_pedido        bigint,
  p_negocio       bigint,
  p_anterior      text,
  p_version_pago  integer,
  p_efectivo      numeric,
  p_transferencia numeric
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.finalizar_entrega_dividida(p_pedido,p_negocio,p_anterior,p_version_pago,p_efectivo,p_transferencia); $function$;

CREATE OR REPLACE FUNCTION public.registrar_pago_dividido (
  p_pedido        bigint,
  p_negocio       bigint,
  p_version       integer,
  p_efectivo      numeric,
  p_transferencia numeric
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.registrar_pago_dividido(p_pedido,p_negocio,p_version,p_efectivo,p_transferencia); $function$;

UPDATE public.pedidos SET pago_efectivo=CASE WHEN metodo_pago='Efectivo' THEN total ELSE 0 END, pago_transferencia=CASE WHEN metodo_pago='Transferencia' THEN total ELSE 0 END WHERE estado_pago='Pagado';

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_desglose_pago_check"
    CHECK
    (((pago_efectivo >= (0)::numeric) AND (pago_transferencia >= (0)::numeric) AND (pago_efectivo <= 999999999999.99) AND (pago_transferencia <= 999999999999.99) AND (pago_efectivo
    = round(pago_efectivo, 2)) AND (pago_transferencia = round(pago_transferencia, 2)) AND
    (((estado_pago = 'Pendiente'::text) AND (pago_efectivo = (0)::numeric) AND (pago_transferencia = (0)::numeric)) OR ((estado_pago = 'Pagado'::text) AND ((pago_efectivo +
    pago_transferencia) = total) AND
    (((metodo_pago = 'Efectivo'::text) AND (pago_transferencia = (0)::numeric)) OR ((metodo_pago = 'Transferencia'::text) AND (pago_efectivo = (0)::numeric)) OR ((metodo_pago =
    'Mixto'::text) AND (pago_efectivo > (0)::numeric) AND (pago_transferencia > (0)::numeric)))))));

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_pago_check"
    CHECK
    (((estado_pago = ANY (ARRAY['Pendiente'::text, 'Pagado'::text])) AND ((metodo_pago IS NULL) OR (metodo_pago = ANY (ARRAY['Efectivo'::text, 'Transferencia'::text,
    'Mixto'::text]))) AND (version_pago >= 0) AND
    (((estado_pago = 'Pendiente'::text) AND (fecha_pago IS NULL) AND (usuario_pago IS NULL) AND (metodo_pago IS DISTINCT FROM 'Mixto'::text)) OR ((estado_pago = 'Pagado'::text) AND
    (metodo_pago IS NOT NULL) AND (fecha_pago IS NOT NULL)))));

REVOKE ALL ON FUNCTION "private"."finalizar_entrega_dividida"(bigint, bigint, text, integer, numeric, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."finalizar_entrega_dividida"(bigint, bigint, text, integer, numeric, numeric) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."registrar_pago_dividido"(bigint, bigint, integer, numeric, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."registrar_pago_dividido"(bigint, bigint, integer, numeric, numeric) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."finalizar_entrega_dividida"(bigint, bigint, text, integer, numeric, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."finalizar_entrega_dividida"(bigint, bigint, text, integer, numeric, numeric) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."registrar_pago_dividido"(bigint, bigint, integer, numeric, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."registrar_pago_dividido"(bigint, bigint, integer, numeric, numeric) TO "authenticated", "postgres", "service_role";


REVOKE ALL ON FUNCTION private.registrar_pago_dividido(bigint,bigint,integer,numeric,numeric),public.registrar_pago_dividido(bigint,bigint,integer,numeric,numeric),private.finalizar_entrega_dividida(bigint,bigint,text,integer,numeric,numeric),public.finalizar_entrega_dividida(bigint,bigint,text,integer,numeric,numeric) FROM PUBLIC,anon;
COMMIT;
