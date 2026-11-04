SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.administracion_cuentas (
  p_busqueda text    DEFAULT ''::text,
  p_offset   integer DEFAULT 0
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_resultado jsonb;
begin
 if auth.uid() is null or not private.es_administrador() then raise exception 'Solo el administrador puede consultar cuentas' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or length(p_busqueda)>200 then raise exception 'Búsqueda inválida' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_resultado from (
 select c.usuario_id,u.email,c.rol,c.habilitada,
 coalesce((select jsonb_agg(jsonb_build_object('emprendimiento_id',m.emprendimiento_id,'habilitada',m.habilitada,'permisos',
 coalesce((select jsonb_agg(p.permiso order by p.permiso) from public.permisos_miembro p where p.usuario_id=m.usuario_id and p.emprendimiento_id=m.emprendimiento_id),'[]'::jsonb)) order by m.emprendimiento_id)
 from public.miembros_emprendimiento m where m.usuario_id=c.usuario_id),'[]'::jsonb) as asociaciones
 from public.cuentas_acceso c join auth.users u on u.id=c.usuario_id
 where strpos(lower(coalesce(u.email,'')),lower(coalesce(p_busqueda,'')))>0
 order by u.email,c.usuario_id limit 21 offset p_offset
 ) q;
 return v_resultado;
end $function$;

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
  if exists(select 1 from unnest(v_permisos) p where p is null or p<>all(array['productos.ver','productos.crear','productos.editar','productos.publicar','pedidos.ver','pedidos.actualizar_estado','pedidos.registrar_pago','clientes.ver','clientes.editar','entregas.configurar','stock.ver','stock.registrar','tienda.configurar'])) then raise exception 'Permiso desconocido' using errcode='22023'; end if;
  if (v_permisos && array['productos.crear','productos.editar','productos.publicar'] and not 'productos.ver'=any(v_permisos))
  or (v_permisos && array['pedidos.actualizar_estado','pedidos.registrar_pago'] and not 'pedidos.ver'=any(v_permisos))
  or ('clientes.editar'=any(v_permisos) and not 'clientes.ver'=any(v_permisos))
  or ('stock.registrar'=any(v_permisos) and not 'stock.ver'=any(v_permisos)) then raise exception 'Seleccioná también el permiso de consulta correspondiente' using errcode='22023'; end if;
  insert into public.miembros_emprendimiento(emprendimiento_id,usuario_id,habilitada) values(v_negocio,p_usuario,(v_asoc->>'habilitada')::boolean);
  insert into public.permisos_miembro(emprendimiento_id,usuario_id,permiso) select v_negocio,p_usuario,unnest(v_permisos);
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.administracion_cuentas (
  p_busqueda text    DEFAULT ''::text,
  p_offset   integer DEFAULT 0
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select private.administracion_cuentas(p_busqueda,p_offset)$function$;

CREATE OR REPLACE FUNCTION public.administracion_guardar_cuenta (
  p_usuario      uuid,
  p_habilitada   boolean,
  p_interna      boolean,
  p_asociaciones jsonb
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select private.administracion_guardar_cuenta(p_usuario,p_habilitada,p_interna,p_asociaciones)$function$;

REVOKE ALL ON FUNCTION "private"."administracion_cuentas"(text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."administracion_cuentas"(text, integer) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."administracion_guardar_cuenta"(uuid, boolean, boolean, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."administracion_guardar_cuenta"(uuid, boolean, boolean, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."administracion_cuentas"(text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."administracion_cuentas"(text, integer) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."administracion_guardar_cuenta"(uuid, boolean, boolean, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."administracion_guardar_cuenta"(uuid, boolean, boolean, jsonb) TO "authenticated", "postgres", "service_role";


REVOKE ALL ON FUNCTION public.administracion_cuentas(text,integer), public.administracion_guardar_cuenta(uuid,boolean,boolean,jsonb) FROM anon;
