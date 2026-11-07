begin;
create function private.mi_pedido_habitual(p_negocio bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare n integer; filas jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.cuentas_acceso where usuario_id=auth.uid() and rol='cliente' and habilitada) then
 raise exception 'Necesitás una cuenta Cliente habilitada.' using errcode='42501'; end if;
 if not exists(select 1 from public.emprendimientos where id=p_negocio and activo) then
 raise exception 'La tienda no está disponible.' using errcode='PT404'; end if;
 select count(*) into n from (select id from public.pedidos where emprendimiento_id=p_negocio and cliente_usuario_id=auth.uid() and estado<>'Cancelado' order by fecha_creacion desc,id desc limit 20) h;
 if n<3 then return jsonb_build_object('pedidos',n,'minimo',3,'items','[]'::jsonb); end if;
 with historial as (
 select id,fecha_creacion from public.pedidos where emprendimiento_id=p_negocio and cliente_usuario_id=auth.uid() and estado<>'Cancelado' order by fecha_creacion desc,id desc limit 20
 ), cantidades as (
 select d.producto_id,d.cantidad,count(*) veces,max(h.fecha_creacion) ultima from historial h join public.detalles_pedido d on d.pedido_id=h.id group by d.producto_id,d.cantidad
 ), habituales as (
 select *,sum(veces) over(partition by producto_id) recurrencia,row_number() over(partition by producto_id order by veces desc,ultima desc,cantidad) posicion from cantidades
 ) select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'cantidad',h.cantidad,'veces',h.recurrencia,
 'precioCentavos',op.precio_centavos,'disponible',op.producto_id is not null and private.disponibilidad_producto(p_negocio,p.id)>=h.cantidad)
 order by h.recurrencia desc,p.nombre,p.id),'[]'::jsonb) into filas
 from habituales h join public.productos p on p.id=h.producto_id and p.emprendimiento_id=p_negocio
 left join private.opciones_catalogo(p_negocio) op on op.producto_id=p.id
 where h.posicion=1 and h.recurrencia>n/2;
 return jsonb_build_object('pedidos',n,'minimo',3,'items',filas);
end $$;
create function public.mi_pedido_habitual(p_negocio bigint) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.mi_pedido_habitual(p_negocio) $$;
revoke all on function private.mi_pedido_habitual(bigint),public.mi_pedido_habitual(bigint) from public,anon;
grant execute on function private.mi_pedido_habitual(bigint),public.mi_pedido_habitual(bigint) to authenticated;
commit;
