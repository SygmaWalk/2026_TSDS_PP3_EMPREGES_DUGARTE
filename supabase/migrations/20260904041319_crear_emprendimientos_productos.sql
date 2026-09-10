-- ND2026-7: persistencia inicial del catalogo, preparada para multiples negocios.
create table public.emprendimientos (
    id bigint generated always as identity primary key,
    nombre text not null,
    slug text not null,
    activo boolean not null default true,
    fecha_creacion timestamptz not null default statement_timestamp(),
    fecha_modificacion timestamptz not null default statement_timestamp(),
    constraint emprendimientos_nombre_no_vacio check (nombre <> ''),
    constraint emprendimientos_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint emprendimientos_slug_unico unique (slug)
);

create table public.productos (
    id bigint generated always as identity primary key,
    emprendimiento_id bigint not null,
    nombre text not null,
    descripcion text,
    precio numeric(12,2) not null,
    imagen_path text,
    visible boolean not null default false,
    fecha_creacion timestamptz not null default statement_timestamp(),
    fecha_modificacion timestamptz not null default statement_timestamp(),
    constraint productos_emprendimiento_fk foreign key (emprendimiento_id)
        references public.emprendimientos (id) on delete restrict,
    constraint productos_nombre_no_vacio check (nombre <> ''),
    constraint productos_precio_positivo check (precio > 0 and precio <> 'NaN'::numeric)
);

-- La primera columna tambien permite buscar productos por emprendimiento
-- y comprobar la clave foranea sin un segundo indice redundante.
create unique index productos_emprendimiento_nombre_unico
    on public.productos (emprendimiento_id, lower(btrim(nombre)));

-- Normaliza nombres en altas y ediciones, y mantiene las fechas en el servidor.
create function public.preparar_registro_catalogo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.nombre := btrim(new.nombre, E' \t\n\r\f\013');
    if tg_op = 'INSERT' then
        new.fecha_creacion := statement_timestamp();
    else
        new.fecha_creacion := old.fecha_creacion;
    end if;
    new.fecha_modificacion := statement_timestamp();
    return new;
end;
$$;

revoke all on function public.preparar_registro_catalogo()
    from public, anon, authenticated;

create trigger emprendimientos_preparar_registro
before insert or update on public.emprendimientos
for each row execute function public.preparar_registro_catalogo();

create trigger productos_preparar_registro
before insert or update on public.productos
for each row execute function public.preparar_registro_catalogo();

alter table public.emprendimientos enable row level security;
alter table public.productos enable row level security;

-- El acceso administrativo desde React se definira con usuarios y membresias.
-- Iniciar sesion, por si solo, no otorga permiso para administrar negocios.
revoke all on table public.emprendimientos, public.productos
    from public, anon, authenticated;
revoke all on sequence public.emprendimientos_id_seq, public.productos_id_seq
    from public, anon, authenticated;
grant select on table public.emprendimientos, public.productos to anon, authenticated;
grant select, insert, update, delete on table public.emprendimientos, public.productos
    to service_role;
grant usage, select on sequence public.emprendimientos_id_seq, public.productos_id_seq
    to service_role;

create policy emprendimientos_lectura_publica
on public.emprendimientos for select to anon, authenticated
using (activo);

create policy productos_lectura_publica
on public.productos for select to anon, authenticated
using (
    visible
    and exists (
        select 1 from public.emprendimientos as e
        where e.id = productos.emprendimiento_id and e.activo
    )
);
