begin;
alter table public.permisos_miembro drop constraint permisos_miembro_permiso_check;
alter table public.permisos_miembro add constraint permisos_miembro_permiso_check check (
 permiso in ('productos.ver','productos.crear','productos.editar','productos.publicar','pedidos.ver','entregas.configurar'));

create function private.franjas_validas(p_franjas jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare f jsonb; anterior integer:=0; limite integer;
begin
 if jsonb_typeof(p_franjas) is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_franjas) not between 1 and 20 then return false; end if;
 for f in select value from jsonb_array_elements(p_franjas) loop
  if jsonb_typeof(f->'hasta_m') is distinct from 'number'
   or coalesce(f->>'hasta_m','') !~ '^[1-9][0-9]{0,5}$'
   or jsonb_typeof(f->'tarifa_centavos') is distinct from 'number'
   or coalesce(f->>'tarifa_centavos','') !~ '^[0-9]{1,9}$' then return false; end if;
  limite := (f->>'hasta_m')::integer;
  if limite<=anterior or limite>100000 then return false; end if;
  anterior:=limite;
 end loop;
 return true;
end;
$$;
revoke all on function private.franjas_validas(jsonb) from public;
grant execute on function private.franjas_validas(jsonb) to authenticated,service_role;
create table public.configuracion_entregas(
 emprendimiento_id bigint primary key references public.emprendimientos(id) on delete cascade,
 direccion_origen text not null check(char_length(btrim(direccion_origen)) between 5 and 200),
 latitud numeric(9,6) not null check(latitud between -90 and 90),
 longitud numeric(10,6) not null check(longitud between -180 and 180),
 franjas jsonb not null check(private.franjas_validas(franjas)),
 version uuid not null default gen_random_uuid(),
 fecha_modificacion timestamptz not null default statement_timestamp()
);
alter table public.configuracion_entregas enable row level security;
revoke all on public.configuracion_entregas from public,anon,authenticated;
grant select on public.configuracion_entregas to anon,authenticated;
grant insert,update on public.configuracion_entregas to authenticated;
grant all on public.configuracion_entregas to service_role;
create policy entregas_lectura_publica on public.configuracion_entregas for select to anon,authenticated
 using(exists(select 1 from public.emprendimientos e where e.id=emprendimiento_id and e.activo));
create policy entregas_lectura_interna on public.configuracion_entregas for select to authenticated
 using(private.tiene_permiso(emprendimiento_id,'entregas.configurar'));
create policy entregas_alta on public.configuracion_entregas for insert to authenticated
 with check(private.tiene_permiso(emprendimiento_id,'entregas.configurar'));
create policy entregas_edicion on public.configuracion_entregas for update to authenticated
 using(private.tiene_permiso(emprendimiento_id,'entregas.configurar'))
 with check(private.tiene_permiso(emprendimiento_id,'entregas.configurar'));
create function private.preparar_entregas() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.emprendimiento_id<>old.emprendimiento_id then
  raise exception 'No se puede trasladar la configuración.' using errcode='22023';
 end if;
 new.direccion_origen:=btrim(new.direccion_origen);
 new.version:=gen_random_uuid();
 new.fecha_modificacion:=statement_timestamp();
 return new;
end;$$;
revoke all on function private.preparar_entregas() from public,anon,authenticated;
create trigger preparar_entregas before insert or update on public.configuracion_entregas for each row execute function private.preparar_entregas();

-- Coordenadas WGS84 con seis decimales. Distancia esférica radial Haversine,
-- radio medio terrestre 6371008.8 m. Comparación de bordes sobre metros a 2 decimales.
create function public.cotizar_entrega(p_negocio bigint,p_lat numeric,p_lng numeric) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare c public.configuracion_entregas%rowtype; d numeric; f jsonb; previo integer:=0; numero integer:=0; a double precision;
begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then
  raise exception 'Seleccioná un punto válido en el mapa.' using errcode='22023'; end if;
 p_lat:=round(p_lat,6);p_lng:=round(p_lng,6);
 select ce.* into c from public.configuracion_entregas ce join public.emprendimientos e on e.id=ce.emprendimiento_id where ce.emprendimiento_id=p_negocio and e.activo;
 if not found then raise exception 'El emprendimiento todavía no configuró sus entregas. Elegí retiro o consultá al negocio.' using errcode='22023'; end if;
 a:=power(sin(radians((p_lat-c.latitud)::double precision)/2),2)
  +cos(radians(c.latitud::double precision))*cos(radians(p_lat::double precision))*power(sin(radians((p_lng-c.longitud)::double precision)/2),2);
 d:=round((6371008.8*2*asin(sqrt(least(1,greatest(0,a)))))::numeric,2);
 for f in select value from jsonb_array_elements(c.franjas) loop
  numero:=numero+1;
  if d<=(f->>'hasta_m')::integer then
   return jsonb_build_object('distancia_m',d,'costo_centavos',(f->>'tarifa_centavos')::bigint,
    'franja','Franja '||numero,'desde_m',previo,'hasta_m',(f->>'hasta_m')::integer,'version',c.version,
    'origen',jsonb_build_object('direccion',c.direccion_origen,'latitud',c.latitud,'longitud',c.longitud));
  end if;
  previo:=(f->>'hasta_m')::integer;
 end loop;
 raise exception 'El punto está fuera de la cobertura. Contactá al emprendimiento o elegí retiro.' using errcode='22023';
end;$$;
revoke all on function public.cotizar_entrega(bigint,numeric,numeric) from public;
grant execute on function public.cotizar_entrega(bigint,numeric,numeric) to anon,authenticated,service_role;
alter table public.pedidos add column entrega jsonb check(entrega is null or jsonb_typeof(entrega)='object');
alter table public.pedidos add column costo_envio numeric(12,2) not null default 0 check(costo_envio>=0 and costo_envio<>'NaN'::numeric);
alter table public.pedidos add column total numeric(14,2) generated always as(subtotal+costo_envio) stored;
create or replace function private.confirmar_pedido(p_clave uuid,p_negocio bigint,p_contacto jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 select * into v_anterior from private.solicitudes_pedido where clave=p_clave;
 if found then
  if v_anterior.huella<>v_huella then
   raise exception 'Este intento ya fue utilizado con otros datos.' using errcode='22023';
  end if;
  return v_anterior.respuesta;
 end if;
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
 insert into public.pedidos(emprendimiento_id,cliente_usuario_id,nombre_contacto,telefono_contacto,subtotal,entrega,costo_envio)
 values(p_negocio,v_cliente,v_nombre,v_telefono,v_total,v_entrega,v_costo) returning id,fecha_creacion into v_id,v_fecha;
 insert into public.detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad)
 select v_id,(x->>'producto_id')::bigint,x->>'nombre',(x->>'precio_centavos')::numeric/100,
 (x->>'cantidad')::integer from jsonb_array_elements(v_detalles) x;
 v_respuesta := jsonb_build_object('id',v_id,'estado','Pendiente','fecha',v_fecha,
 'subtotal_centavos',(v_total*100)::bigint,'items',v_detalles,'entrega',v_entrega,'costo_envio_centavos',(v_costo*100)::bigint,'total_centavos',((v_total+v_costo)*100)::bigint);
 insert into private.solicitudes_pedido values(p_clave,v_id,v_huella,v_respuesta);
 return v_respuesta;
end;
$$;
commit;
