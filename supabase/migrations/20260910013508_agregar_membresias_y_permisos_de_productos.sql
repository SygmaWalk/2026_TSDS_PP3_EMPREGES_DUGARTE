-- Acceso minimo por emprendimiento para el Sprint 1.
create table public.miembros_emprendimiento (
    emprendimiento_id bigint not null references public.emprendimientos(id) on delete cascade,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    fecha_creacion timestamptz not null default statement_timestamp(),
    primary key (emprendimiento_id, usuario_id)
);

create index miembros_emprendimiento_usuario_idx
    on public.miembros_emprendimiento (usuario_id, emprendimiento_id);

alter table public.miembros_emprendimiento enable row level security;
revoke all on table public.miembros_emprendimiento from public, anon, authenticated;
grant select on table public.miembros_emprendimiento to authenticated;
grant select, insert, update, delete on table public.miembros_emprendimiento to service_role;

create policy miembros_lectura_propia
on public.miembros_emprendimiento for select to authenticated
using ((select auth.uid()) = usuario_id);

-- Las politicas publicas existentes siguen resolviendo el catalogo.
-- Estas politicas adicionales permiten al miembro ver y administrar sus filas.
grant insert, update on table public.productos to authenticated;
grant usage, select on sequence public.productos_id_seq to authenticated;

create policy productos_lectura_miembro
on public.productos for select to authenticated
using (
    exists (
        select 1 from public.miembros_emprendimiento as m
        where m.emprendimiento_id = productos.emprendimiento_id
          and m.usuario_id = (select auth.uid())
    )
);

create policy productos_alta_miembro
on public.productos for insert to authenticated
with check (
    exists (
        select 1 from public.miembros_emprendimiento as m
        where m.emprendimiento_id = productos.emprendimiento_id
          and m.usuario_id = (select auth.uid())
    )
);

create policy productos_edicion_miembro
on public.productos for update to authenticated
using (
    exists (
        select 1 from public.miembros_emprendimiento as m
        where m.emprendimiento_id = productos.emprendimiento_id
          and m.usuario_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1 from public.miembros_emprendimiento as m
        where m.emprendimiento_id = productos.emprendimiento_id
          and m.usuario_id = (select auth.uid())
    )
);

create policy emprendimientos_lectura_miembro
on public.emprendimientos for select to authenticated
using (
    exists (
        select 1 from public.miembros_emprendimiento as m
        where m.emprendimiento_id = emprendimientos.id
          and m.usuario_id = (select auth.uid())
    )
);

-- Onboarding seguro: crea un emprendimiento y vincula al usuario actual.
create function public.crear_emprendimiento_inicial(p_nombre text, p_slug text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_usuario_id uuid := auth.uid();
    v_emprendimiento_id bigint;
begin
    if v_usuario_id is null then
        raise exception 'Se requiere una sesion autenticada' using errcode = '42501';
    end if;

    insert into public.emprendimientos (nombre, slug)
    values (p_nombre, p_slug)
    returning id into v_emprendimiento_id;

    insert into public.miembros_emprendimiento (emprendimiento_id, usuario_id)
    values (v_emprendimiento_id, v_usuario_id);

    return v_emprendimiento_id;
end;
$$;

revoke all on function public.crear_emprendimiento_inicial(text, text)
    from public, anon;
grant execute on function public.crear_emprendimiento_inicial(text, text)
    to authenticated, service_role;