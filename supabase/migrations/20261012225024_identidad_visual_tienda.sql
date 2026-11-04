BEGIN;
SET local check_function_bodies = off;

ALTER TABLE "public"."permisos_miembro"
  DROP CONSTRAINT "permisos_miembro_permiso_check";

CREATE TABLE "public"."apariencias_tienda" (
  "emprendimiento_id" bigint                   NOT NULL,
  "borrador"          jsonb
    NOT NULL DEFAULT
    '{"logo_path": null, "color_fondo": "#faf8f4", "portada_path": null, "presentacion": "cuadricula", "color_principal": "#9f2144", "orden_productos": []}'::jsonb,
  "publicada"         jsonb,
  "version"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "fecha_publicacion" timestamp with time zone,
  CONSTRAINT "apariencias_tienda_pkey" PRIMARY KEY (emprendimiento_id)
);

ALTER TABLE "public"."apariencias_tienda"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.apariencia_publicada (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 SELECT a.publicada FROM public.apariencias_tienda a JOIN public.emprendimientos e ON e.id=a.emprendimiento_id WHERE e.id=p_negocio AND e.activo;
$function$;

CREATE OR REPLACE FUNCTION private.guardar_apariencia (
  p_negocio   bigint,
  p_version   uuid,
  p_identidad jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE a public.apariencias_tienda; ruta text; clave text; lp double precision; lf double precision;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'tienda.configurar') THEN RAISE EXCEPTION 'No tenés permiso para configurar esta tienda.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_identidad) IS DISTINCT FROM 'object' OR octet_length(p_identidad::text)>3000 THEN RAISE EXCEPTION 'Configuración inválida.' USING ERRCODE='22023'; END IF;
 lp:=private.luminancia_tienda(p_identidad->>'color_principal');lf:=private.luminancia_tienda(p_identidad->>'color_fondo');
 IF lp IS NULL OR lf IS NULL OR 1.05/(lp+0.05)<4.5 OR (lf+0.05)/(lp+0.05)<4.5 OR (lf+0.05)/(private.luminancia_tienda('#74675e')+0.05)<4.5 THEN RAISE EXCEPTION 'Elegí un color principal oscuro y un fondo claro que mantengan el texto legible.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('apariencia:'||p_negocio::text,0));
 SELECT * INTO a FROM public.apariencias_tienda WHERE emprendimiento_id=p_negocio FOR UPDATE;
 IF (FOUND AND a.version IS DISTINCT FROM p_version) OR (NOT FOUND AND p_version IS NOT NULL) THEN RAISE EXCEPTION 'La configuración cambió. Volvé a cargarla antes de guardar.' USING ERRCODE='PT409'; END IF;
 FOREACH clave IN ARRAY ARRAY['logo_path','portada_path'] LOOP
  IF NOT p_identidad ? clave OR jsonb_typeof(p_identidad->clave) NOT IN ('string','null') THEN RAISE EXCEPTION 'Imagen inválida.' USING ERRCODE='22023'; END IF;
  ruta:=p_identidad->>clave;
  IF ruta IS NOT NULL THEN
   IF private.negocio_de_imagen(ruta) IS DISTINCT FROM p_negocio OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='tiendas' AND name=ruta) THEN RAISE EXCEPTION 'La imagen debe existir y pertenecer a esta tienda.' USING ERRCODE='22023'; END IF;
  END IF;
 END LOOP;
 INSERT INTO public.apariencias_tienda(emprendimiento_id) VALUES(p_negocio) ON CONFLICT DO NOTHING;
 UPDATE public.apariencias_tienda SET borrador=borrador||jsonb_build_object('logo_path',p_identidad->'logo_path','portada_path',p_identidad->'portada_path','color_principal',lower(p_identidad->>'color_principal'),'color_fondo',lower(p_identidad->>'color_fondo')),version=gen_random_uuid() WHERE emprendimiento_id=p_negocio RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $function$;

CREATE OR REPLACE FUNCTION private.imagen_tienda_publicada (
  p_ruta text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 SELECT EXISTS(SELECT 1 FROM public.apariencias_tienda a JOIN public.emprendimientos e ON e.id=a.emprendimiento_id WHERE e.activo AND (a.publicada->>'logo_path'=p_ruta OR a.publicada->>'portada_path'=p_ruta));
$function$;

CREATE OR REPLACE FUNCTION private.luminancia_tienda (
  p_color text
)
  RETURNS double precision
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
DECLARE r double precision; g double precision; b double precision; bytes bytea;
BEGIN
 IF p_color IS NULL OR p_color!~'^#[0-9a-fA-F]{6}$' THEN RETURN NULL; END IF;
 bytes:=decode(substr(p_color,2),'hex');
 r:=get_byte(bytes,0)/255.0;g:=get_byte(bytes,1)/255.0;b:=get_byte(bytes,2)/255.0;
 r:=CASE WHEN r<=0.04045 THEN r/12.92 ELSE power((r+0.055)/1.055,2.4) END;
 g:=CASE WHEN g<=0.04045 THEN g/12.92 ELSE power((g+0.055)/1.055,2.4) END;
 b:=CASE WHEN b<=0.04045 THEN b/12.92 ELSE power((b+0.055)/1.055,2.4) END;
 RETURN 0.2126*r+0.7152*g+0.0722*b;
END; $function$;

CREATE OR REPLACE FUNCTION private.publicar_apariencia (
  p_negocio bigint,
  p_version uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE a public.apariencias_tienda;
BEGIN
 IF auth.uid() IS NULL OR NOT private.tiene_permiso(p_negocio,'tienda.configurar') THEN RAISE EXCEPTION 'No tenés permiso para publicar esta tienda.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('apariencia:'||p_negocio::text,0));
 SELECT * INTO a FROM public.apariencias_tienda WHERE emprendimiento_id=p_negocio FOR UPDATE;
 IF NOT FOUND OR p_version IS NULL OR a.version<>p_version THEN RAISE EXCEPTION 'La configuración cambió. Volvé a cargarla antes de publicar.' USING ERRCODE='PT409'; END IF;
 UPDATE public.apariencias_tienda SET publicada=borrador,fecha_publicacion=clock_timestamp(),version=gen_random_uuid() WHERE emprendimiento_id=p_negocio RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $function$;

CREATE OR REPLACE FUNCTION public.apariencia_publicada (
  p_negocio bigint
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.apariencia_publicada(p_negocio); $function$;

CREATE OR REPLACE FUNCTION public.guardar_apariencia (
  p_negocio   bigint,
  p_version   uuid,
  p_identidad jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.guardar_apariencia(p_negocio,p_version,p_identidad); $function$;



CREATE OR REPLACE FUNCTION public.publicar_apariencia (
  p_negocio bigint,
  p_version uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ SELECT private.publicar_apariencia(p_negocio,p_version); $function$;



ALTER TABLE "public"."apariencias_tienda"
  ADD CONSTRAINT "apariencias_tienda_emprendimiento_id_fkey" FOREIGN KEY (emprendimiento_id) REFERENCES public.emprendimientos(id) ON DELETE CASCADE;

ALTER TABLE "public"."permisos_miembro"
  ADD CONSTRAINT "permisos_miembro_permiso_check"
    CHECK
    ((permiso = ANY (ARRAY['productos.ver'::text, 'productos.crear'::text, 'productos.editar'::text, 'productos.publicar'::text, 'pedidos.ver'::text,
    'pedidos.actualizar_estado'::text,
    'pedidos.registrar_pago'::text,
    'clientes.ver'::text, 'clientes.editar'::text, 'entregas.configurar'::text, 'stock.ver'::text, 'stock.registrar'::text, 'tienda.configurar'::text])));

CREATE POLICY "apariencia_interna" ON "public"."apariencias_tienda"
  FOR SELECT
  TO "authenticated"
  USING (private.tiene_permiso(emprendimiento_id, 'tienda.configurar'::text));

CREATE POLICY "tienda_imagen_alta" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'tiendas'::text) AND (private.negocio_de_imagen(name) IS
    NOT NULL) AND private.tiene_permiso(private.negocio_de_imagen(name), 'tienda.configurar'::text)));

CREATE POLICY "tienda_imagen_interna" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'tiendas'::text) AND private.tiene_permiso(private.negocio_de_imagen(name), 'tienda.configurar'::text)));

CREATE POLICY "tienda_imagen_publica" ON "storage"."objects"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((bucket_id = 'tiendas'::text) AND private.imagen_tienda_publicada(name)));

REVOKE ALL ON FUNCTION "private"."apariencia_publicada"(bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."apariencia_publicada"(bigint) TO "anon", "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."guardar_apariencia"(bigint, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."guardar_apariencia"(bigint, uuid, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."imagen_tienda_publicada"(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."imagen_tienda_publicada"(text) TO "anon", "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."luminancia_tienda"(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."luminancia_tienda"(text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."publicar_apariencia"(bigint, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "private"."publicar_apariencia"(bigint, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."apariencia_publicada"(bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "public"."apariencia_publicada"(bigint) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."guardar_apariencia"(bigint, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "public"."guardar_apariencia"(bigint, uuid, jsonb) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."publicar_apariencia"(bigint, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "public"."publicar_apariencia"(bigint, uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."apariencias_tienda" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."apariencias_tienda" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."apariencias_tienda" TO "postgres", "service_role";


INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('tiendas','tiendas',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
COMMIT;
