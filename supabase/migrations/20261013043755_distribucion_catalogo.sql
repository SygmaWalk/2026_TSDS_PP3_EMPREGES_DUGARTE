BEGIN;
SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.catalogo_configurable (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'tienda.configurar') THEN RAISE EXCEPTION 'No tenés permiso para configurar esta tienda.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'visible',visible) ORDER BY id),'[]'::jsonb) FROM public.productos WHERE emprendimiento_id=p_negocio);
END; $function$;

CREATE OR REPLACE FUNCTION private.guardar_configuracion_tienda (
  p_negocio      bigint,
  p_version      uuid,
  p_identidad    jsonb,
  p_distribucion jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE a public.apariencias_tienda; ids bigint[]; item jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'tienda.configurar') THEN RAISE EXCEPTION 'No tenés permiso para configurar esta tienda.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_distribucion) IS DISTINCT FROM 'object' OR octet_length(p_distribucion::text)>100000 OR coalesce(p_distribucion->>'presentacion','') NOT IN ('lista','cuadricula') OR jsonb_typeof(p_distribucion->'orden_productos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Distribución inválida.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_distribucion->'orden_productos')>5000 THEN RAISE EXCEPTION 'Demasiados productos en el orden.' USING ERRCODE='22023'; END IF;
 ids:=ARRAY[]::bigint[];
 FOR item IN SELECT value FROM jsonb_array_elements(p_distribucion->'orden_productos') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'number' OR item::text !~ '^[1-9][0-9]{0,14}$' THEN RAISE EXCEPTION 'Identificador de producto inválido.' USING ERRCODE='22023'; END IF;
  ids:=array_append(ids,(item::text)::bigint);
 END LOOP;
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) OR EXISTS(SELECT 1 FROM unnest(ids) x WHERE NOT EXISTS(SELECT 1 FROM public.productos p WHERE p.id=x AND p.emprendimiento_id=p_negocio)) THEN RAISE EXCEPTION 'El orden contiene productos repetidos, eliminados o de otra tienda. Recargá el borrador.' USING ERRCODE='22023'; END IF;
 -- Reutiliza autorización, bloqueo y control de versión; todo se revierte si falla.
 PERFORM private.guardar_apariencia(p_negocio,p_version,p_identidad);
 UPDATE public.apariencias_tienda SET borrador=borrador||jsonb_build_object('presentacion',p_distribucion->>'presentacion','orden_productos',to_jsonb(ids)) WHERE emprendimiento_id=p_negocio RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $function$;

CREATE OR REPLACE FUNCTION public.catalogo_configurable (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.catalogo_configurable(p_negocio); $function$;

CREATE OR REPLACE FUNCTION public.guardar_configuracion_tienda (
  p_negocio      bigint,
  p_version      uuid,
  p_identidad    jsonb,
  p_distribucion jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.guardar_configuracion_tienda(p_negocio,p_version,p_identidad,p_distribucion); $function$;





REVOKE ALL ON FUNCTION "private"."catalogo_configurable"(bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."catalogo_configurable"(bigint) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."guardar_configuracion_tienda"(bigint, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."guardar_configuracion_tienda"(bigint, uuid, jsonb, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."catalogo_configurable"(bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "public"."catalogo_configurable"(bigint) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."guardar_configuracion_tienda"(bigint, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "public"."guardar_configuracion_tienda"(bigint, uuid, jsonb, jsonb) TO "authenticated", "postgres", "service_role";


COMMIT;
