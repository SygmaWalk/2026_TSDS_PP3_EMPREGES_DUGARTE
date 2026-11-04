begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('productos','productos',false,5242880,array['image/jpeg','image/png','image/webp']);

create function private.negocio_de_imagen(p_nombre text) returns bigint
language sql immutable security invoker set search_path='' as $$
 select case when p_nombre ~ '^[0-9]{1,18}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 then split_part(p_nombre,'/',1)::bigint else null end;
$$;
revoke all on function private.negocio_de_imagen(text) from public,anon;
grant execute on function private.negocio_de_imagen(text) to authenticated;

create index productos_imagen_path_idx on public.productos(imagen_path) where imagen_path is not null;

create policy imagenes_catalogo_publico on storage.objects for select to anon,authenticated
using(bucket_id='productos' and exists(
 select 1 from public.productos p join public.emprendimientos e on e.id=p.emprendimiento_id
 where p.imagen_path=storage.objects.name and p.visible and e.activo));

create policy imagenes_lectura_interna on storage.objects for select to authenticated
using(bucket_id='productos' and private.tiene_permiso(private.negocio_de_imagen(name),'productos.ver'));

create policy imagenes_alta on storage.objects for insert to authenticated
with check(bucket_id='productos' and private.negocio_de_imagen(name) is not null
 and private.tiene_permiso(private.negocio_de_imagen(name),'productos.ver')
 and (private.tiene_permiso(private.negocio_de_imagen(name),'productos.crear')
 or private.tiene_permiso(private.negocio_de_imagen(name),'productos.editar')));

-- Nunca se sobrescribe un objeto: cada reemplazo usa un nombre nuevo.
-- Solo se elimina cuando ya no está referenciado por un producto.
create policy imagenes_limpieza on storage.objects for delete to authenticated
using(bucket_id='productos'
 and private.tiene_permiso(private.negocio_de_imagen(name),'productos.ver')
 and (private.tiene_permiso(private.negocio_de_imagen(name),'productos.editar')
 or (owner_id=(select auth.uid())::text and private.tiene_permiso(private.negocio_de_imagen(name),'productos.crear')))
 and not exists(select 1 from public.productos p where p.imagen_path=storage.objects.name));

create function private.validar_imagen_producto() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.imagen_path is not distinct from old.imagen_path then return new; end if;
 end if;
 if new.imagen_path is not null then
  if new.imagen_path !~ ('^'||new.emprendimiento_id::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$')
   or not exists(select 1 from storage.objects where bucket_id='productos' and name=new.imagen_path) then
   raise exception 'La imagen debe existir y pertenecer al emprendimiento' using errcode='23514';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.validar_imagen_producto() from public,anon,authenticated;
create trigger productos_validar_imagen before insert or update of imagen_path on public.productos
 for each row execute function private.validar_imagen_producto();
commit;
