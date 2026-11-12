begin;
alter table public.permisos_miembro drop constraint permisos_miembro_permiso_check;
alter table public.permisos_miembro add constraint permisos_miembro_permiso_check check(permiso in ('productos.ver','productos.crear','productos.editar','productos.publicar','pedidos.ver','pedidos.actualizar_estado','pedidos.modificar','pedidos.registrar_pago','clientes.ver','clientes.editar','entregas.configurar','stock.ver','stock.registrar','tienda.configurar'));
CREATE OR REPLACE FUNCTION private.administracion_guardar_cuenta (
  p_usuario      uuid,
  p_habilitada   boolean,
  p_interna      boolean,
  p_asociaciones jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_rol text; v_asoc jsonb; v_negocio bigint; v_permisos text[];
begin
 if auth.uid() is null or not private.es_administrador() then raise exception 'Solo el administrador puede modificar cuentas' using errcode='42501'; end if;
 select rol into v_rol from public.cuentas_acceso where usuario_id=p_usuario for update;
 if not found then raise exception 'Cuenta no encontrada' using errcode='22023'; end if;
 if v_rol='administrador' or p_usuario=auth.uid() then raise exception 'Las cuentas administradoras no se modifican desde este panel' using errcode='42501'; end if;
 if p_habilitada is null or p_interna is null or p_asociaciones is null or jsonb_typeof(p_asociaciones)<>'array' then raise exception 'Datos de cuenta inválidos' using errcode='22023'; end if;
 if jsonb_array_length(p_asociaciones)>100 or (not p_interna and jsonb_array_length(p_asociaciones)>0) then raise exception 'Asociaciones inválidas' using errcode='22023'; end if;
 if (select count(*)<>count(distinct x->>'emprendimiento_id') from jsonb_array_elements(p_asociaciones) x) then raise exception 'Emprendimiento repetido' using errcode='22023'; end if;
 -- La transacción reemplaza la configuración completa o no modifica nada.
 update public.cuentas_acceso set habilitada=p_habilitada,rol=case when p_interna then 'emprendimiento' else 'cliente' end where usuario_id=p_usuario;
 delete from public.miembros_emprendimiento where usuario_id=p_usuario;
 for v_asoc in select * from jsonb_array_elements(p_asociaciones) loop
  v_negocio:=(v_asoc->>'emprendimiento_id')::bigint;
  if not exists(select 1 from public.emprendimientos where id=v_negocio) or jsonb_typeof(v_asoc->'permisos') is distinct from 'array' or jsonb_typeof(v_asoc->'habilitada') is distinct from 'boolean' then raise exception 'Asociación inválida' using errcode='22023'; end if;
  select coalesce(array_agg(distinct p),'{}'::text[]) into v_permisos from jsonb_array_elements_text(v_asoc->'permisos') p;
  if exists(select 1 from unnest(v_permisos) p where p is null or p<>all(array['productos.ver','productos.crear','productos.editar','productos.publicar','pedidos.ver','pedidos.actualizar_estado','pedidos.modificar','pedidos.registrar_pago','clientes.ver','clientes.editar','entregas.configurar','stock.ver','stock.registrar','tienda.configurar'])) then raise exception 'Permiso desconocido' using errcode='22023'; end if;
  if (v_permisos && array['productos.crear','productos.editar','productos.publicar'] and not 'productos.ver'=any(v_permisos))
  or (v_permisos && array['pedidos.actualizar_estado','pedidos.modificar','pedidos.registrar_pago'] and not 'pedidos.ver'=any(v_permisos))
  or ('clientes.editar'=any(v_permisos) and not 'clientes.ver'=any(v_permisos))
  or ('stock.registrar'=any(v_permisos) and not 'stock.ver'=any(v_permisos)) then raise exception 'Seleccioná también el permiso de consulta correspondiente' using errcode='22023'; end if;
  insert into public.miembros_emprendimiento(emprendimiento_id,usuario_id,habilitada) values(v_negocio,p_usuario,(v_asoc->>'habilitada')::boolean);
  insert into public.permisos_miembro(emprendimiento_id,usuario_id,permiso) select v_negocio,p_usuario,unnest(v_permisos);
 end loop;
end $function$;


alter table public.pedidos add column revision uuid not null default gen_random_uuid();
create function private.actualizar_revision_pedido() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=gen_random_uuid(); return new; end;$$;
revoke all on function private.actualizar_revision_pedido() from public,anon,authenticated;
create trigger actualizar_revision_pedido before update on public.pedidos for each row execute function private.actualizar_revision_pedido();
create table public.modificaciones_pedido(
 id bigint generated always as identity primary key,
 pedido_id bigint not null,
 emprendimiento_id bigint not null,
 usuario_id uuid references auth.users(id) on delete set null,
 fecha timestamptz not null default clock_timestamp(),
 motivo text not null check(char_length(btrim(motivo)) between 1 and 500),
 anterior jsonb not null,
 nuevo jsonb not null,
 clave uuid not null,
 solicitud text not null,
 respuesta jsonb not null,
 foreign key(pedido_id,emprendimiento_id) references public.pedidos(id,emprendimiento_id) on delete cascade,
 unique(pedido_id,clave)
);
create index modificaciones_por_negocio on public.modificaciones_pedido(emprendimiento_id);
create index modificaciones_por_usuario on public.modificaciones_pedido(usuario_id);
alter table public.modificaciones_pedido enable row level security;
revoke all on public.modificaciones_pedido from public,anon,authenticated;
grant select on public.modificaciones_pedido to authenticated;
grant all on public.modificaciones_pedido to service_role;
create policy modificaciones_lectura on public.modificaciones_pedido for select to authenticated using(private.tiene_permiso(emprendimiento_id,'pedidos.ver'));
-- Cada venta/devolución original sigue siendo única; cada edición tiene su propia clave.
alter table public.movimientos_stock add column edicion_clave uuid;
alter table public.movimientos_stock add constraint movimiento_edicion_con_pedido check(edicion_clave is null or pedido_id is not null);
alter table public.movimientos_stock add constraint movimiento_edicion_fk foreign key(pedido_id,edicion_clave) references public.modificaciones_pedido(pedido_id,clave) deferrable initially deferred;
drop index public.movimientos_pedido_unico_idx;
create unique index movimientos_pedido_unico_idx on public.movimientos_stock(pedido_id,producto_id,tipo) where pedido_id is not null and edicion_clave is null;
create unique index movimientos_edicion_unica on public.movimientos_stock(pedido_id,edicion_clave,producto_id) where edicion_clave is not null;
create function private.modificar_pedido(p_negocio bigint,p_pedido bigint,p_revision uuid,p_clave uuid,p_items jsonb,p_entrega jsonb,p_motivo text,p_devolver boolean,p_guardar boolean,p_huella text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
<<edicion>>
declare actual public.pedidos%rowtype; previo public.modificaciones_pedido%rowtype;
 item jsonb; prod public.productos%rowtype; op record; seleccion jsonb; extras jsonb; unitario bigint;
 ids bigint[]:='{}'; detalles jsonb:='[]'; necesidades jsonb; movimientos jsonb:='[]'; anterior jsonb; nuevo jsonb; entrega jsonb; cotizacion jsonb;
 subtotal numeric:=0; costo numeric:=0; saldo numeric; diferencia numeric; descartado numeric; cambio record; resumen jsonb; huella text; solicitud text;
begin
 if auth.uid() is null or not private.tiene_permiso(p_negocio,'pedidos.ver') or not private.tiene_permiso(p_negocio,'pedidos.modificar') then raise exception 'No tenés permiso para modificar pedidos de este emprendimiento.' using errcode='42501'; end if;
 if p_clave is null or p_revision is null or p_guardar is null or p_devolver is null or p_motivo is null or char_length(btrim(p_motivo)) not between 1 and 500
  or jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text)>30000 or jsonb_typeof(p_entrega) is distinct from 'object' or octet_length(p_entrega::text)>6000 then raise exception 'Revisá el motivo, los productos y la entrega.' using errcode='22023'; end if;
 if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'El pedido debe contener entre 1 y 100 productos.' using errcode='22023'; end if;
 select * into actual from public.pedidos where id=p_pedido and emprendimiento_id=p_negocio for update;
 if not found then raise exception 'Pedido no disponible.' using errcode='PT404'; end if;
 solicitud:=encode(sha256(convert_to(jsonb_build_object('usuario',auth.uid(),'revision',p_revision,'items',p_items,'entrega',p_entrega,'motivo',btrim(p_motivo),'devolver',p_devolver,'huella',p_huella)::text,'UTF8')),'hex');
 if p_guardar then
  select * into previo from public.modificaciones_pedido where pedido_id=p_pedido and clave=p_clave;
  if found then
   if previo.solicitud<>solicitud then raise exception 'Este intento ya se usó con otros datos.' using errcode='PT409'; end if;
   return previo.respuesta;
  end if;
 end if;
 if actual.revision<>p_revision then raise exception 'El pedido cambió. Cerrá la edición y revisá la versión actual.' using errcode='PT409'; end if;
 if actual.estado not in ('Pendiente','En preparación') or actual.estado_pago='Pagado' or actual.pago_efectivo<>0 or actual.pago_transferencia<>0 or actual.fecha_pago is not null then raise exception 'Solo se editan pedidos pendientes o en preparación, sin pagos registrados.' using errcode='22023'; end if;
 perform 1 from public.emprendimientos where id=p_negocio and activo for share;
 if not found then raise exception 'El emprendimiento no está activo.' using errcode='22023'; end if;
 if coalesce(p_entrega->>'modalidad','') not in ('retiro','envio') then raise exception 'Elegí retiro o envío.' using errcode='22023'; end if;
 if p_entrega->>'modalidad'='envio' then
  if jsonb_typeof(p_entrega->'direccion') is distinct from 'string' or char_length(btrim(p_entrega->>'direccion')) not between 5 and 200
   or coalesce(char_length(p_entrega->>'referencia'),0)>300 or jsonb_typeof(p_entrega->'latitud') is distinct from 'number' or jsonb_typeof(p_entrega->'longitud') is distinct from 'number' then raise exception 'Completá dirección y ubicación de entrega.' using errcode='22023'; end if;
  perform 1 from public.configuracion_entregas where emprendimiento_id=p_negocio for share;
  cotizacion:=public.cotizar_entrega(p_negocio,(p_entrega->>'latitud')::numeric,(p_entrega->>'longitud')::numeric);
  costo:=(cotizacion->>'costo_centavos')::numeric/100;
  entrega:=cotizacion||jsonb_build_object('modalidad','envio','direccion',btrim(p_entrega->>'direccion'),'referencia',coalesce(p_entrega->>'referencia',''),'latitud',round((p_entrega->>'latitud')::numeric,6),'longitud',round((p_entrega->>'longitud')::numeric,6));
 else entrega:=jsonb_build_object('modalidad','retiro','costo_centavos',0); end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('catalogo:'||p_negocio::text,0));
 perform pg_advisory_xact_lock(hashtextextended('stock:'||p_negocio::text,0));
 perform 1 from public.productos where emprendimiento_id=p_negocio order by id for update;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'producto_id','') !~ '^[1-9][0-9]{0,15}$' or coalesce(item->>'cantidad','') !~ '^[1-9][0-9]{0,2}$' then raise exception 'Revisá productos y cantidades: entre 1 y 999 unidades.' using errcode='22023'; end if;
  if (item->>'producto_id')::bigint=any(ids) then raise exception 'No repitas el mismo producto en dos líneas.' using errcode='22023'; end if;
  ids:=array_append(ids,(item->>'producto_id')::bigint);
  select * into prod from public.productos where id=(item->>'producto_id')::bigint and emprendimiento_id=p_negocio and visible and not archivado;
  if not found then raise exception 'Un producto ya no está disponible. Quitalo o reemplazalo.' using errcode='22023'; end if;
  select * into op from private.opciones_catalogo(p_negocio) where producto_id=prod.id;
  if not found then raise exception 'Un producto ya no está disponible.' using errcode='22023'; end if;
  seleccion:=coalesce(item->'adicionales','[]'::jsonb);
  if jsonb_typeof(seleccion) is distinct from 'array' then raise exception 'Adicionales inválidos.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(a order by (a->>'id')::bigint),'[]'),op.precio_centavos+coalesce(sum((a->>'centavos')::bigint),0)
  into extras,unitario from jsonb_array_elements(op.adicionales) a where seleccion @> jsonb_build_array(a->'id');
  if jsonb_array_length(extras)<>jsonb_array_length(seleccion) then raise exception 'Un adicional ya no está disponible. Revisá la selección.' using errcode='22023'; end if;
  subtotal:=subtotal+unitario::numeric*(item->>'cantidad')::integer/100;
  detalles:=detalles||jsonb_build_array(jsonb_build_object('producto_id',prod.id,'nombre',prod.nombre,'cantidad',(item->>'cantidad')::integer,'precio_centavos',unitario,'adicionales',extras,'promocion',op.promocion));
 end loop;
 if subtotal+costo>999999999999.99 then raise exception 'El importe supera el límite permitido.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('producto_id',n.producto_id,'cantidad',n.cantidad,'nombre',n.nombre) order by n.producto_id),'[]') into necesidades from private.necesidades_stock(p_negocio,p_items) n;
 if jsonb_array_length(necesidades)=0 then raise exception 'El pedido no tiene componentes disponibles.' using errcode='22023'; end if;
 for cambio in
  with nuevos as(select (x->>'producto_id')::bigint id,(x->>'cantidad')::numeric cantidad,x->>'nombre' nombre from jsonb_array_elements(necesidades) x),
  anteriores as(select producto_id id,cantidad-cantidad_devuelta cantidad,nombre_producto nombre from public.consumos_stock_pedido where pedido_id=p_pedido and actual.stock_descontado)
  select coalesce(n.id,a.id) id,coalesce(n.nombre,a.nombre) nombre,coalesce(n.cantidad,0) nueva,coalesce(a.cantidad,0) vieja from nuevos n full join anteriores a using(id) order by coalesce(n.id,a.id)
 loop
  diferencia:=cambio.vieja-cambio.nueva;descartado:=0;
  if diferencia>0 and actual.estado='En preparación' and not p_devolver then descartado:=diferencia;diferencia:=0; end if;
  select coalesce(sum(cantidad),0) into saldo from public.movimientos_stock where emprendimiento_id=p_negocio and producto_id=cambio.id;
  if saldo+diferencia<0 or saldo+diferencia>999999999.999 or cambio.nueva>999999999.999 then raise exception 'Stock insuficiente o inválido de %. No se guardó ningún cambio.',cambio.nombre using errcode='22023'; end if;
  if diferencia<>0 or descartado<>0 then movimientos:=movimientos||jsonb_build_array(jsonb_build_object('producto_id',cambio.id,'nombre',cambio.nombre,'cantidad',diferencia,'sin_reintegrar',descartado)); end if;
 end loop;
 select jsonb_build_object('estado',actual.estado,'items',coalesce(jsonb_agg(jsonb_build_object('producto_id',d.producto_id,'nombre',d.nombre_producto,'cantidad',d.cantidad,'precio_centavos',(d.precio_unitario*100)::bigint,'adicionales',d.adicionales,'promocion',d.promocion) order by d.producto_id),'[]'),'subtotal_centavos',(actual.subtotal*100)::bigint,'costo_envio_centavos',(actual.costo_envio*100)::bigint,'total_centavos',(actual.total*100)::bigint,'entrega',actual.entrega) into anterior from public.detalles_pedido d where d.pedido_id=p_pedido;
 select jsonb_agg(x order by (x->>'producto_id')::bigint) into detalles from jsonb_array_elements(detalles) x;
 nuevo:=jsonb_build_object('estado',actual.estado,'items',detalles,'subtotal_centavos',(subtotal*100)::bigint,'costo_envio_centavos',(costo*100)::bigint,'total_centavos',((subtotal+costo)*100)::bigint,'entrega',entrega);
 if nuevo=anterior and movimientos='[]'::jsonb then raise exception 'No hay cambios para guardar.' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_object('revision',actual.revision,'nuevo',nuevo,'stock',movimientos)::text,'UTF8')),'hex');
 resumen:=jsonb_build_object('anterior',anterior,'nuevo',nuevo,'stock',movimientos,'huella',huella,'revision',actual.revision);
 if not p_guardar then return resumen; end if;
 if p_huella is null or p_huella<>huella then raise exception 'Cambiaron los precios, la entrega o el stock necesario. Revisá el resumen nuevamente.' using errcode='PT409'; end if;
 for item in select value from jsonb_array_elements(movimientos) loop
  if (item->>'cantidad')::numeric<>0 then
   insert into public.movimientos_stock(emprendimiento_id,producto_id,clave,tipo,cantidad,motivo,referencia,usuario_id,pedido_id,edicion_clave)
   values(p_negocio,(item->>'producto_id')::bigint,gen_random_uuid(),case when (item->>'cantidad')::numeric>0 then 'Devolución' else 'Venta' end,(item->>'cantidad')::numeric,'Modificación del pedido #'||p_pedido,'Edición de pedido #'||p_pedido,auth.uid(),p_pedido,p_clave);
  end if;
 end loop;
 delete from public.consumos_stock_pedido where pedido_id=p_pedido;
 insert into public.consumos_stock_pedido(pedido_id,emprendimiento_id,producto_id,nombre_producto,cantidad)
 select p_pedido,p_negocio,(x->>'producto_id')::bigint,x->>'nombre',(x->>'cantidad')::numeric from jsonb_array_elements(necesidades) x;
 delete from public.detalles_pedido where pedido_id=p_pedido;
 insert into public.detalles_pedido(pedido_id,producto_id,nombre_producto,precio_unitario,cantidad,adicionales,promocion)
 select p_pedido,(x->>'producto_id')::bigint,x->>'nombre',(x->>'precio_centavos')::numeric/100,(x->>'cantidad')::integer,x->'adicionales',nullif(x->'promocion','null'::jsonb) from jsonb_array_elements(detalles) x;
 update public.pedidos set subtotal=edicion.subtotal,costo_envio=costo,entrega=edicion.entrega,stock_descontado=true,version_pago=version_pago+1 where id=p_pedido returning * into actual;
 resumen:=resumen||jsonb_build_object('revision',actual.revision,'id',p_pedido);
 insert into public.modificaciones_pedido(pedido_id,emprendimiento_id,usuario_id,motivo,anterior,nuevo,clave,solicitud,respuesta)
 values(p_pedido,p_negocio,auth.uid(),btrim(p_motivo),anterior,nuevo,p_clave,solicitud,resumen);
 return resumen;
end;$$;
create function public.modificar_pedido(p_negocio bigint,p_pedido bigint,p_revision uuid,p_clave uuid,p_items jsonb,p_entrega jsonb,p_motivo text,p_devolver boolean,p_guardar boolean,p_huella text default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.modificar_pedido(p_negocio,p_pedido,p_revision,p_clave,p_items,p_entrega,p_motivo,p_devolver,p_guardar,p_huella) $$;
revoke all on function private.modificar_pedido(bigint,bigint,uuid,uuid,jsonb,jsonb,text,boolean,boolean,text),public.modificar_pedido(bigint,bigint,uuid,uuid,jsonb,jsonb,text,boolean,boolean,text) from public,anon;
grant execute on function private.modificar_pedido(bigint,bigint,uuid,uuid,jsonb,jsonb,text,boolean,boolean,text),public.modificar_pedido(bigint,bigint,uuid,uuid,jsonb,jsonb,text,boolean,boolean,text) to authenticated;
commit;
