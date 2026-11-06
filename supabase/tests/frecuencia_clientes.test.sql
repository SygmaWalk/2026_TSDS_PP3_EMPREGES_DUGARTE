begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000009431','frecuencia@example.test');
update cuentas_acceso set rol='emprendimiento' where usuario_id='00000000-0000-0000-0000-000000009431';
insert into emprendimientos(id,nombre,slug) overriding system value values(-99431,'Frecuencia A','test-frecuencia-a'),(-99432,'Frecuencia B','test-frecuencia-b');
insert into miembros_emprendimiento(emprendimiento_id,usuario_id) values(-99431,'00000000-0000-0000-0000-000000009431');
insert into permisos_miembro values(-99431,'00000000-0000-0000-0000-000000009431','clientes.ver'),(-99431,'00000000-0000-0000-0000-000000009431','pedidos.ver');
insert into pedidos(emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,fecha_creacion) values
(-99431,'Ana','1111111001',100,'2026-11-01 03:00:00Z'),
(-99431,'Ana','1111111001',200,'2026-11-02 02:59:59Z'),
(-99431,'Ana','1111111001',300,'2026-11-02 03:00:00Z'),
(-99432,'Ajeno','1111111001',999,'2026-11-01 12:00:00Z');
insert into pedidos(emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,fecha_creacion,estado,motivo_cancelacion) values
(-99431,'Ana','1111111001',9999,'2026-11-01 12:00:00Z','Cancelado','Prueba');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009431","role":"authenticated"}',true);
select is(public.frecuencia_clientes(-99431)->'clientes'->0->>'pedidos','3','Excluye cancelados y pedidos ajenos');
select is((public.frecuencia_clientes(-99431)->'clientes'->0->>'importe')::numeric,600::numeric,'Importe no incluye cancelados');
select is(public.frecuencia_clientes(-99431)->'clientes'->0->>'frecuente','true','Mínimo predeterminado tres');
select is(public.frecuencia_clientes(-99431,4)->'clientes'->0->>'frecuente','false','Mínimo configurable');
select is(public.frecuencia_clientes(-99431,2,'2026-11-01','2026-11-01')->'clientes'->0->>'pedidos','2','Día inclusivo en zona Argentina');
select throws_ok($q$select public.frecuencia_clientes(-99432)$q$,'42501',null,'Rechaza negocio ajeno existente');
select throws_ok($q$select public.frecuencia_clientes(-99431,0)$q$,'22023',null,'Rechaza mínimo cero');
select throws_ok($q$select public.frecuencia_clientes(-99431,3,'2026-11-02','2026-11-01')$q$,'22023',null,'Rechaza período invertido');
set local role postgres;
delete from permisos_miembro where emprendimiento_id=-99431 and permiso='pedidos.ver';
set local role authenticated;
select throws_ok($q$select public.frecuencia_clientes(-99431)$q$,'42501',null,'Revocar pedidos impide consultar sin renovar sesión');
set local role postgres;
insert into permisos_miembro values(-99431,'00000000-0000-0000-0000-000000009431','pedidos.ver');
delete from permisos_miembro where emprendimiento_id=-99431 and permiso='clientes.ver';
set local role authenticated;
select throws_ok($q$select public.frecuencia_clientes(-99431)$q$,'42501',null,'Pedidos solos no autorizan datos de clientes');
set local role anon;
select throws_ok($q$select public.frecuencia_clientes(-99431)$q$,'42501',null,'Visitante sin acceso');
set local role postgres;
select * from finish();
rollback;
