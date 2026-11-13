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
insert into configuracion_entregas(emprendimiento_id,direccion_origen,latitud,longitud,franjas)
values(-93501,'Local de prueba',-34.5,-58.5,'[{"hasta_m":1000,"tarifa_centavos":500},{"hasta_m":2000,"tarifa_centavos":900}]');
insert into pedidos(emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,costo_envio,fecha_creacion,entrega)
values(-93501,'Cliente','1123456789',10,1,'2026-11-12T03:00Z','{"modalidad":"envio","franja":"Franja 1","desde_m":0,"hasta_m":500}'),
(-93501,'Cliente','1123456789',20,2,'2026-11-13T02:59Z','{"modalidad":"envio","franja":"Franja 2","desde_m":1000,"hasta_m":2000}'),
(-93501,'Cliente','1123456789',30,3,'2026-11-13T03:00Z','{"modalidad":"envio","franja":"Franja 2","desde_m":1000,"hasta_m":2000}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000003501","role":"authenticated"}',true);
select is(informe_ventas_con_zonas(-93501,'2026-11-12','2026-11-12')->'zonas', '[
 {"tipo":"radio","nombre":"Franja 1","limites":[0,500],"pedidos":1,"productos":10,"envio":1,"total":11},
 {"tipo":"radio","nombre":"Franja 2","limites":[1000,2000],"pedidos":1,"productos":20,"envio":2,"total":22},
 {"tipo":"radio","nombre":"Franja 1","limites":[0,1000],"pedidos":0,"productos":0,"envio":0,"total":0}
]'::jsonb,'Respeta límites históricos, agrupa tarifas cambiadas y conserva franjas vigentes vacías');
select throws_ok($q$select informe_ventas_con_zonas(-93502,'2026-11-10','2026-11-12')$q$,'42501',null,'El informe requiere permiso en el negocio');
select * from finish();
rollback;