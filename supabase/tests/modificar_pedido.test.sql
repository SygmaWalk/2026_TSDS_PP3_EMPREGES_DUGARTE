begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000094101','edicion@example.test');
update cuentas_acceso set rol='emprendimiento' where usuario_id='00000000-0000-0000-0000-000000094101';
insert into emprendimientos(id,nombre,slug) overriding system value values(941001,'Tienda de edición','test-edicion-941001');
insert into productos(id,emprendimiento_id,nombre,precio,visible) overriding system value values(941001,941001,'Pizza',10,true);
insert into miembros_emprendimiento values(941001,'00000000-0000-0000-0000-000000094101',now(),true);
insert into permisos_miembro values(941001,'00000000-0000-0000-0000-000000094101','pedidos.ver');
insert into pedidos(id,emprendimiento_id,nombre_contacto,telefono_contacto,subtotal,stock_descontado)
 overriding system value values(941001,941001,'Cliente','1123456789',20,true);
insert into detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad) values(941001,941001,'Pizza',10,2);
insert into consumos_stock_pedido(pedido_id,emprendimiento_id,producto_id,nombre_producto,cantidad) values(941001,941001,941001,'Pizza',2);
insert into movimientos_stock(emprendimiento_id,producto_id,clave,tipo,cantidad,motivo,pedido_id) values
 (941001,941001,gen_random_uuid(),'Entrada',10,'Inicial',null),(941001,941001,gen_random_uuid(),'Venta',-2,'Venta inicial',941001);

create function pg_temp.editar(unidades integer, devolver boolean, guardar boolean default false,
 clave uuid default gen_random_uuid(), huella text default null, version uuid default null) returns jsonb language sql as $$
 select public.modificar_pedido(941001,941001,coalesce(version,(select revision from pedidos where id=941001)),clave,
 jsonb_build_array(jsonb_build_object('producto_id',941001,'cantidad',unidades)),
 '{"modalidad":"retiro"}','Cambio solicitado',devolver,guardar,huella)
$$;
create function pg_temp.confirmar(unidades integer, devolver boolean) returns jsonb language plpgsql as $$
declare clave uuid:=gen_random_uuid(); vista jsonb; resultado jsonb;
begin
 vista:=pg_temp.editar(unidades,devolver,false,clave);
 resultado:=pg_temp.editar(unidades,devolver,true,clave,vista->>'huella',(vista->>'revision')::uuid);
 if resultado is distinct from pg_temp.editar(unidades,devolver,true,clave,vista->>'huella',(vista->>'revision')::uuid) then
  raise exception 'El reintento devolvió otro resultado';
 end if;
 return resultado;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000094101","role":"authenticated"}',true);
select throws_ok('select pg_temp.editar(3,false)','42501',null,'Solo consultar no permite editar');
set local role postgres;
insert into permisos_miembro values(941001,'00000000-0000-0000-0000-000000094101','pedidos.modificar');
set local role authenticated;
select is(pg_temp.editar(3,false)#>>'{nuevo,total_centavos}','3000','La revisión cotiza tres unidades');
select is((select subtotal from pedidos where id=941001),20::numeric,'Revisar conserva el total original');
select throws_ok('select pg_temp.editar(999,false)','22023',null,'El stock insuficiente bloquea el cambio');
select throws_ok('select pg_temp.editar(3,false,true)','PT409',null,'Guardar requiere la revisión vigente');
select is((pg_temp.confirmar(3,false)#>>'{stock,0,cantidad}')::numeric,-1::numeric,'Aumentar descuenta solo la diferencia');
set local role postgres;
update pedidos set estado='En preparación' where id=941001;
set local role authenticated;
select is((pg_temp.confirmar(2,false)#>>'{stock,0,sin_reintegrar}')::numeric,1::numeric,'Durante la preparación se puede retirar sin devolver');
select is((pg_temp.confirmar(1,true)#>>'{stock,0,cantidad}')::numeric,1::numeric,'Al marcar devolución se reintegra una unidad');
select is((select count(*) from modificaciones_pedido where pedido_id=941001),3::bigint,'Los reintentos no duplican el historial');
set local role postgres;
select is((select sum(cantidad) from movimientos_stock where producto_id=941001),8::numeric,'Saldo final tras ambas decisiones');
select is((select cantidad-cantidad_devuelta from consumos_stock_pedido where pedido_id=941001),1::numeric,'Solo queda una unidad reintegrable en una cancelación');
set constraints all immediate;
select * from finish();
rollback;
