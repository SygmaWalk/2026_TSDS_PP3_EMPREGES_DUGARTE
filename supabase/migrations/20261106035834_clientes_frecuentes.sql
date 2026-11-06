begin;
create function private.frecuencia_clientes(p_negocio bigint,p_minimo integer default 3,p_desde date default null,p_hasta date default null,p_orden text default 'pedidos',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
 if auth.uid() is null or not coalesce(private.tiene_permiso(p_negocio,'clientes.ver'),false) or not coalesce(private.tiene_permiso(p_negocio,'pedidos.ver'),false) then
 raise exception 'Sin permiso para consultar clientes y pedidos.' using errcode='42501'; end if;
 if p_minimo is null or p_minimo not between 1 and 100000 or p_pagina is null or p_pagina not between 0 and 100000 or p_orden is null or p_orden not in ('pedidos','importe') or (p_desde is not null and p_hasta is not null and p_desde>p_hasta) then
 raise exception 'Revisá los filtros de frecuencia.' using errcode='22023'; end if;
 with resumen as (
 select c.id,c.nombre,count(p.id) pedidos,coalesce(sum(p.total),0) importe,count(p.id)>=p_minimo frecuente
 from public.clientes_comerciales c
 left join public.pedidos p on p.cliente_comercial_id=c.id and p.emprendimiento_id=c.emprendimiento_id
 and p.estado<>'Cancelado'
 and (p_desde is null or p.fecha_creacion >= (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires'))
 and (p_hasta is null or p.fecha_creacion < ((p_hasta+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'))
 where c.emprendimiento_id=p_negocio group by c.id,c.nombre
 ), pagina as (
 select * from resumen order by case when p_orden='pedidos' then pedidos else importe end desc,nombre,id limit 25 offset (p_pagina*25)
 ) select jsonb_build_object('clientes',coalesce((select jsonb_agg(to_jsonb(pagina)) from pagina),'[]'::jsonb),'total',(select count(*) from resumen)) into resultado;
 return resultado;
end $$;
create function public.frecuencia_clientes(p_negocio bigint,p_minimo integer default 3,p_desde date default null,p_hasta date default null,p_orden text default 'pedidos',p_pagina integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.frecuencia_clientes(p_negocio,p_minimo,p_desde,p_hasta,p_orden,p_pagina)
$$;
revoke all on function private.frecuencia_clientes(bigint,integer,date,date,text,integer),public.frecuencia_clientes(bigint,integer,date,date,text,integer) from public,anon;
grant execute on function private.frecuencia_clientes(bigint,integer,date,date,text,integer),public.frecuencia_clientes(bigint,integer,date,date,text,integer) to authenticated;
commit;
