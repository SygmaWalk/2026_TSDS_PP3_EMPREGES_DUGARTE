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
insert into productos(id,emprendimiento_id,nombre,precio) overriding system value values
 (-1,-93501,'Nombre actual A',50),(-2,-93501,'Nombre actual B',50),(-3,-93501,'Nombre actual C',50);
insert into pedidos(id,emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,fecha_creacion,estado_pago,metodo_pago,pago_efectivo,fecha_pago)
 overriding system value select n,-93501,'Cliente','1123456789',100,'2026-11-12T12:00Z'::timestamptz+(n+93606)*interval '1 second','Pagado','Efectivo',100,now()
 from generate_series(-93606,-93601) n;
update pedidos set estado='Cancelado',motivo_cancelacion='Cambio solicitado' where id=-93606;
update pedidos set fecha_creacion='2026-11-13T03:00Z' where id=-93605;
update pedidos set estado_pago='Pendiente',pago_efectivo=0,metodo_pago=null,fecha_pago=null where id=-93604;
update pedidos set fecha_creacion='2026-11-12T12:00Z'::timestamptz + (id+93606)*interval '1 second' where id <> -93605 and emprendimiento_id=-93501;
insert into detalles_pedido(pedido_id,producto_id,nombre_producto,cantidad,precio_unitario) values
 (-93601,-1,'Pizza',3,10),(-93602,-1,'Pizza anterior',2,10),(-93603,-2,'Alfajor',2,10),(-93603,-3,'Bebida',2,10),
 (-93604,-2,'Impago',50,10),(-93605,-2,'Fuera de fecha',50,10),(-93606,-2,'Cancelado',50,10);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000003501","role":"authenticated"}',true);
select is(informe_ventas_por_periodo(-93501,'2026-11-12','2026-11-12')->'productos',
 '[{"producto_id":-1,"nombre":"Pizza","unidades":5},{"producto_id":-2,"nombre":"Alfajor","unidades":2},{"producto_id":-3,"nombre":"Bebida","unidades":2}]'::jsonb,
 'Suma ventas históricas por producto, conserva el último nombre vendido y desempata por nombre');
select is(informe_ventas_por_periodo(-93501,'2026-11-01','2026-11-01')->'productos','[]'::jsonb,'Ranking vacío');
select throws_ok($q$select informe_ventas_por_periodo(-93502,'2026-11-01','2026-11-02')$q$,'42501',null,'Aislamiento por negocio');
select * from finish();
rollback;