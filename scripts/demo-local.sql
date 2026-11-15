\set ON_ERROR_STOP on
begin;
select pg_advisory_xact_lock(421113);
do $demo$
declare
  cocina bigint; cafe bigint; pizza bigint; empanada bigint; bebida bigint; combo bigint;
  ana uuid; bruno uuid; editor uuid; lector uuid; administrador uuid;
  comprador uuid; pedido bigint; destino jsonb; cotizacion jsonb; listo text;
  version_actual integer; importe numeric; i integer; permiso text;
begin
  select id into strict ana from auth.users where email='ana@demo.example.test';
  select id into strict bruno from auth.users where email='bruno@demo.example.test';
  select id into strict editor from auth.users where email='cocina@demo.example.test';
  select id into strict lector from auth.users where email='consulta@demo.example.test';
  select id into strict administrador from auth.users where email='admin@demo.example.test';
  if exists(select 1 from emprendimientos where slug in ('demo-mesa-del-sur','demo-cafe-del-patio')) then
    raise exception 'Ya existe una tienda de la demo. Se conservaron sus datos.';
  end if;
  insert into emprendimientos(nombre,slug) values('Mesa del Sur','demo-mesa-del-sur') returning id into cocina;
  insert into emprendimientos(nombre,slug) values('Café del Patio','demo-cafe-del-patio') returning id into cafe;
  update cuentas_acceso set rol='administrador' where usuario_id=administrador;
  update cuentas_acceso set rol='emprendimiento' where usuario_id in (editor,lector);
  insert into miembros_emprendimiento(emprendimiento_id,usuario_id) values(cocina,editor),(cocina,lector);
  foreach permiso in array array['productos.ver','productos.crear','productos.editar','productos.publicar','pedidos.ver','pedidos.actualizar_estado','pedidos.modificar','pedidos.registrar_pago','clientes.ver','clientes.editar','entregas.configurar','stock.ver','stock.registrar','tienda.configurar'] loop
    insert into permisos_miembro(emprendimiento_id,usuario_id,permiso) values(cocina,editor,permiso);
  end loop;
  insert into permisos_miembro(emprendimiento_id,usuario_id,permiso) select cocina,lector,unnest(array['productos.ver','pedidos.ver','clientes.ver','stock.ver']);
  insert into productos(emprendimiento_id,nombre,descripcion,precio,visible) values
    (cocina,'Pizza al molde','Muzzarella, tomate y orégano. Ocho porciones.',12000,true) returning id into pizza;
  insert into productos(emprendimiento_id,nombre,descripcion,precio,visible) values
    (cocina,'Empanada de calabaza','Calabaza asada y queso. Por unidad.',1800,true) returning id into empanada;
  insert into productos(emprendimiento_id,nombre,descripcion,precio,visible) values
    (cocina,'Limonada de la casa','Botella de 500 ml con menta fresca.',2500,true) returning id into bebida;
  insert into productos(emprendimiento_id,nombre,descripcion,precio,visible,es_combo) values
    (cocina,'Combo para dos','Una pizza al molde y dos limonadas.',15500,true,true) returning id into combo;
  insert into componentes_producto values(cocina,combo,pizza,1),(cocina,combo,bebida,2);
  insert into productos(emprendimiento_id,nombre,descripcion,precio,visible) values
    (cocina,'Especial del domingo','Borrador para ensayar su publicación.',9900,false),
    (cafe,'Café filtrado','Tueste medio, servido al momento.',3200,true),
    (cafe,'Roll de canela','Masa de brioche, azúcar y canela.',4200,true),
    (cafe,'Budín de limón','Porción con glaseado de cítricos.',3100,true);
  insert into movimientos_stock(emprendimiento_id,producto_id,clave,tipo,cantidad,motivo)
    select emprendimiento_id,id,gen_random_uuid(),'Entrada',case when id=bebida then 4 else 40 end,'Inventario inicial de demostración'
    from productos where emprendimiento_id in(cocina,cafe) and not es_combo;
  insert into configuracion_entregas(emprendimiento_id,direccion_origen,latitud,longitud,modalidad,franjas,zonas)
    values(cocina,'Cocina de demostración, Centro',-34.6037,-58.3816,'zonas','[]',
    '[{"nombre":"Centro","sur":-34.62,"norte":-34.59,"oeste":-58.40,"este":-58.37,"tarifa_centavos":150000},{"nombre":"Este","sur":-34.62,"norte":-34.59,"oeste":-58.37,"este":-58.35,"tarifa_centavos":200000}]');
  insert into direcciones_cliente(usuario_id,nombre,direccion,latitud,longitud,predeterminada) values
    (ana,'Casa','Corrientes 1200, Buenos Aires',-34.6037,-58.3816,true);
  insert into programas_sellos(negocio,activo,terminos) values(cocina,true,'Una limonada de la casa al completar diez sellos.');
  for i in 1..5 loop
    comprador:=case when i<=3 then ana else bruno end;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'role','authenticated')::text,true);
    destino:='{"modalidad":"retiro"}';
    if i=2 then
      cotizacion:=cotizar_entrega(cocina,-34.6037,-58.3816);
      destino:=cotizacion||'{"modalidad":"envio","direccion":"Corrientes 1200, Buenos Aires","latitud":-34.6037,"longitud":-58.3816}';
    end if;
    pedido:=(confirmar_pedido(gen_random_uuid(),cocina,jsonb_build_object('nombre',case when comprador=ana then 'Ana Molina' else 'Bruno Ríos' end,'telefono',case when comprador=ana then '1100000101' else '1100000102' end,'metodo_pago','Efectivo','entrega',destino),
      jsonb_build_array(jsonb_build_object('producto_id',case when i<=3 then pizza else empanada end,'cantidad',case when i=4 then 2 else 1 end,'precio_centavos',case when i<=3 then 1200000 else 180000 end)))->>'id')::bigint;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',editor,'role','authenticated')::text,true);
    if i<=2 then
      listo:=case when i=2 then 'En ruta de entrega' else 'Listo para retirar' end;
      perform cambiar_estado_pedido(pedido,cocina,'Pendiente','En preparación');
      perform cambiar_estado_pedido(pedido,cocina,'En preparación',listo);
      select version_pago,total into version_actual,importe from pedidos where id=pedido;
      perform finalizar_entrega_dividida(pedido,cocina,listo,version_actual,importe,0);
    elsif i=4 then
      perform cambiar_estado_pedido(pedido,cocina,'Pendiente','En preparación');
    elsif i=5 then
      perform cancelar_pedido_stock(pedido,cocina,'Pendiente','Cancelación solicitada en la demo',jsonb_build_array(jsonb_build_object('producto_id',empanada,'cantidad',1)));
    end if;
  end loop;
  insert into private.reglas_catalogo(emprendimiento_id,tipo,nombre,valor,activo,productos) values(cocina,'adicional','Queso extra',800,true,array[pizza]);
  insert into private.reglas_catalogo(emprendimiento_id,tipo,nombre,valor,activo,productos,inicio,fin) values(cocina,'promocion','Merienda de la casa',10,true,array[bebida],now()-interval '1 day',now()+interval '90 days');
end $demo$;
commit;
