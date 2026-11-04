begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.cuentas_acceso (
 usuario_id uuid primary key references auth.users(id) on delete cascade,
 rol text not null default 'cliente' check (rol in ('administrador','emprendimiento','cliente')),
 habilitada boolean not null default true
);
alter table public.cuentas_acceso enable row level security;
-- No se heredan privilegios de las membresías del modelo anterior.
insert into public.cuentas_acceso(usuario_id) select id from auth.users;
alter table public.miembros_emprendimiento add column habilitada boolean not null default true;
create table public.permisos_miembro (
 emprendimiento_id bigint not null,
 usuario_id uuid not null,
 permiso text not null check (permiso in ('productos.ver','productos.crear','productos.editar','productos.publicar')),
 primary key (emprendimiento_id,usuario_id,permiso),
 foreign key (emprendimiento_id,usuario_id) references public.miembros_emprendimiento on delete cascade
);
create index permisos_miembro_usuario_idx on public.permisos_miembro(usuario_id,emprendimiento_id);
alter table public.permisos_miembro enable row level security;

-- Lecturas internas acotadas: evitan recursión RLS; no aceptan una identidad arbitraria.
create function private.es_administrador() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from public.cuentas_acceso where usuario_id=auth.uid() and habilitada and rol='administrador');
$$;
create function private.es_miembro(p_negocio bigint) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from public.cuentas_acceso c join public.miembros_emprendimiento m on m.usuario_id=c.usuario_id
 where c.usuario_id=auth.uid() and c.habilitada and c.rol='emprendimiento'
 and m.emprendimiento_id=p_negocio and m.habilitada);
$$;
create function private.tiene_permiso(p_negocio bigint,p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (private.es_administrador() or
 (private.es_miembro(p_negocio) and exists (
 select 1 from public.permisos_miembro where usuario_id=auth.uid() and emprendimiento_id=p_negocio and permiso=p_permiso)));
$$;
revoke all on function private.es_administrador(),private.es_miembro(bigint),private.tiene_permiso(bigint,text) from public,anon;
grant execute on function private.es_administrador(),private.es_miembro(bigint),private.tiene_permiso(bigint,text) to authenticated;

-- Se invoca únicamente desde el trigger de Auth; el registro siempre produce Cliente.
create function private.inicializar_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.cuentas_acceso(usuario_id) values(new.id);
 return new;
end;
$$;
revoke all on function private.inicializar_cuenta() from public,anon,authenticated;
create trigger inicializar_cuenta after insert on auth.users for each row execute function private.inicializar_cuenta();

revoke all on public.cuentas_acceso,public.permisos_miembro from public,anon,authenticated;
grant select,insert,update,delete on public.cuentas_acceso,public.permisos_miembro to authenticated,service_role;
grant insert,update,delete on public.miembros_emprendimiento to authenticated;
create policy cuenta_propia on public.cuentas_acceso for select to authenticated using(usuario_id=(select auth.uid()));
create policy cuentas_admin on public.cuentas_acceso for all to authenticated using((select private.es_administrador())) with check((select private.es_administrador()));
drop policy miembros_lectura_propia on public.miembros_emprendimiento;
create policy miembros_lectura_propia on public.miembros_emprendimiento for select to authenticated using(usuario_id=(select auth.uid()) and private.es_miembro(emprendimiento_id));
create policy miembros_admin on public.miembros_emprendimiento for all to authenticated using((select private.es_administrador())) with check((select private.es_administrador()));
create policy permisos_propios on public.permisos_miembro for select to authenticated using(usuario_id=(select auth.uid()) and private.es_miembro(emprendimiento_id));
create policy permisos_admin on public.permisos_miembro for all to authenticated using((select private.es_administrador())) with check((select private.es_administrador()));

-- El alta automática del modelo anterior deja de ser una vía de elevación.
drop function public.crear_emprendimiento_inicial(text,text);
grant insert,update on public.emprendimientos to authenticated;
grant usage,select on sequence public.emprendimientos_id_seq to authenticated;
create policy emprendimientos_alta_admin on public.emprendimientos for insert to authenticated with check((select private.es_administrador()));
create policy emprendimientos_edicion_admin on public.emprendimientos for update to authenticated using((select private.es_administrador())) with check((select private.es_administrador()));
drop policy emprendimientos_lectura_miembro on public.emprendimientos;
create policy emprendimientos_lectura_miembro on public.emprendimientos for select to authenticated using(private.es_miembro(id) or (select private.es_administrador()));

drop policy productos_lectura_miembro on public.productos;
drop policy productos_alta_miembro on public.productos;
drop policy productos_edicion_miembro on public.productos;
create policy productos_lectura_permiso on public.productos for select to authenticated using(private.tiene_permiso(emprendimiento_id,'productos.ver'));
create policy productos_alta_permiso on public.productos for insert to authenticated with check(
 private.tiene_permiso(emprendimiento_id,'productos.ver') and private.tiene_permiso(emprendimiento_id,'productos.crear')
 and (not visible or private.tiene_permiso(emprendimiento_id,'productos.publicar')));
create policy productos_edicion_permiso on public.productos for update to authenticated using(
 private.tiene_permiso(emprendimiento_id,'productos.ver') and
 (private.tiene_permiso(emprendimiento_id,'productos.editar') or private.tiene_permiso(emprendimiento_id,'productos.publicar')))
 with check(private.tiene_permiso(emprendimiento_id,'productos.ver') and
 (private.tiene_permiso(emprendimiento_id,'productos.editar') or private.tiene_permiso(emprendimiento_id,'productos.publicar')));

create function private.validar_edicion_producto() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.emprendimiento_id is distinct from old.emprendimiento_id or new.id is distinct from old.id then
  raise exception 'No se puede trasladar un producto a otro emprendimiento' using errcode='42501';
 end if;
 if current_user='authenticated' then
  if (new.nombre,new.descripcion,new.precio,new.imagen_path) is distinct from (old.nombre,old.descripcion,old.precio,old.imagen_path)
   and not private.tiene_permiso(old.emprendimiento_id,'productos.editar') then
   raise exception 'Sin permiso para editar productos' using errcode='42501';
  end if;
  if new.visible is distinct from old.visible and not private.tiene_permiso(old.emprendimiento_id,'productos.publicar') then
   raise exception 'Sin permiso para publicar productos' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.validar_edicion_producto() from public,anon,authenticated;
create trigger productos_validar_permisos before update on public.productos for each row execute function private.validar_edicion_producto();
commit;
