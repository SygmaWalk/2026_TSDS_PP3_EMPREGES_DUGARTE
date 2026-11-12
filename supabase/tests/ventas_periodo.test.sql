begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000003501','ventas35@example.test');
update cuentas_acceso set rol='emprendimiento' where usuario_id='00000000-0000-0000-0000-000000003501';
insert into emprendimientos(id,nombre,slug) overriding system value values(-93501,'Ventas','ventas-93501');
insert into miembros_emprendimiento values(-93501,'00000000-0000-0000-0000-000000003501',now(),true);
insert into permisos_miembro values(-93501,'00000000-0000-0000-0000-000000003501','pedidos.ver');
insert into pedidos(emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,fecha_creacion)
values(-93501,'Pendiente','1123456789',500,'2026-11-13 02:59:59+00'),(-93501,'Fuera','1123456789',800,'2026-11-13 03:00:00+00');
insert into pedidos(emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,fecha_creacion,estado_pago,metodo_pago,pago_efectivo,fecha_pago)
values(-93501,'Pagado','1123456789',100,'2026-11-12 03:00:00+00','Pagado','Efectivo',100,now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000003501","role":"authenticated"}',true);
select is(ventas_por_periodo(-93501,'2026-11-12','2026-11-12'),'[{"dia":"2026-11-12","pedidos":2,"ventas":100}]'::jsonb,'Límites argentinos, conteo y suma de pagados');
select is(ventas_por_periodo(-93501,'2026-10-10','2026-10-11'),'[]'::jsonb,'Período vacío');
select throws_ok($q$select ventas_por_periodo(-93502,'2026-10-10','2026-10-11')$q$,'42501',null,'Requiere permiso en el negocio');
select throws_ok($q$select ventas_por_periodo(-93501,'2026-10-12','2026-10-11')$q$,'22023',null,'Rechaza fechas invertidas');
select * from finish();
rollback;
