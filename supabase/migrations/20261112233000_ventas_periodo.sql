begin;
create function public.ventas_por_periodo(p_negocio bigint, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare resultado jsonb;
begin
  if not coalesce(private.tiene_permiso(p_negocio,'pedidos.ver'),false) then
    raise exception 'Sin permiso para consultar pedidos' using errcode='42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Ingresá un período válido' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by dia),'[]'::jsonb) into resultado
  from (
    select (fecha_creacion at time zone 'America/Argentina/Buenos_Aires')::date as dia,
           count(*) as pedidos,
           coalesce(sum(total) filter (where estado_pago='Pagado' and estado <> 'Cancelado'),0) as ventas
    from public.pedidos
    where emprendimiento_id=p_negocio
      and fecha_creacion >= (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires')
      and fecha_creacion < ((p_hasta+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
    group by 1
  ) d;
  return resultado;
end $$;
revoke all on function public.ventas_por_periodo(bigint,date,date) from public,anon;
grant execute on function public.ventas_por_periodo(bigint,date,date) to authenticated;
commit;
