begin;
alter table public.permisos_miembro drop constraint permisos_miembro_permiso_check;
alter table public.permisos_miembro add constraint permisos_miembro_permiso_check check (
 permiso in ('productos.ver','productos.crear','productos.editar','productos.publicar','pedidos.ver')
);
drop policy pedidos_lectura_admin on public.pedidos;
drop policy detalles_lectura_admin on public.detalles_pedido;
create policy pedidos_lectura_permiso on public.pedidos for select to authenticated
 using(private.tiene_permiso(emprendimiento_id,'pedidos.ver'));
create policy detalles_lectura_permiso on public.detalles_pedido for select to authenticated
 using(exists(select 1 from public.pedidos p where p.id=pedido_id));
-- Las políticas de pedidos aplican también a la lectura directa de sus detalles.
-- No se conceden permisos nuevos a miembros existentes ni facultades de escritura.
commit;
