begin;
create function public.informe_ventas_con_zonas(p_negocio bigint,p_desde date,p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare informe jsonb; zonas jsonb;
begin
  informe:=public.informe_ventas_por_periodo(p_negocio,p_desde,p_hasta);
  with configuradas as (
    select case when c.modalidad='zonas' then 'zona' else 'radio' end as tipo,
      case when c.modalidad='zonas' then f->>'nombre' else 'Franja '||n end as nombre,
      case when c.modalidad='zonas' then f-'tarifa_centavos'
        else jsonb_build_array(coalesce(lag(f->'hasta_m') over(order by n),'0'::jsonb),f->'hasta_m') end as limites
    from public.configuracion_entregas c cross join lateral
      jsonb_array_elements(case when c.modalidad='zonas' then c.zonas else c.franjas end) with ordinality as franjas(f,n)
    where c.emprendimiento_id=p_negocio
  ), incluidos as (
    select case when entrega->>'modalidad'='retiro' then 'retiro'
        when entrega->>'modalidad'='envio' and entrega->>'modalidad_tarifa'='zonas' then 'zona'
        when entrega->>'modalidad'='envio' and entrega->>'franja' is not null then 'radio'
        else 'sin_zona' end as tipo,
      entrega,subtotal,costo_envio,total
    from public.pedidos where emprendimiento_id=p_negocio and estado<>'Cancelado'
      and fecha_creacion >= (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires')
      and fecha_creacion < ((p_hasta+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
  ), historicas as (
    select tipo,case tipo when 'retiro' then 'Retiro en el local' when 'sin_zona' then 'Sin zona registrada'
        else coalesce(entrega->>'franja',entrega#>>'{zona,nombre}','Sin zona registrada') end as nombre,
      case tipo when 'zona' then (entrega->'zona')-'tarifa_centavos'
        when 'radio' then jsonb_build_array(entrega->'desde_m',entrega->'hasta_m') end as limites,
      1 as pedidos,subtotal,costo_envio,total from incluidos
  ), filas as (
    select * from historicas union all select tipo,nombre,limites,0,0,0,0 from configuradas
  ), agrupadas as (
    select tipo,nombre,limites,sum(pedidos) pedidos,sum(subtotal) productos,sum(costo_envio) envio,sum(total) total
    from filas group by tipo,nombre,limites
  )
  select coalesce(jsonb_agg(to_jsonb(a) order by pedidos desc,nombre,tipo,limites),'[]'::jsonb) into zonas from agrupadas a;
  return informe||jsonb_build_object('zonas',zonas);
end $$;
revoke all on function public.informe_ventas_con_zonas(bigint,date,date) from public,anon;
grant execute on function public.informe_ventas_con_zonas(bigint,date,date) to authenticated;
commit;
