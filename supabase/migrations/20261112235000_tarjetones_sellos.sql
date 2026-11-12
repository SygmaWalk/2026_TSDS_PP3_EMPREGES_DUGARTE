begin;
create table public.programas_sellos (
  negocio bigint primary key references public.emprendimientos(id) on delete cascade,
  activo boolean not null,
  terminos text not null check (length(trim(terminos)) between 1 and 2000)
);
create table public.sellos_compra (
  pedido bigint primary key references public.pedidos(id),
  negocio bigint not null references public.programas_sellos(negocio),
  cliente uuid not null references auth.users(id) on delete cascade,
  numero bigint not null check (numero > 0),
  unique (cliente,negocio,numero)
);
create table public.beneficios_sellos (
  codigo uuid primary key default gen_random_uuid(),
  pedido bigint not null unique references public.sellos_compra(pedido) on delete cascade,
  terminos text not null,
  canjeado timestamptz
);
alter table public.programas_sellos enable row level security;
alter table public.sellos_compra enable row level security;
alter table public.beneficios_sellos enable row level security;
revoke all on public.programas_sellos,public.sellos_compra,public.beneficios_sellos from public,anon,authenticated;
grant select,insert,update on public.programas_sellos to authenticated;
create policy gestionar_programa_lectura on public.programas_sellos for select to authenticated
 using(private.tiene_permiso(negocio,'tienda.configurar'));
create policy gestionar_programa_alta on public.programas_sellos for insert to authenticated
 with check(private.tiene_permiso(negocio,'tienda.configurar'));
create policy gestionar_programa_edicion on public.programas_sellos for update to authenticated
 using(private.tiene_permiso(negocio,'tienda.configurar')) with check(private.tiene_permiso(negocio,'tienda.configurar'));

create function private.acreditar_sello() returns trigger language plpgsql security definer set search_path='' as $$
declare condiciones text; siguiente bigint;
begin
  if new.estado <> 'Entregado' or new.estado_pago <> 'Pagado' or new.cliente_usuario_id is null then return new; end if;
  if tg_op='UPDATE' then
    if old.estado='Entregado' and old.estado_pago='Pagado' then return new; end if;
  end if;
  if not exists(select 1 from public.cuentas_acceso where usuario_id=new.cliente_usuario_id and rol='cliente' and habilitada) then return new; end if;
  select terminos into condiciones from public.programas_sellos where negocio=new.emprendimiento_id and activo for share;
  if not found then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('sellos:'||new.emprendimiento_id||':'||new.cliente_usuario_id,0));
  select coalesce(max(numero),0)+1 into siguiente from public.sellos_compra where negocio=new.emprendimiento_id and cliente=new.cliente_usuario_id;
  insert into public.sellos_compra(pedido,negocio,cliente,numero) values(new.id,new.emprendimiento_id,new.cliente_usuario_id,siguiente)
    on conflict (pedido) do nothing;
  if found and siguiente % 10 = 0 then
    insert into public.beneficios_sellos(pedido,terminos) values(new.id,condiciones);
  end if;
  return new;
end $$;
revoke all on function private.acreditar_sello() from public,anon,authenticated;
create trigger acreditar_sello after insert or update of estado,estado_pago on public.pedidos for each row execute function private.acreditar_sello();

create function private.mis_tarjetones() returns setof jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.negocio,'nombre',e.nombre,'activo',p.activo and e.activo,'terminos',p.terminos,
    'imagen',coalesce(a.publicada->>'logo_path',a.publicada->>'portada_path'),'compras',s.compras,'beneficios',s.beneficios)
  from public.programas_sellos p join public.emprendimientos e on e.id=p.negocio
  left join public.apariencias_tienda a on a.emprendimiento_id=e.id
  cross join lateral (
    select count(*) as compras, coalesce(jsonb_agg(jsonb_build_object('codigo',b.codigo,'terminos',b.terminos,'canjeado',b.canjeado)
      order by sello.numero desc) filter(where b.codigo is not null),'[]'::jsonb) as beneficios
    from public.sellos_compra sello left join public.beneficios_sellos b on b.pedido=sello.pedido
    where sello.negocio=p.negocio and sello.cliente=(select auth.uid())
  ) s
  where exists(select 1 from public.cuentas_acceso where usuario_id=(select auth.uid()) and rol='cliente' and habilitada)
    and ((e.activo and p.activo) or s.compras>0)
  order by e.nombre,p.negocio
$$;
create function public.mis_tarjetones() returns setof jsonb language sql stable security invoker set search_path='' as $$
  select * from private.mis_tarjetones()
$$;
create function private.canjear_tarjeton(p_negocio bigint,p_codigo uuid) returns text language plpgsql security definer set search_path='' as $$
declare condiciones text;
begin
  if not coalesce(private.tiene_permiso(p_negocio,'tienda.configurar'),false) then raise insufficient_privilege; end if;
  update public.beneficios_sellos b set canjeado=clock_timestamp() from public.sellos_compra s
    where b.pedido=s.pedido and s.negocio=p_negocio and b.codigo=p_codigo and b.canjeado is null returning b.terminos into condiciones;
  if not found then raise exception 'Código inválido o ya canjeado' using errcode='22023'; end if;
  return condiciones;
end $$;
create function public.canjear_tarjeton(p_negocio bigint,p_codigo uuid) returns text language sql security invoker set search_path='' as $$
 select private.canjear_tarjeton(p_negocio,p_codigo)
$$;
revoke all on function private.mis_tarjetones(),public.mis_tarjetones(),private.canjear_tarjeton(bigint,uuid),public.canjear_tarjeton(bigint,uuid) from public,anon;
grant execute on function private.mis_tarjetones(),public.mis_tarjetones(),private.canjear_tarjeton(bigint,uuid),public.canjear_tarjeton(bigint,uuid) to authenticated;
commit;
