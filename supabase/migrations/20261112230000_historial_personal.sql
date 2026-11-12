begin;

create function private.mis_pedidos(p_fecha timestamptz, p_id bigint)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'fecha', p.fecha_creacion, 'tienda', e.nombre,
    'estado', p.estado, 'estado_pago', p.estado_pago,
    'subtotal', p.subtotal, 'envio', p.costo_envio, 'total', p.total,
    'productos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nombre', d.nombre_producto, 'cantidad', d.cantidad, 'precio', d.precio_unitario,
        'adicionales', d.adicionales, 'promocion', d.promocion
      ) order by d.producto_id), '[]'::jsonb)
      from public.detalles_pedido d where d.pedido_id = p.id
    )
  )
  from public.pedidos p
  join public.emprendimientos e on e.id = p.emprendimiento_id
  where p.cliente_usuario_id = (select auth.uid())
    and exists (select 1 from public.cuentas_acceso c
      where c.usuario_id = (select auth.uid()) and c.rol = 'cliente' and c.habilitada)
    and ((p_fecha is null and p_id is null) or (p.fecha_creacion, p.id) < (p_fecha, p_id))
  order by p.fecha_creacion desc, p.id desc
  limit 21
$$;

create function public.mis_pedidos(p_fecha timestamptz default null, p_id bigint default null)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select * from private.mis_pedidos(p_fecha, p_id)
$$;

revoke all on function private.mis_pedidos(timestamptz,bigint), public.mis_pedidos(timestamptz,bigint) from public, anon;
grant execute on function private.mis_pedidos(timestamptz,bigint), public.mis_pedidos(timestamptz,bigint) to authenticated;
commit;
