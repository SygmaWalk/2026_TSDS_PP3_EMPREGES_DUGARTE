begin;
create table public.pedidos (
 id bigint generated always as identity primary key,
 emprendimiento_id bigint not null references public.emprendimientos(id) on delete restrict,
 cliente_usuario_id uuid references auth.users(id) on delete set null,
 nombre_contacto text not null check(char_length(nombre_contacto) between 2 and 100),
 telefono_contacto text not null check(telefono_contacto ~ '^\+?[0-9]{7,15}$'),
 subtotal numeric(14,2) not null check(subtotal > 0 and subtotal <> 'NaN'::numeric),
 estado text not null default 'Pendiente' check(estado in ('Pendiente')),
 fecha_creacion timestamptz not null default statement_timestamp()
);
create index pedidos_negocio_fecha_idx on public.pedidos(emprendimiento_id,fecha_creacion desc);
create index pedidos_cliente_idx on public.pedidos(cliente_usuario_id) where cliente_usuario_id is not null;
create table public.detalles_pedido (
 pedido_id bigint not null references public.pedidos(id) on delete cascade,
 producto_id bigint not null references public.productos(id) on delete restrict,
 nombre_producto text not null,
 precio_unitario numeric(12,2) not null check(precio_unitario > 0 and precio_unitario <> 'NaN'::numeric),
 cantidad integer not null check(cantidad between 1 and 999),
 primary key(pedido_id,producto_id)
);
create index detalles_pedido_producto_idx on public.detalles_pedido(producto_id);
create table private.solicitudes_pedido (
 clave uuid primary key,
 pedido_id bigint not null unique references public.pedidos(id) on delete cascade,
 huella text not null,
 respuesta jsonb not null
);
alter table public.pedidos enable row level security;
alter table public.detalles_pedido enable row level security;
alter table private.solicitudes_pedido enable row level security;
revoke all on public.pedidos,public.detalles_pedido,private.solicitudes_pedido from public,anon,authenticated;
revoke all on sequence public.pedidos_id_seq from public,anon,authenticated;
grant all on public.pedidos,public.detalles_pedido,private.solicitudes_pedido to service_role;
grant usage,select on sequence public.pedidos_id_seq to service_role;
-- La lectura operativa con permisos individuales se incorpora con el panel de pedidos.
grant select on public.pedidos,public.detalles_pedido to authenticated;
create policy pedidos_lectura_admin on public.pedidos for select to authenticated using((select private.es_administrador()));
create policy detalles_lectura_admin on public.detalles_pedido for select to authenticated using((select private.es_administrador()));

-- Única operación de escritura pública: entrada acotada y validada, transacción indivisible.
-- auth.uid() nulo permite explícitamente la compra invitada. Con sesión, la cuenta se
-- valida en BD y solo el rol Cliente se asocia al pedido; nunca se acepta un usuario enviado.
create function private.confirmar_pedido(p_clave uuid,p_negocio bigint,p_contacto jsonb,p_items jsonb)
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
begin
 if v_uid is not null then
  select rol into v_rol from public.cuentas_acceso where usuario_id=v_uid and habilitada;
  if not found then raise exception 'La cuenta no está habilitada. Volvé a ingresar.' using errcode='42501'; end if;
  if v_rol='cliente' then v_cliente := v_uid; end if;
 end if;
 if p_clave is null or p_negocio is null or p_negocio < 1
 or jsonb_typeof(p_contacto) is distinct from 'object' or octet_length(p_contacto::text)>2000
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
 if v_total>999999999999.99 then raise exception 'El importe del pedido supera el límite permitido.' using errcode='22023'; end if;
 insert into public.pedidos(emprendimiento_id,cliente_usuario_id,nombre_contacto,telefono_contacto,subtotal)
 values(p_negocio,v_cliente,v_nombre,v_telefono,v_total) returning id,fecha_creacion into v_id,v_fecha;
 insert into public.detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad)
 select v_id,(x->>'producto_id')::bigint,x->>'nombre',(x->>'precio_centavos')::numeric/100,
 (x->>'cantidad')::integer from jsonb_array_elements(v_detalles) x;
 v_respuesta := jsonb_build_object('id',v_id,'estado','Pendiente','fecha',v_fecha,
 'subtotal_centavos',(v_total*100)::bigint,'items',v_detalles);
 insert into private.solicitudes_pedido values(p_clave,v_id,v_huella,v_respuesta);
 return v_respuesta;
end;
$$;
revoke all on function private.confirmar_pedido(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
-- Esquema no expuesto por PostgREST. Solo esta función privada se concede a visitantes.
grant usage on schema private to anon;
grant execute on function private.confirmar_pedido(uuid,bigint,jsonb,jsonb) to anon,authenticated;
create function public.confirmar_pedido(p_clave uuid,p_negocio bigint,p_contacto jsonb,p_items jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.confirmar_pedido(p_clave,p_negocio,p_contacto,p_items);
$$;
revoke all on function public.confirmar_pedido(uuid,bigint,jsonb,jsonb) from public;
grant execute on function public.confirmar_pedido(uuid,bigint,jsonb,jsonb) to anon,authenticated;
commit;
