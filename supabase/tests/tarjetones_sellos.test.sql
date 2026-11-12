begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000006701','sellos-cliente@example.test'),
 ('00000000-0000-0000-0000-000000006702','sellos-local@example.test');
update cuentas_acceso set rol='emprendimiento' where usuario_id='00000000-0000-0000-0000-000000006702';
insert into emprendimientos(id,nombre,slug) overriding system value values(-96701,'Tienda sello','test-sellos');
insert into miembros_emprendimiento values(-96701,'00000000-0000-0000-0000-000000006702',now(),true);
insert into permisos_miembro values(-96701,'00000000-0000-0000-0000-000000006702','tienda.configurar');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000006702","role":"authenticated"}',true);
insert into programas_sellos values(-96701,true,'Un café');
set local role postgres;
create function pg_temp.comprar(cantidad int) returns void language sql as $$
 insert into pedidos(emprendimiento_id,cliente_usuario_id,nombre_contacto,telefono_contacto,subtotal,estado,estado_pago,metodo_pago,pago_efectivo,fecha_pago)
 select -96701,'00000000-0000-0000-0000-000000006701','Cliente','1123456789',10,'Pendiente','Pagado','Efectivo',10,now() from generate_series(1,cantidad);
 update pedidos set estado='Entregado' where emprendimiento_id=-96701;
$$;
select pg_temp.comprar(9);
select is((select count(*) from beneficios_sellos b join sellos_compra s on s.pedido=b.pedido where s.negocio=-96701),0::bigint,'Nueve sellos todavía no otorgan el beneficio');
select pg_temp.comprar(1);
select is((select count(*) from sellos_compra where negocio=-96701),10::bigint,'Diez compras diferentes, sin duplicados al repetir la entrega');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000006701","role":"authenticated"}',true);
select is((select t#>>'{beneficios,0,terminos}' from mis_tarjetones() t where t->>'id'='-96701'),'Un café','El décimo sello emite el beneficio');
select throws_ok($q$select canjear_tarjeton(-96701,gen_random_uuid())$q$,'42501',null,'El cliente no puede registrar canjes');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000006702","role":"authenticated"}',true);
update programas_sellos set activo=false,terminos='Una medialuna' where negocio=-96701;
set local role postgres;
select pg_temp.comprar(1);
select is((select count(*) from sellos_compra where negocio=-96701),10::bigint,'La pausa conserva el saldo');
select set_config('test.codigo',(select codigo::text from beneficios_sellos b join sellos_compra s on b.pedido=s.pedido where s.negocio=-96701),true);
set local role authenticated;
select is(canjear_tarjeton(-96701,current_setting('test.codigo')::uuid),'Un café','El canje conserva el beneficio original durante la pausa');
select throws_ok($q$select canjear_tarjeton(-96701,current_setting('test.codigo')::uuid)$q$,'22023',null,'El beneficio solo se canjea una vez');
select * from finish();
rollback;
