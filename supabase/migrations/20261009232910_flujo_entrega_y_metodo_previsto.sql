BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."pedidos"
  DROP CONSTRAINT "pedidos_estado_check";

ALTER TABLE "public"."pedidos"
  ADD COLUMN "metodo_pago_previsto" text;

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
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'pedidos.ver') or not private.tiene_permiso(p_negocio,'pedidos.actualizar_estado') then raise exception 'No tenés permiso para cambiar el estado.' using errcode='42501'; end if;
 select * into actual from public.pedidos where id=p_pedido and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'El pedido no está disponible.' using errcode='PT404'; end if;
 if p_anterior is null or actual.estado<>p_anterior then raise exception 'El pedido cambió. Actualizá antes de continuar.' using errcode='PT409'; end if;
 siguiente:=case actual.estado when 'Pendiente' then 'En preparación' when 'Confirmado' then 'En preparación'
 when 'En preparación' then case when actual.entrega->>'modalidad'='envio' then 'En ruta de entrega' else 'Listo para retirar' end
 when 'Listo para entregar' then case when actual.entrega->>'modalidad'='envio' then 'En ruta de entrega' else null end else null end;
 if p_estado is null or siguiente is null or p_estado<>siguiente then raise exception 'La transición no está permitida. Para entregar, revisá la entrega y el pago.' using errcode='22023'; end if;
 instante:=clock_timestamp();
 update public.pedidos set estado=p_estado,fecha_estado=instante where id=p_pedido;
 insert into public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha) values(p_pedido,actual.estado,p_estado,auth.uid(),instante);
 return jsonb_build_object('id',p_pedido,'estado',p_estado,'fecha_estado',instante);
end; $function$;

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
 if actual.estado not in ('Pendiente','Confirmado','En preparación','Listo para entregar','En ruta de entrega','Listo para retirar') then raise exception 'Este pedido ya no se puede cancelar.' using errcode='22023'; end if;
 if motivo is null or char_length(motivo) not between 1 and 500 then raise exception 'Ingresá un motivo de entre 1 y 500 caracteres.' using errcode='22023'; end if;
 instante:=clock_timestamp();
 update public.pedidos set estado='Cancelado',motivo_cancelacion=motivo,fecha_estado=instante where id=p_pedido;
 insert into public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha) values(p_pedido,actual.estado,'Cancelado',auth.uid(),instante);
 return jsonb_build_object('id',p_pedido,'estado','Cancelado','motivo_cancelacion',motivo,'fecha_estado',instante);
end; $function$;

CREATE OR REPLACE FUNCTION private.confirmar_pedido (
  p_clave    uuid,
  p_negocio  bigint,
  p_contacto jsonb,
  p_items    jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
 v_uid uuid := auth.uid();
 v_cliente uuid;
 v_rol text;
 v_nombre text;
 v_telefono text;
 v_item jsonb;
 v_ids bigint[] := '{}';
 v_producto public.productos%rowtype;
 v_detalles jsonb := '[]';
 v_total numeric := 0;
 v_cantidad integer;
 v_id bigint;
 v_fecha timestamptz;
 v_huella text;
 v_anterior private.solicitudes_pedido%rowtype;
 v_respuesta jsonb;
 v_entrega jsonb;
 v_cotizacion jsonb;
 v_costo numeric:=0;
begin
 if v_uid is not null then
  select rol into v_rol from public.cuentas_acceso where usuario_id=v_uid and habilitada;
  if not found then raise exception 'La cuenta no está habilitada. Volvé a ingresar.' using errcode='42501'; end if;
  if v_rol='cliente' then v_cliente := v_uid; end if;
 end if;
 if p_clave is null or p_negocio is null or p_negocio < 1
 or jsonb_typeof(p_contacto) is distinct from 'object' or octet_length(p_contacto::text)>6000
 or jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text)>30000 then
  raise exception 'La solicitud del pedido no es válida.' using errcode='22023';
 end if;
 if jsonb_array_length(p_items) not between 1 and 100 then
  raise exception 'El pedido debe tener entre 1 y 100 productos diferentes.' using errcode='22023';
 end if;
 v_nombre := btrim(p_contacto->>'nombre', E' \t\n\r');
 v_telefono := regexp_replace(p_contacto->>'telefono','[ ()-]','','g');
 if jsonb_typeof(p_contacto->'nombre') is distinct from 'string'
 or jsonb_typeof(p_contacto->'telefono') is distinct from 'string'
 or char_length(v_nombre) not between 2 and 100
 or v_telefono !~ '^\+?[0-9]{7,15}$' then
  raise exception 'Ingresá tu nombre y un teléfono válido de 7 a 15 dígitos.' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item) is distinct from 'object'
   or coalesce(v_item->>'producto_id','') !~ '^[1-9][0-9]{0,15}$'
   or coalesce(v_item->>'cantidad','') !~ '^[1-9][0-9]{0,2}$'
   or coalesce(v_item->>'precio_centavos','') !~ '^[1-9][0-9]{0,11}$' then
   raise exception 'Revisá los productos, precios y cantidades (máximo 999 unidades).' using errcode='22023';
  end if;
  if (v_item->>'producto_id')::bigint=any(v_ids) then
   raise exception 'El pedido contiene productos repetidos.' using errcode='22023';
  end if;
  v_ids := array_append(v_ids,(v_item->>'producto_id')::bigint);
 end loop;
 -- Mismo intento, mismo contenido y actor. El UUID aleatorio no es un identificador público.
 v_huella := encode(sha256(convert_to(jsonb_build_object('negocio',p_negocio,'usuario',v_uid,
   'nombre',v_nombre,'telefono',v_telefono,'items',p_items)::text,'UTF8')),'hex');
 if p_contacto ? 'entrega' then
 v_huella:=encode(sha256(convert_to(v_huella||(p_contacto->'entrega')::text,'UTF8')),'hex');
 end if;
 if p_contacto ? 'metodo_pago' then v_huella:=encode(sha256(convert_to(v_huella||(p_contacto->'metodo_pago')::text,'UTF8')),'hex'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 select * into v_anterior from private.solicitudes_pedido where clave=p_clave;
 if found then
  if v_anterior.huella<>v_huella then
   raise exception 'Este intento ya fue utilizado con otros datos.' using errcode='22023';
  end if;
  return v_anterior.respuesta;
 end if;
 if coalesce(p_contacto->>'metodo_pago','') not in ('Efectivo','Transferencia') then raise exception 'Elegí efectivo o transferencia.' using errcode='22023'; end if;
 perform 1 from public.emprendimientos where id=p_negocio and activo for share;
 if not found then raise exception 'La tienda ya no está disponible.' using errcode='22023'; end if;
 if p_contacto ? 'entrega' then
  v_entrega:=p_contacto->'entrega';
  if jsonb_typeof(v_entrega) is distinct from 'object' or coalesce(v_entrega->>'modalidad','') not in ('retiro','envio') then
   raise exception 'Elegí retiro o envío a domicilio.' using errcode='22023';
  end if;
 else v_entrega:='{"modalidad":"retiro"}'::jsonb;
 end if;
 if v_entrega->>'modalidad'='envio' then
  if jsonb_typeof(v_entrega->'direccion') is distinct from 'string' or char_length(btrim(v_entrega->>'direccion')) not between 5 and 200
   or coalesce(char_length(v_entrega->>'referencia'),0)>300
   or jsonb_typeof(v_entrega->'latitud') is distinct from 'number' or jsonb_typeof(v_entrega->'longitud') is distinct from 'number'
   or coalesce(v_entrega->>'costo_centavos','') !~ '^[0-9]{1,9}$' then
   raise exception 'Completá la dirección, el punto del mapa y calculá el envío.' using errcode='22023';
  end if;
  perform 1 from public.configuracion_entregas where emprendimiento_id=p_negocio for share;
  v_cotizacion:=public.cotizar_entrega(p_negocio,(v_entrega->>'latitud')::numeric,(v_entrega->>'longitud')::numeric);
  if v_entrega->>'version' is distinct from v_cotizacion->>'version'
   or (v_entrega->>'costo_centavos')::bigint<>(v_cotizacion->>'costo_centavos')::bigint then
   raise exception 'Cambió la configuración o el costo del envío. Calculá de nuevo y revisá el total.' using errcode='22023';
  end if;
  v_costo:=(v_cotizacion->>'costo_centavos')::numeric/100;
  v_entrega:=v_cotizacion||jsonb_build_object('modalidad','envio','direccion',btrim(v_entrega->>'direccion'),
   'referencia',coalesce(v_entrega->>'referencia',''),'latitud',round((v_entrega->>'latitud')::numeric,6),'longitud',round((v_entrega->>'longitud')::numeric,6));
 else
  v_entrega:=jsonb_build_object('modalidad','retiro','costo_centavos',0);
 end if;
 -- Orden fijo de bloqueos; impide que precio/visibilidad cambien durante el guardado.
 perform 1 from public.productos where id=any(v_ids) order by id for share;
 for v_item in select value from jsonb_array_elements(p_items) loop
  select * into v_producto from public.productos
   where id=(v_item->>'producto_id')::bigint and emprendimiento_id=p_negocio and visible;
  if not found then
   raise exception 'Un producto ya no está disponible. Volvé al carrito y actualizá el catálogo.' using errcode='22023';
  end if;
  if v_producto.precio*100<>(v_item->>'precio_centavos')::bigint then
   raise exception 'Cambió el precio de un producto. Volvé al carrito y actualizá el catálogo antes de confirmar.' using errcode='22023';
  end if;
  v_cantidad := (v_item->>'cantidad')::integer;
  v_total := v_total+v_producto.precio*v_cantidad;
  v_detalles := v_detalles||jsonb_build_array(jsonb_build_object('producto_id',v_producto.id,
   'nombre',v_producto.nombre,'precio_centavos',(v_producto.precio*100)::bigint,'cantidad',v_cantidad));
 end loop;
 if v_total+v_costo>999999999999.99 then raise exception 'El importe del pedido supera el límite permitido.' using errcode='22023'; end if;
 insert into public.pedidos(emprendimiento_id,cliente_usuario_id,nombre_contacto,telefono_contacto,subtotal,entrega,costo_envio,metodo_pago_previsto)
 values(p_negocio,v_cliente,v_nombre,v_telefono,v_total,v_entrega,v_costo,p_contacto->>'metodo_pago') returning id,fecha_creacion into v_id,v_fecha;
 insert into public.detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad)
 select v_id,(x->>'producto_id')::bigint,x->>'nombre',(x->>'precio_centavos')::numeric/100,
 (x->>'cantidad')::integer from jsonb_array_elements(v_detalles) x;
 v_respuesta := jsonb_build_object('id',v_id,'estado','Pendiente','fecha',v_fecha,
 'metodo_pago_previsto',p_contacto->>'metodo_pago','subtotal_centavos',(v_total*100)::bigint,'items',v_detalles,'entrega',v_entrega,'costo_envio_centavos',(v_costo*100)::bigint,'total_centavos',((v_total+v_costo)*100)::bigint);
 insert into private.solicitudes_pedido values(p_clave,v_id,v_huella,v_respuesta);
 return v_respuesta;
end;
$function$;

CREATE OR REPLACE FUNCTION private.finalizar_entrega_pedido (
  p_pedido       bigint,
  p_negocio      bigint,
  p_anterior     text,
  p_version_pago integer,
  p_metodo       text,
  p_cobrado      boolean
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actual public.pedidos; instante timestamptz; previo text;
begin
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'pedidos.ver') or not private.tiene_permiso(p_negocio,'pedidos.actualizar_estado') then raise exception 'No tenés permiso para finalizar la entrega.' using errcode='42501'; end if;
 select * into actual from public.pedidos where id=p_pedido and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'El pedido no está disponible.' using errcode='PT404'; end if;
 if p_anterior is null or p_anterior<>actual.estado or p_version_pago is null or p_version_pago<>actual.version_pago then raise exception 'El pedido o su pago cambió. Revisá los datos actuales.' using errcode='PT409'; end if;
 if p_cobrado is null or not (case when actual.entrega->>'modalidad'='envio' then actual.estado='En ruta de entrega' else actual.estado in ('Listo para retirar','Listo para entregar') end) then raise exception 'El pedido no está listo para finalizar la entrega.' using errcode='22023'; end if;
 if actual.estado_pago='Pagado' then
  if p_cobrado or (p_metodo is not null and p_metodo is distinct from actual.metodo_pago) then raise exception 'El pago ya está registrado.' using errcode='22023'; end if;
 elsif p_cobrado or p_metodo is not null then
  perform private.registrar_pago_pedido(p_pedido,p_negocio,p_version_pago,p_metodo,p_cobrado);
 end if;
 instante:=clock_timestamp();
 update public.pedidos set estado='Entregado',fecha_estado=instante where id=p_pedido;
 insert into public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha) values(p_pedido,actual.estado,'Entregado',auth.uid(),instante);
 return jsonb_build_object('id',p_pedido,'estado','Entregado','fecha_estado',instante);
end; $function$;

CREATE OR REPLACE FUNCTION public.finalizar_entrega_pedido (
  p_pedido       bigint,
  p_negocio      bigint,
  p_anterior     text,
  p_version_pago integer,
  p_metodo       text,
  p_cobrado      boolean
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 select private.finalizar_entrega_pedido(p_pedido,p_negocio,p_anterior,p_version_pago,p_metodo,p_cobrado);
$function$;





ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_estado_check"
    CHECK
    ((estado = ANY (ARRAY['Pendiente'::text, 'Confirmado'::text, 'En preparación'::text, 'Listo para entregar'::text, 'En ruta de entrega'::text, 'Listo para retirar'::text,
    'Entregado'::text, 'Cancelado'::text])));

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_metodo_pago_previsto_check" CHECK ((metodo_pago_previsto = ANY (ARRAY['Efectivo'::text, 'Transferencia'::text])));

REVOKE ALL ON FUNCTION "private"."finalizar_entrega_pedido"(bigint, bigint, text, integer, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."finalizar_entrega_pedido"(bigint, bigint, text, integer, text, boolean) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."finalizar_entrega_pedido"(bigint, bigint, text, integer, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."finalizar_entrega_pedido"(bigint, bigint, text, integer, text, boolean) TO "authenticated", "postgres", "service_role";


REVOKE ALL ON FUNCTION private.finalizar_entrega_pedido(bigint,bigint,text,integer,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finalizar_entrega_pedido(bigint,bigint,text,integer,text,boolean) FROM PUBLIC,anon;
COMMIT;
