begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000009101','pedidos-a@example.test'),
('00000000-0000-0000-0000-000000009102','productos-a@example.test'),
('00000000-0000-0000-0000-000000009103','pedidos-b@example.test'),
('00000000-0000-0000-0000-000000009104','cliente-pedidos@example.test'),
('00000000-0000-0000-0000-000000009105','admin-pedidos@example.test');
update cuentas_acceso set rol='emprendimiento' where usuario_id in ('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009102','00000000-0000-0000-0000-000000009103');
update cuentas_acceso set rol='administrador' where usuario_id='00000000-0000-0000-0000-000000009105';
insert into emprendimientos(id,nombre,slug) overriding system value values(-99101,'Pedidos A','test-panel-a'),(-99102,'Pedidos B','test-panel-b');
insert into productos(id,emprendimiento_id,nombre,precio) overriding system value values(-99101,-99101,'Producto A',50),(-99102,-99102,'Producto B',50);
insert into miembros_emprendimiento values
(-99101,'00000000-0000-0000-0000-000000009101',now(),true),
(-99101,'00000000-0000-0000-0000-000000009102',now(),true),
(-99102,'00000000-0000-0000-0000-000000009103',now(),true);
insert into permisos_miembro values
(-99101,'00000000-0000-0000-0000-000000009101','pedidos.ver'),
(-99101,'00000000-0000-0000-0000-000000009102','productos.ver'),
(-99102,'00000000-0000-0000-0000-000000009103','pedidos.ver');
insert into pedidos(id,emprendimiento_id,nombre_contacto,telefono_contacto,subtotal) overriding system value values
(-99101,-99101,'Cliente A','1123456789',100),(-99102,-99102,'Cliente B','1123456789',100);
insert into detalles_pedido values(-99101,-99101,'Producto A',50,2),(-99102,-99102,'Producto B',50,2);
set local role anon;
select throws_ok('select * from pedidos','42501',null,'Visitante no lista pedidos');
select throws_ok('select * from detalles_pedido','42501',null,'Visitante no lista detalles');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}',true);
select results_eq('select id from pedidos where id in(-99101,-99102)',array[-99101::bigint],'Permiso de pedidos restringe al negocio propio');
select results_eq('select pedido_id from detalles_pedido where pedido_id in(-99101,-99102)',array[-99101::bigint],'Detalles directos también aislados');
select is((select count(*) from productos where id=-99101),0::bigint,'Consultar pedidos no concede lectura interna de productos');
select throws_ok($q$update pedidos set subtotal=1 where id=-99101$q$,'42501',null,'Lectura no permite editar');
select throws_ok($q$delete from pedidos where id=-99101$q$,'42501',null,'Lectura no permite borrar');
select throws_ok($q$insert into detalles_pedido values(-99101,-99102,'Intruso',1,1)$q$,'42501',null,'Lectura no permite insertar detalle');
select throws_ok($q$insert into permisos_miembro values(-99102,auth.uid(),'pedidos.ver')$q$,'42501',null,'Miembro no concede acceso ajeno');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009102","role":"authenticated"}',true);
select is((select count(*) from pedidos where id=-99101),0::bigint,'Permiso de productos no revela contactos');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009103","role":"authenticated"}',true);
select results_eq('select id from pedidos where id in(-99101,-99102)',array[-99102::bigint],'Otro negocio solo ve su pedido');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009104","role":"authenticated"}',true);
select is((select count(*) from pedidos where id in(-99101,-99102)),0::bigint,'Cliente no entra al panel interno');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009105","role":"authenticated"}',true);
select is((select count(*) from pedidos where id in(-99101,-99102)),2::bigint,'Administrador consulta ambos negocios');
reset role;
delete from permisos_miembro where usuario_id='00000000-0000-0000-0000-000000009101';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}',true);
select is((select count(*) from pedidos where id=-99101),0::bigint,'Revocar permiso retira lectura sin renovar JWT');
select is((select count(*) from detalles_pedido where pedido_id=-99101),0::bigint,'Revocar permiso retira detalle directo');
reset role;
insert into permisos_miembro values(-99101,'00000000-0000-0000-0000-000000009101','pedidos.ver');
update miembros_emprendimiento set habilitada=false where usuario_id='00000000-0000-0000-0000-000000009101';
set local role authenticated;
select is((select count(*) from pedidos where id=-99101),0::bigint,'Asociación deshabilitada retira lectura');
reset role;
update miembros_emprendimiento set habilitada=true where usuario_id='00000000-0000-0000-0000-000000009101';
update cuentas_acceso set habilitada=false where usuario_id='00000000-0000-0000-0000-000000009101';
set local role authenticated;
select is((select count(*) from pedidos where id=-99101),0::bigint,'Cuenta deshabilitada retira lectura');
reset role;
select * from finish();
rollback;
