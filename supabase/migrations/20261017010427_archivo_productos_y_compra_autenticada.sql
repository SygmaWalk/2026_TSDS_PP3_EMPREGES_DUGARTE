SET local check_function_bodies = off;

ALTER TABLE "public"."productos"
  ADD COLUMN "archivado" boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.catalogo_configurable (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'tienda.configurar') THEN RAISE EXCEPTION 'No tenés permiso para configurar esta tienda.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'visible',visible) ORDER BY id),'[]'::jsonb) FROM public.productos WHERE emprendimiento_id=p_negocio AND NOT archivado);
END; $function$;

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
 if v_uid is null then raise exception 'Iniciá sesión con tu cuenta de cliente para confirmar el pedido.' using errcode='42501'; end if;
 if v_uid is not null then
  select rol into v_rol from public.cuentas_acceso where usuario_id=v_uid and habilitada;
  if not found then raise exception 'La cuenta no está habilitada. Volvé a ingresar.' using errcode='42501'; end if;
  if v_rol<>'cliente' then raise exception 'Usá una cuenta de cliente para confirmar pedidos.' using errcode='42501'; end if;
  v_cliente := v_uid;
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
  IF NOT FOUND OR actual.archivado THEN RAISE EXCEPTION 'Producto no disponible.' USING ERRCODE='PT404'; END IF;
  IF NOT actual.es_combo AND p_combo AND coalesce((SELECT sum(cantidad) FROM public.movimientos_stock WHERE producto_id=p_producto),0)<>0 THEN RAISE EXCEPTION 'Antes de convertirlo en combo, ajustá sus existencias propias a cero.' USING ERRCODE='22023'; END IF;
  UPDATE public.productos SET nombre=p_nombre,descripcion=p_descripcion,precio=p_precio,imagen_path=p_imagen,es_combo=p_combo WHERE id=p_producto RETURNING * INTO actual;
 END IF;
 DELETE FROM public.componentes_producto WHERE producto_id=actual.id;
 FOR i IN SELECT value FROM jsonb_array_elements(p_componentes) LOOP
  IF coalesce(i->>'componente_id','')!~'^[1-9][0-9]{0,15}$' OR coalesce(i->>'cantidad','')!~'^[1-9][0-9]{0,2}$' THEN RAISE EXCEPTION 'Revisá los componentes y sus cantidades.' USING ERRCODE='22023'; END IF;
  IF (i->>'componente_id')::bigint=actual.id OR NOT EXISTS(SELECT 1 FROM public.productos WHERE id=(i->>'componente_id')::bigint AND emprendimiento_id=p_negocio AND NOT archivado) THEN RAISE EXCEPTION 'El componente debe pertenecer al mismo negocio y ser otro producto.' USING ERRCODE='22023'; END IF;
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

CREATE OR REPLACE FUNCTION private.proteger_archivo_producto()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
 IF current_user IN ('authenticated','anon') AND
 (TG_OP='INSERT' AND NEW.archivado OR TG_OP='UPDATE' AND NEW.archivado IS DISTINCT FROM OLD.archivado)
 THEN RAISE EXCEPTION 'Usá la acción de archivar o restaurar.' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND OLD.archivado AND NEW.archivado THEN
 RAISE EXCEPTION 'Restaurá el producto antes de modificarlo.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION private.retirar_producto (
  p_negocio  bigint,
  p_producto bigint,
  p_accion   text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE producto public.productos; usados jsonb; historial boolean; propuesta text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'productos.ver')
 OR NOT private.tiene_permiso(p_negocio,'productos.editar') OR NOT private.tiene_permiso(p_negocio,'productos.publicar')
 THEN RAISE EXCEPTION 'Necesitás permisos para editar y publicar productos.' USING ERRCODE='42501'; END IF;
 IF p_accion IS NULL OR p_accion NOT IN ('consultar','eliminar','archivar','restaurar') THEN
 RAISE EXCEPTION 'Acción inválida.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||p_negocio::text,0));
 SELECT * INTO producto FROM public.productos WHERE id=p_producto AND emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El producto ya no está disponible.' USING ERRCODE='PT404'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) ORDER BY p.id),'[]'::jsonb) INTO usados
 FROM public.componentes_producto c JOIN public.productos p ON p.id=c.producto_id
 WHERE c.componente_id=p_producto;
 historial:=EXISTS(SELECT 1 FROM public.detalles_pedido WHERE producto_id=p_producto)
 OR EXISTS(SELECT 1 FROM public.movimientos_stock WHERE producto_id=p_producto)
 OR EXISTS(SELECT 1 FROM public.consumos_stock_pedido WHERE producto_id=p_producto);
 propuesta:=CASE WHEN producto.archivado THEN 'restaurar' WHEN historial THEN 'archivar' ELSE 'eliminar' END;
 IF p_accion='consultar' THEN RETURN jsonb_build_object('accion',propuesta,'dependencias',usados,'nombre',producto.nombre); END IF;
 IF p_accion<>propuesta THEN RAISE EXCEPTION 'El producto cambió. Volvé a revisar la acción antes de confirmar.' USING ERRCODE='PT409'; END IF;
 IF p_accion<>'restaurar' AND jsonb_array_length(usados)>0 THEN
 RAISE EXCEPTION 'El producto es componente de otro producto o combo. Quitá primero esa asociación.' USING ERRCODE='22023'; END IF;
 IF p_accion='eliminar' THEN
 DELETE FROM public.componentes_producto WHERE producto_id=p_producto;
 DELETE FROM public.productos WHERE id=p_producto;
 ELSE
 UPDATE public.productos SET archivado=(p_accion='archivar'),visible=false WHERE id=p_producto;
 END IF;
 RETURN jsonb_build_object('accion',p_accion,'id',p_producto);
END; $function$;

CREATE OR REPLACE FUNCTION public.preparar_registro_catalogo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
    new.nombre := btrim(new.nombre, E' \t\n\r\f\013');
    if tg_op = 'INSERT' then
        new.fecha_creacion := statement_timestamp();
    else
        new.fecha_creacion := old.fecha_creacion;
    end if;
    new.fecha_modificacion := statement_timestamp();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retirar_producto (
  p_negocio  bigint,
  p_producto bigint,
  p_accion   text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 SELECT private.retirar_producto(p_negocio,p_producto,p_accion);
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."productos"
  ADD CONSTRAINT "productos_archivados_ocultos" CHECK (((NOT archivado) OR (NOT visible)));

CREATE TRIGGER productos_proteger_archivo
  BEFORE INSERT OR UPDATE ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION private.proteger_archivo_producto();

REVOKE ALL ON FUNCTION "private"."proteger_archivo_producto"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."proteger_archivo_producto"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."retirar_producto"(bigint, bigint, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."retirar_producto"(bigint, bigint, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."retirar_producto"(bigint, bigint, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."retirar_producto"(bigint, bigint, text) TO "authenticated", "postgres", "service_role";


REVOKE ALL ON FUNCTION public.retirar_producto(bigint,bigint,text) FROM anon;
