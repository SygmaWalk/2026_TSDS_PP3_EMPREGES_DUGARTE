BEGIN;
SET local check_function_bodies = off;

DROP VIEW "public"."stock_productos";

ALTER TABLE "public"."movimientos_stock"
  DROP CONSTRAINT "movimientos_stock_check";

ALTER TABLE "public"."movimientos_stock"
  DROP CONSTRAINT "movimientos_stock_tipo_check";

CREATE TABLE "public"."componentes_producto" (
  "emprendimiento_id" bigint  NOT NULL,
  "producto_id"       bigint  NOT NULL,
  "componente_id"     bigint  NOT NULL,
  "cantidad"          integer NOT NULL,
  CONSTRAINT "componentes_producto_cantidad_check" CHECK (((cantidad >= 1) AND (cantidad <= 999))),
  CONSTRAINT "componentes_producto_check" CHECK ((producto_id <> componente_id)),
  CONSTRAINT "componentes_producto_pkey" PRIMARY KEY (producto_id, componente_id)
);

ALTER TABLE "public"."componentes_producto"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."consumos_stock_pedido" (
  "pedido_id"         bigint  NOT NULL,
  "emprendimiento_id" bigint  NOT NULL,
  "producto_id"       bigint  NOT NULL,
  "nombre_producto"   text    NOT NULL,
  "cantidad"          numeric NOT NULL,
  "cantidad_devuelta" numeric NOT NULL DEFAULT 0,
  CONSTRAINT "consumos_stock_pedido_cantidad_check" CHECK (((cantidad > (0)::numeric) AND (cantidad <= 999999999.999))),
  CONSTRAINT "consumos_stock_pedido_check" CHECK (((cantidad_devuelta >= (0)::numeric) AND (cantidad_devuelta <= cantidad) AND (cantidad_devuelta = round(cantidad_devuelta, 3)))),
  CONSTRAINT "consumos_stock_pedido_pkey" PRIMARY KEY (pedido_id, producto_id)
);

ALTER TABLE "public"."consumos_stock_pedido"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."movimientos_stock"
  ADD COLUMN "pedido_id" bigint;

ALTER TABLE "public"."pedidos"
  ADD COLUMN "stock_descontado" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."productos"
  ADD COLUMN "es_combo" boolean NOT NULL DEFAULT false;

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
 if actual.stock_descontado then raise exception 'Revisá las cantidades a devolver al cancelar.' using errcode='22023'; end if;
 instante:=clock_timestamp();
 update public.pedidos set estado='Cancelado',motivo_cancelacion=motivo,fecha_estado=instante where id=p_pedido;
 insert into public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha) values(p_pedido,actual.estado,'Cancelado',auth.uid(),instante);
 return jsonb_build_object('id',p_pedido,'estado','Cancelado','motivo_cancelacion',motivo,'fecha_estado',instante);
end; $function$;

CREATE OR REPLACE FUNCTION private.cancelar_pedido_stock (
  p_pedido       bigint,
  p_negocio      bigint,
  p_anterior     text,
  p_motivo       text,
  p_devoluciones jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE actual public.pedidos; c public.consumos_stock_pedido; i jsonb; devolver numeric; resultado jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'pedidos.ver') OR NOT private.tiene_permiso(p_negocio,'pedidos.actualizar_estado') THEN RAISE EXCEPTION 'Sin permiso para cancelar.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_devoluciones) IS DISTINCT FROM 'array' OR jsonb_array_length(p_devoluciones)>100 OR octet_length(p_devoluciones::text)>30000 THEN RAISE EXCEPTION 'Devoluciones inválidas.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||p_negocio::text,0));
 SELECT * INTO actual FROM public.pedidos WHERE id=p_pedido AND emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no disponible.' USING ERRCODE='PT404'; END IF;
 IF p_anterior IS NULL OR actual.estado<>p_anterior THEN RAISE EXCEPTION 'El pedido cambió.' USING ERRCODE='PT409'; END IF;
 IF actual.estado NOT IN ('Pendiente','Confirmado','En preparación','Listo para entregar','En ruta de entrega','Listo para retirar') OR p_motivo IS NULL OR char_length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Revisá estado y motivo.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*)<>count(DISTINCT value->>'producto_id') FROM jsonb_array_elements(p_devoluciones)) THEN RAISE EXCEPTION 'Productos repetidos en devolución.' USING ERRCODE='22023'; END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(p_devoluciones) LOOP
  IF coalesce(i->>'producto_id','')!~'^[1-9][0-9]{0,15}$' OR coalesce(i->>'cantidad','')!~'^[0-9]+(\.[0-9]{1,3})?$' THEN RAISE EXCEPTION 'Cantidad de devolución inválida.' USING ERRCODE='22023'; END IF;
  SELECT * INTO c FROM public.consumos_stock_pedido WHERE pedido_id=p_pedido AND producto_id=(i->>'producto_id')::bigint;
  IF NOT FOUND OR (i->>'cantidad')::numeric>c.cantidad THEN RAISE EXCEPTION 'No se puede devolver más de lo descontado ni productos ajenos al pedido.' USING ERRCODE='22023'; END IF;
 END LOOP;
 PERFORM 1 FROM public.productos WHERE emprendimiento_id=p_negocio ORDER BY id FOR UPDATE;
 FOR c IN SELECT * FROM public.consumos_stock_pedido WHERE pedido_id=p_pedido ORDER BY producto_id LOOP
  SELECT coalesce((SELECT (value->>'cantidad')::numeric FROM jsonb_array_elements(p_devoluciones) WHERE (value->>'producto_id')::bigint=c.producto_id),0) INTO devolver;
  IF devolver>0 THEN
   IF coalesce((SELECT sum(cantidad) FROM public.movimientos_stock WHERE producto_id=c.producto_id),0)+devolver>999999999.999 THEN RAISE EXCEPTION 'La devolución excede el límite de existencias.' USING ERRCODE='22023'; END IF;
   INSERT INTO public.movimientos_stock(emprendimiento_id,producto_id,clave,tipo,cantidad,motivo,referencia,usuario_id,pedido_id) VALUES(p_negocio,c.producto_id,gen_random_uuid(),'Devolución',devolver,btrim(p_motivo),'Cancelación #'||p_pedido::text,auth.uid(),p_pedido);
  END IF;
  UPDATE public.consumos_stock_pedido SET cantidad_devuelta=devolver WHERE pedido_id=p_pedido AND producto_id=c.producto_id;
 END LOOP;
 -- Ejecutar la cancelación histórica validada; el indicador se conserva.
 UPDATE public.pedidos SET estado='Cancelado',motivo_cancelacion=btrim(p_motivo),fecha_estado=clock_timestamp() WHERE id=p_pedido RETURNING * INTO actual;
 INSERT INTO public.historial_estados_pedido(pedido_id,estado_anterior,estado_nuevo,usuario_id,fecha) VALUES(p_pedido,p_anterior,'Cancelado',auth.uid(),actual.fecha_estado);
 RETURN jsonb_build_object('id',p_pedido,'estado','Cancelado','motivo_cancelacion',actual.motivo_cancelacion,'fecha_estado',actual.fecha_estado);
END; $function$;

CREATE OR REPLACE FUNCTION private.catalogo_disponibilidad (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 SELECT coalesce(jsonb_agg(jsonb_build_object('producto_id',p.id,'disponible',least(999,private.disponibilidad_producto(p_negocio,p.id))) ORDER BY p.id),'[]'::jsonb)
 FROM public.productos p JOIN public.emprendimientos e ON e.id=p.emprendimiento_id WHERE p.emprendimiento_id=p_negocio AND p.visible AND e.activo;
$function$;

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
 v_necesidades jsonb; v_stock numeric;
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
 perform pg_advisory_xact_lock(hashtextextended('stock:'||p_negocio::text,0));
 perform 1 from public.productos where emprendimiento_id=p_negocio order by id for update;
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

 select coalesce(jsonb_agg(jsonb_build_object('producto_id',n.producto_id,'cantidad',n.cantidad,'nombre',n.nombre)),'[]'::jsonb) into v_necesidades from private.necesidades_stock(p_negocio,p_items) n;
 if jsonb_array_length(v_necesidades)=0 then raise exception 'No hay componentes disponibles para este pedido.' using errcode='22023'; end if;
 for v_item in select value from jsonb_array_elements(v_necesidades) loop
  select coalesce(sum(cantidad),0) into v_stock from public.movimientos_stock where producto_id=(v_item->>'producto_id')::bigint and emprendimiento_id=p_negocio;
  if (v_item->>'cantidad')::numeric>999999999.999 or v_stock<(v_item->>'cantidad')::numeric then raise exception 'Stock insuficiente de %. Actualizá el catálogo y revisá el pedido.',v_item->>'nombre' using errcode='22023'; end if;
 end loop;

 insert into public.pedidos(emprendimiento_id,cliente_usuario_id,nombre_contacto,telefono_contacto,subtotal,entrega,costo_envio,metodo_pago_previsto)
 values(p_negocio,v_cliente,v_nombre,v_telefono,v_total,v_entrega,v_costo,p_contacto->>'metodo_pago') returning id,fecha_creacion into v_id,v_fecha;
 insert into public.detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad)
 select v_id,(x->>'producto_id')::bigint,x->>'nombre',(x->>'precio_centavos')::numeric/100,
 (x->>'cantidad')::integer from jsonb_array_elements(v_detalles) x;

 insert into public.consumos_stock_pedido(pedido_id,emprendimiento_id,producto_id,nombre_producto,cantidad)
 select v_id,p_negocio,(x->>'producto_id')::bigint,x->>'nombre',(x->>'cantidad')::numeric from jsonb_array_elements(v_necesidades) x;
 insert into public.movimientos_stock(emprendimiento_id,producto_id,clave,tipo,cantidad,motivo,referencia,usuario_id,pedido_id)
 select p_negocio,(x->>'producto_id')::bigint,gen_random_uuid(),'Venta',-(x->>'cantidad')::numeric,'Pedido #'||v_id::text,'Pedido #'||v_id::text,auth.uid(),v_id from jsonb_array_elements(v_necesidades) x;
 update public.pedidos set stock_descontado=true where id=v_id;

 v_respuesta := jsonb_build_object('id',v_id,'estado','Pendiente','fecha',v_fecha,
 'metodo_pago_previsto',p_contacto->>'metodo_pago','subtotal_centavos',(v_total*100)::bigint,'items',v_detalles,'entrega',v_entrega,'costo_envio_centavos',(v_costo*100)::bigint,'total_centavos',((v_total+v_costo)*100)::bigint);
 insert into private.solicitudes_pedido values(p_clave,v_id,v_huella,v_respuesta);
 return v_respuesta;
end;
$function$;

CREATE OR REPLACE FUNCTION private.disponibilidad_producto (
  p_negocio  bigint,
  p_producto bigint
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 SELECT coalesce(greatest(0,floor(min(coalesce(s.stock,0)/n.cantidad))),0)
 FROM private.necesidades_stock(p_negocio,jsonb_build_array(jsonb_build_object('producto_id',p_producto,'cantidad',1))) n
 LEFT JOIN (SELECT producto_id,sum(cantidad) stock FROM public.movimientos_stock WHERE emprendimiento_id=p_negocio GROUP BY producto_id) s ON s.producto_id=n.producto_id;
$function$;

CREATE OR REPLACE FUNCTION private.guardar_producto_compuesto (
  p_negocio     bigint,
  p_producto    bigint,
  p_nombre      text,
  p_descripcion text,
  p_precio      numeric,
  p_imagen      text,
  p_combo       boolean,
  p_componentes jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE actual public.productos; i jsonb; repetidos integer; invalidos boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'productos.ver') OR NOT private.tiene_permiso(p_negocio,CASE WHEN p_producto IS NULL THEN 'productos.crear' ELSE 'productos.editar' END) THEN RAISE EXCEPTION 'No tenés permiso para guardar productos.' USING ERRCODE='42501'; END IF;
 IF p_combo IS NULL OR jsonb_typeof(p_componentes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_componentes)>50 OR (p_combo AND jsonb_array_length(p_componentes)=0) THEN RAISE EXCEPTION 'Un combo requiere componentes válidos.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||p_negocio::text,0));
 IF p_producto IS NULL THEN
  INSERT INTO public.productos(emprendimiento_id,nombre,descripcion,precio,imagen_path,es_combo,visible) VALUES(p_negocio,p_nombre,p_descripcion,p_precio,p_imagen,p_combo,false) RETURNING * INTO actual;
 ELSE
  SELECT * INTO actual FROM public.productos WHERE id=p_producto AND emprendimiento_id=p_negocio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible.' USING ERRCODE='PT404'; END IF;
  IF NOT actual.es_combo AND p_combo AND coalesce((SELECT sum(cantidad) FROM public.movimientos_stock WHERE producto_id=p_producto),0)<>0 THEN RAISE EXCEPTION 'Antes de convertirlo en combo, ajustá sus existencias propias a cero.' USING ERRCODE='22023'; END IF;
  UPDATE public.productos SET nombre=p_nombre,descripcion=p_descripcion,precio=p_precio,imagen_path=p_imagen,es_combo=p_combo WHERE id=p_producto RETURNING * INTO actual;
 END IF;
 DELETE FROM public.componentes_producto WHERE producto_id=actual.id;
 FOR i IN SELECT value FROM jsonb_array_elements(p_componentes) LOOP
  IF coalesce(i->>'componente_id','')!~'^[1-9][0-9]{0,15}$' OR coalesce(i->>'cantidad','')!~'^[1-9][0-9]{0,2}$' THEN RAISE EXCEPTION 'Revisá los componentes y sus cantidades.' USING ERRCODE='22023'; END IF;
  IF (i->>'componente_id')::bigint=actual.id OR NOT EXISTS(SELECT 1 FROM public.productos WHERE id=(i->>'componente_id')::bigint AND emprendimiento_id=p_negocio) THEN RAISE EXCEPTION 'El componente debe pertenecer al mismo negocio y ser otro producto.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.componentes_producto VALUES(p_negocio,actual.id,(i->>'componente_id')::bigint,(i->>'cantidad')::integer);
 END LOOP;
 WITH RECURSIVE rutas AS(
  SELECT producto_id raiz,componente_id id,ARRAY[producto_id,componente_id] camino,producto_id=componente_id ciclo FROM public.componentes_producto WHERE emprendimiento_id=p_negocio
  UNION ALL SELECT r.raiz,c.componente_id,r.camino||c.componente_id,c.componente_id=ANY(r.camino) FROM rutas r JOIN public.componentes_producto c ON c.producto_id=r.id AND c.emprendimiento_id=p_negocio WHERE NOT r.ciclo AND cardinality(r.camino)<=8
 ) SELECT coalesce(bool_or(ciclo OR cardinality(camino)>8),false) INTO invalidos FROM rutas;
 IF invalidos THEN RAISE EXCEPTION 'La composición tiene un ciclo o demasiados niveles (máximo 8).' USING ERRCODE='22023'; END IF;
 RETURN to_jsonb(actual)||jsonb_build_object('componentes_producto',p_componentes);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Revisá nombres o componentes repetidos.' USING ERRCODE='23505';
END; $function$;

CREATE OR REPLACE FUNCTION private.necesidades_stock (
  p_negocio bigint,
  p_items   jsonb
)
  RETURNS TABLE (
    producto_id bigint,
    cantidad    numeric,
    nombre      text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 WITH RECURSIVE arbol AS(
 SELECT (i->>'producto_id')::bigint id,(i->>'cantidad')::numeric cantidad,ARRAY[(i->>'producto_id')::bigint] ruta
 FROM jsonb_array_elements(p_items) i
 UNION ALL SELECT c.componente_id,a.cantidad*c.cantidad,a.ruta||c.componente_id FROM arbol a
 JOIN public.componentes_producto c ON c.producto_id=a.id AND c.emprendimiento_id=p_negocio
 WHERE cardinality(a.ruta)<8 AND NOT c.componente_id=ANY(a.ruta)
 ) SELECT p.id,sum(a.cantidad),p.nombre FROM arbol a JOIN public.productos p ON p.id=a.id AND p.emprendimiento_id=p_negocio
 WHERE NOT p.es_combo GROUP BY p.id,p.nombre;
$function$;

CREATE OR REPLACE FUNCTION private.proteger_tipo_producto()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN IF current_user='authenticated' AND (TG_OP='INSERT' AND NEW.es_combo OR TG_OP='UPDATE' AND NEW.es_combo IS DISTINCT FROM OLD.es_combo) THEN RAISE EXCEPTION 'Guardá la composición desde el formulario del producto.' USING ERRCODE='42501'; END IF; RETURN NEW; END; $function$;

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
 IF EXISTS(SELECT 1 FROM public.productos WHERE id=p_producto AND es_combo) THEN RAISE EXCEPTION 'El stock del combo depende de sus componentes.' USING ERRCODE='22023'; END IF;
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

CREATE OR REPLACE FUNCTION public.cancelar_pedido_stock (
  p_pedido       bigint,
  p_negocio      bigint,
  p_anterior     text,
  p_motivo       text,
  p_devoluciones jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.cancelar_pedido_stock(p_pedido,p_negocio,p_anterior,p_motivo,p_devoluciones); $function$;

CREATE OR REPLACE FUNCTION public.catalogo_disponibilidad (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.catalogo_disponibilidad(p_negocio); $function$;

CREATE OR REPLACE FUNCTION public.guardar_producto_compuesto (
  p_negocio     bigint,
  p_producto    bigint,
  p_nombre      text,
  p_descripcion text,
  p_precio      numeric,
  p_imagen      text,
  p_combo       boolean,
  p_componentes jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.guardar_producto_compuesto(p_negocio,p_producto,p_nombre,p_descripcion,p_precio,p_imagen,p_combo,p_componentes); $function$;

ALTER TABLE "public"."componentes_producto"
  ADD CONSTRAINT "componentes_hijo_fk" FOREIGN KEY (componente_id, emprendimiento_id) REFERENCES public.productos(id, emprendimiento_id);

ALTER TABLE "public"."componentes_producto"
  ADD CONSTRAINT "componentes_padre_fk" FOREIGN KEY (producto_id, emprendimiento_id) REFERENCES public.productos(id, emprendimiento_id);

ALTER TABLE "public"."consumos_stock_pedido"
  ADD CONSTRAINT "consumos_stock_pedido_producto_id_emprendimiento_id_fkey" FOREIGN KEY (producto_id, emprendimiento_id) REFERENCES public.productos(id, emprendimiento_id);

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_check1" CHECK (((tipo = ANY (ARRAY['Venta'::text, 'Devolución'::text])) = (pedido_id IS NOT NULL)));

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_check"
    CHECK
    ((((tipo = ANY (ARRAY['Ajuste negativo'::text, 'Venta'::text])) AND (cantidad < (0)::numeric)) OR ((tipo <> ALL (ARRAY['Ajuste negativo'::text, 'Venta'::text])) AND (cantidad >
    (0)::numeric))));

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;

ALTER TABLE "public"."movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_tipo_check"
    CHECK ((tipo = ANY (ARRAY['Entrada'::text, 'Producción'::text, 'Ajuste positivo'::text, 'Ajuste negativo'::text, 'Venta'::text, 'Devolución'::text])));

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_id_negocio_key" UNIQUE (id, emprendimiento_id);

ALTER TABLE "public"."consumos_stock_pedido"
  ADD CONSTRAINT "consumos_stock_pedido_pedido_id_emprendimiento_id_fkey" FOREIGN KEY (pedido_id, emprendimiento_id) REFERENCES public.pedidos(id, emprendimiento_id)
    ON DELETE CASCADE;

CREATE VIEW "public"."stock_productos" WITH (security_invoker=true) AS  SELECT p.id AS producto_id,
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
  GROUP BY p.id, p.emprendimiento_id, p.nombre, p.visible, p.es_combo;

CREATE INDEX componentes_negocio_idx ON public.componentes_producto USING btree (emprendimiento_id, componente_id);

CREATE INDEX consumos_negocio_idx ON public.consumos_stock_pedido USING btree (emprendimiento_id, producto_id);

CREATE UNIQUE INDEX movimientos_pedido_unico_idx ON public.movimientos_stock USING btree (pedido_id, producto_id, tipo)
  WHERE (pedido_id IS NOT NULL);

CREATE TRIGGER proteger_tipo_producto
  BEFORE INSERT OR UPDATE OF es_combo ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION private.proteger_tipo_producto();

CREATE POLICY "componentes_lectura" ON "public"."componentes_producto"
  FOR SELECT
  TO "authenticated"
  USING (private.tiene_permiso(emprendimiento_id, 'productos.ver'::text));

CREATE POLICY "consumos_lectura" ON "public"."consumos_stock_pedido"
  FOR SELECT
  TO "authenticated"
  USING (private.tiene_permiso(emprendimiento_id, 'pedidos.ver'::text));

REVOKE ALL ON FUNCTION "private"."cancelar_pedido_stock"(bigint, bigint, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."cancelar_pedido_stock"(bigint, bigint, text, text, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."catalogo_disponibilidad"(bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."catalogo_disponibilidad"(bigint) TO "anon", "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."disponibilidad_producto"(bigint, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."disponibilidad_producto"(bigint, bigint) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."guardar_producto_compuesto"(bigint, bigint, text, text, numeric, text, boolean, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guardar_producto_compuesto"(bigint, bigint, text, text, numeric, text, boolean, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."necesidades_stock"(bigint, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."necesidades_stock"(bigint, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."proteger_tipo_producto"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."proteger_tipo_producto"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."cancelar_pedido_stock"(bigint, bigint, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."cancelar_pedido_stock"(bigint, bigint, text, text, jsonb) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."catalogo_disponibilidad"(bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."catalogo_disponibilidad"(bigint) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."guardar_producto_compuesto"(bigint, bigint, text, text, numeric, text, boolean, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."guardar_producto_compuesto"(bigint, bigint, text, text, numeric, text, boolean, jsonb) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."componentes_producto" FROM "authenticated";

GRANT SELECT ON TABLE "public"."componentes_producto" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."componentes_producto" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."consumos_stock_pedido" FROM "authenticated";

GRANT SELECT ON TABLE "public"."consumos_stock_pedido" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consumos_stock_pedido" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."stock_productos" FROM "authenticated";

GRANT SELECT ON TABLE "public"."stock_productos" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stock_productos" TO "postgres", "service_role";


REVOKE ALL ON public.componentes_producto,public.consumos_stock_pedido,public.stock_productos FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.proteger_tipo_producto() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancelar_pedido_stock(bigint,bigint,text,text,jsonb),public.guardar_producto_compuesto(bigint,bigint,text,text,numeric,text,boolean,jsonb) FROM anon;
COMMIT;
