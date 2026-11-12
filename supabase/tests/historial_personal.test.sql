begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000006401','historial-a@example.test'),
 ('00000000-0000-0000-0000-000000006402','historial-b@example.test');
insert into emprendimientos(id,nombre,slug) overriding system value values(-96401,'Tienda historial','prueba-historial-personal');
insert into productos(id,emprendimiento_id,nombre,precio) overriding system value values(-96401,-96401,'Nombre vigente',50);
insert into pedidos(id,emprendimiento_id,cliente_usuario_id,nombre_contacto,telefono_contacto,subtotal,fecha_creacion) overriding system value values
 (-96401,-96401,'00000000-0000-0000-0000-000000006401','Cliente','1123456789',10,'2026-11-01'),
 (-96402,-96401,'00000000-0000-0000-0000-000000006401','Cliente','1123456789',20,'2026-11-02'),
 (-96403,-96401,'00000000-0000-0000-0000-000000006402','Cliente','1123456789',10,'2026-11-02'),
 (-96404,-96401,null,'Cliente','1123456789',10,'2026-11-02');
insert into detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad) values(-96402,-96401,'Nombre al comprar',10,2);
set local role anon;
select throws_ok('select * from mis_pedidos()','42501',null,'El visitante no puede consultar historial');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000006401","role":"authenticated"}',true);
select results_eq($q$select (p->>'id')::int from mis_pedidos() p$q$,array[-96402,-96401],'Solo compras propias en orden descendente');
select is((select p#>>'{productos,0,nombre}' from mis_pedidos() p limit 1),'Nombre al comprar','Conserva el producto registrado');
select is((select (p#>>'{productos,0,precio}')::numeric from mis_pedidos() p limit 1),10::numeric,'Conserva el importe registrado');
select results_eq($q$select (p->>'id')::int from mis_pedidos('2026-11-02',-96402) p$q$,array[-96401],'La siguiente página excluye el último pedido visto');
set local role postgres;
update cuentas_acceso set habilitada=false where usuario_id='00000000-0000-0000-0000-000000006401';
set local role authenticated;
select is((select count(*) from mis_pedidos()),0::bigint,'Una cuenta deshabilitada no recibe historial');
select * from finish();
rollback;
