-- Fixtures y extension de pruebas quedan dentro de una transaccion revertida.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.emprendimientos (id, nombre, slug, activo)
overriding system value values
    (-97001, '  Negocio A  ', 'prueba-nd2026-7-a', true),
    (-97002, 'Negocio B', 'prueba-nd2026-7-b', true),
    (-97003, 'Negocio inactivo', 'prueba-nd2026-7-inactivo', false);

insert into public.productos (id, emprendimiento_id, nombre, precio, visible)
overriding system value values
    (-97001, -97001, '  Tarta de verdura  ', 1000, false),
    (-97002, -97001, 'Pizza', 2000, true),
    (-97003, -97002, 'Tarta de verdura', 1500, true),
    (-97004, -97003, 'Producto negocio inactivo', 500, true);

insert into public.productos (id, emprendimiento_id, nombre, precio)
overriding system value values (-97005, -97001, 'Producto nuevo', 123.45);

select is((select nombre from public.productos where id = -97001), 'Tarta de verdura', 'El nombre se guarda sin espacios en los extremos');
select is((select nombre from public.emprendimientos where id = -97001), 'Negocio A', 'El negocio tampoco admite espacios en los extremos');
select is((select visible from public.productos where id = -97005), false, 'El producto nuevo queda oculto');
select ok((select descripcion is null and imagen_path is null from public.productos where id = -97005), 'Descripcion e imagen son opcionales');
select is((select precio from public.productos where id = -97005), 123.45::numeric, 'El precio conserva exactamente los centavos');
select is((select count(*) from public.productos where nombre = 'Tarta de verdura' and id in (-97001, -97003)), 2::bigint, 'Distintos negocios pueden repetir nombres');

select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,' TARTA DE VERDURA ',100)$q$, '23505', null, 'No duplica un nombre oculto por mayusculas o espacios');
select throws_ok($q$update public.productos set nombre = ' tArTa de verdura ' where id = -97002$q$, '23505', null, 'La unicidad tambien se exige al editar');
select throws_ok($q$update public.productos set emprendimiento_id = -97001 where id = -97003$q$, '23505', null, 'Mover de negocio no permite duplicados');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,E' \t\n ',100)$q$, '23514', null, 'Rechaza nombres compuestos solo por espacios');
select throws_ok($q$insert into public.productos (emprendimiento_id,precio) values (-97001,100)$q$, '23502', null, 'Nombre obligatorio');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre) values (-97001,'Sin precio')$q$, '23502', null, 'Precio obligatorio');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,'Cero',0)$q$, '23514', null, 'Rechaza precio cero');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,'Negativo',-1)$q$, '23514', null, 'Rechaza precio negativo');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,'NaN','NaN')$q$, '23514', null, 'Rechaza NaN como precio');
select throws_ok($q$insert into public.productos (nombre,precio) values ('Sin negocio',100)$q$, '23502', null, 'Emprendimiento obligatorio');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97999,'Huerfano',100)$q$, '23503', null, 'No admite negocios inexistentes');
select throws_ok($q$delete from public.emprendimientos where id = -97001$q$, '23503', null, 'No elimina negocios con productos');
select throws_ok($q$insert into public.emprendimientos (nombre,slug) values ('Otro','prueba-nd2026-7-a')$q$, '23505', null, 'Slug unico');
select throws_ok($q$insert into public.emprendimientos (nombre,slug) values ('Otro','Slug Invalido')$q$, '23514', null, 'Slug canonico para la URL');
select throws_ok($q$insert into public.emprendimientos (nombre,slug) values ('   ','nombre-vacio')$q$, '23514', null, 'Nombre del negocio no vacio');

create temporary table fechas_previas as
select fecha_creacion, fecha_modificacion from public.productos where id = -97005;
update public.productos set nombre = '  Nombre editado  ',
    fecha_creacion = '2000-01-01', fecha_modificacion = '2000-01-01' where id = -97005;
select is((select nombre from public.productos where id = -97005), 'Nombre editado', 'Normaliza el nombre al editar');
select is((select fecha_creacion from public.productos where id = -97005), (select fecha_creacion from fechas_previas), 'Conserva la fecha de creacion al editar');
select ok((select p.fecha_modificacion > f.fecha_modificacion from public.productos p cross join fechas_previas f where p.id = -97005), 'Actualiza la fecha de modificacion en el servidor');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.productos'::regclass,'public.emprendimientos'::regclass)), 'RLS habilitado en ambas tablas');

set local role anon;
select is((select count(*) from public.emprendimientos where id in (-97001,-97002,-97003)), 2::bigint, 'Anon solo ve negocios activos');
select is((select count(*) from public.productos where id between -97005 and -97001), 2::bigint, 'Anon solo ve productos visibles de negocios activos');
select is((select count(*) from public.productos where emprendimiento_id = -97001), 1::bigint, 'El filtro por emprendimiento devuelve solo su catalogo visible');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,'Intruso',100)$q$, '42501', null, 'Anon no crea productos');
select throws_ok($q$update public.productos set visible = true where id = -97001$q$, '42501', null, 'Anon no publica productos ocultos');
select throws_ok($q$delete from public.productos where id = -97002$q$, '42501', null, 'Anon no elimina productos');
select throws_ok($q$insert into public.emprendimientos (nombre,slug) values ('Intruso','intruso')$q$, '42501', null, 'Anon no crea negocios');
select throws_ok($q$update public.emprendimientos set activo = true where id = -97003$q$, '42501', null, 'Anon no activa negocios');
select throws_ok($q$delete from public.emprendimientos where id = -97003$q$, '42501', null, 'Anon no elimina negocios');
reset role;

set local role authenticated;
select is((select count(*) from public.emprendimientos where id in (-97001,-97002,-97003)), 2::bigint, 'Autenticarse no permite ver negocios inactivos');
select is((select count(*) from public.productos where id between -97005 and -97001), 2::bigint, 'Autenticarse no permite ver productos ocultos');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-97001,'Intruso',100)$q$, '42501', null, 'Authenticated no crea productos sin autorizacion de negocio');
select throws_ok($q$update public.productos set precio = 1 where id = -97002$q$, '42501', null, 'Authenticated no edita productos sin autorizacion de negocio');
select throws_ok($q$delete from public.productos where id = -97002$q$, '42501', null, 'Authenticated no elimina productos');
select throws_ok($q$insert into public.emprendimientos (nombre,slug) values ('Intruso','intruso')$q$, '42501', null, 'Authenticated no crea negocios');
select throws_ok($q$update public.emprendimientos set activo = true where id = -97003$q$, '42501', null, 'Authenticated no activa negocios');
select throws_ok($q$delete from public.emprendimientos where id = -97003$q$, '42501', null, 'Authenticated no elimina negocios');
reset role;

select * from finish();
rollback;
