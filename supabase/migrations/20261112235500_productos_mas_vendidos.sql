begin;
create function public.informe_ventas_por_periodo(p_negocio bigint, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare dias jsonb; productos jsonb;
begin
  -- El resumen existente verifica el permiso del negocio y el período.
  dias := public.ventas_por_periodo(p_negocio, p_desde, p_hasta);
  with lineas as (
    select d.producto_id, d.nombre_producto, d.cantidad, p.fecha_creacion, p.id
    from public.pedidos p join public.detalles_pedido d on d.pedido_id=p.id
    where p.emprendimiento_id=p_negocio and p.estado_pago='Pagado' and p.estado <> 'Cancelado'
      and p.fecha_creacion >= (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires')
      and p.fecha_creacion < ((p_hasta+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
  ), ranking as (
    select distinct on (producto_id) producto_id, nombre_producto as nombre,
           sum(cantidad) over (partition by producto_id) as unidades
    from lineas order by producto_id, fecha_creacion desc, id desc
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by unidades desc, nombre, producto_id),'[]'::jsonb)
    into productos from ranking r;
  return jsonb_build_object('dias',dias,'productos',productos);
end $$;
revoke all on function public.informe_ventas_por_periodo(bigint,date,date) from public,anon;
grant execute on function public.informe_ventas_por_periodo(bigint,date,date) to authenticated;
commit;
