begin;
create table public.direcciones_cliente (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 nombre text not null check(char_length(btrim(nombre)) between 1 and 60),
 direccion text not null check(char_length(btrim(direccion)) between 5 and 200),
 referencia text not null default '' check(char_length(referencia)<=300),
 latitud numeric(9,6) not null check(latitud between -90 and 90),
 longitud numeric(10,6) not null check(longitud between -180 and 180),
 predeterminada boolean not null default false
);
create unique index direccion_predeterminada_cliente on public.direcciones_cliente(usuario_id) where predeterminada;
create index direcciones_por_cliente on public.direcciones_cliente(usuario_id);
alter table public.direcciones_cliente enable row level security;
revoke all on public.direcciones_cliente from public,anon,authenticated;
grant select,insert,update,delete on public.direcciones_cliente to authenticated;
create policy direcciones_propias on public.direcciones_cliente for all to authenticated
 using (usuario_id=(select auth.uid()) and exists(select 1 from public.cuentas_acceso where usuario_id=(select auth.uid()) and rol='cliente' and habilitada))
 with check (usuario_id=(select auth.uid()) and exists(select 1 from public.cuentas_acceso where usuario_id=(select auth.uid()) and rol='cliente' and habilitada));
create function public.guardar_direccion_cliente(p_datos jsonb) returns public.direcciones_cliente
language plpgsql security invoker set search_path='' as $$
declare resultado public.direcciones_cliente; v_id uuid:=coalesce((p_datos->>'id')::uuid,gen_random_uuid());
begin
 if auth.uid() is null then raise exception 'Ingresá con tu cuenta Cliente.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,412));
 if coalesce((p_datos->>'predeterminada')::boolean,false) then
  update public.direcciones_cliente set predeterminada=false where usuario_id=auth.uid() and predeterminada;
 end if;
 if p_datos->>'id' is not null then
  update public.direcciones_cliente set nombre=btrim(p_datos->>'nombre'),direccion=btrim(p_datos->>'direccion'),
   referencia=coalesce(p_datos->>'referencia',''),latitud=(p_datos->>'latitud')::numeric,longitud=(p_datos->>'longitud')::numeric,
   predeterminada=coalesce((p_datos->>'predeterminada')::boolean,false) where id=v_id and usuario_id=auth.uid() returning * into resultado;
  if not found then raise exception 'La dirección ya no está disponible.' using errcode='22023'; end if;
 else
  insert into public.direcciones_cliente(id,nombre,direccion,referencia,latitud,longitud,predeterminada)
   values(v_id,btrim(p_datos->>'nombre'),btrim(p_datos->>'direccion'),coalesce(p_datos->>'referencia',''),
   (p_datos->>'latitud')::numeric,(p_datos->>'longitud')::numeric,coalesce((p_datos->>'predeterminada')::boolean,false)) returning * into resultado;
 end if;
 return resultado;
end;$$;
revoke all on function public.guardar_direccion_cliente(jsonb) from public,anon;
grant execute on function public.guardar_direccion_cliente(jsonb) to authenticated;
create function private.zonas_validas(zonas jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare z jsonb; otra jsonb; i integer; j integer; n integer;
begin
 if jsonb_typeof(zonas) is distinct from 'array' then return false; end if;
 n:=jsonb_array_length(zonas);
 if n not between 1 and 20 then return false; end if;
 for i in 0..n-1 loop
  z:=zonas->i;
  if jsonb_typeof(z->'nombre') is distinct from 'string' or char_length(btrim(z->>'nombre')) not between 1 and 60
   or jsonb_typeof(z->'tarifa_centavos') is distinct from 'number' or coalesce(z->>'tarifa_centavos','') !~ '^[0-9]{1,9}$' then return false; end if;
  if jsonb_typeof(z->'sur') is distinct from 'number' or jsonb_typeof(z->'norte') is distinct from 'number'
   or jsonb_typeof(z->'oeste') is distinct from 'number' or jsonb_typeof(z->'este') is distinct from 'number' then return false; end if;
  if not ((z->>'sur')::numeric >= -90 and (z->>'norte')::numeric <=90 and (z->>'sur')::numeric < (z->>'norte')::numeric
   and (z->>'oeste')::numeric >= -180 and (z->>'este')::numeric <=180 and (z->>'oeste')::numeric < (z->>'este')::numeric) then return false; end if;
  for j in 0..i-1 loop
   otra:=zonas->j;
   if (z->>'sur')::numeric < (otra->>'norte')::numeric and (z->>'norte')::numeric > (otra->>'sur')::numeric
    and (z->>'oeste')::numeric < (otra->>'este')::numeric and (z->>'este')::numeric > (otra->>'oeste')::numeric then return false; end if;
  end loop;
 end loop;
 return true;
end;$$;
revoke all on function private.zonas_validas(jsonb) from public;
grant execute on function private.zonas_validas(jsonb) to authenticated,service_role;
alter table public.configuracion_entregas add column modalidad text not null default 'radio' check(modalidad in ('radio','zonas'));
alter table public.configuracion_entregas add column zonas jsonb not null default '[]';
alter table public.configuracion_entregas drop constraint configuracion_entregas_franjas_check;
alter table public.configuracion_entregas add constraint cobertura_valida check(
 (modalidad='radio' and private.franjas_validas(franjas)) or
 (modalidad='zonas' and private.zonas_validas(zonas)));
create or replace function public.cotizar_entrega(p_negocio bigint,p_lat numeric,p_lng numeric) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare c public.configuracion_entregas%rowtype; d numeric; f jsonb; previo integer:=0; numero integer:=0; a double precision;
begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then
  raise exception 'Seleccioná un punto válido en el mapa.' using errcode='22023'; end if;
 p_lat:=round(p_lat,6);p_lng:=round(p_lng,6);
 select ce.* into c from public.configuracion_entregas ce join public.emprendimientos e on e.id=ce.emprendimiento_id where ce.emprendimiento_id=p_negocio and e.activo;
 if not found then raise exception 'El emprendimiento todavía no configuró sus entregas. Elegí retiro o consultá al negocio.' using errcode='22023'; end if;
 a:=power(sin(radians((p_lat-c.latitud)::double precision)/2),2)
  +cos(radians(c.latitud::double precision))*cos(radians(p_lat::double precision))*power(sin(radians((p_lng-c.longitud)::double precision)/2),2);
 d:=round((6371008.8*2*asin(sqrt(least(1,greatest(0,a)))))::numeric,2);
 if c.modalidad='zonas' then
  for f in select value from jsonb_array_elements(c.zonas) loop
   if p_lat >= (f->>'sur')::numeric and p_lat < (f->>'norte')::numeric
    and p_lng >= (f->>'oeste')::numeric and p_lng < (f->>'este')::numeric then
    return jsonb_build_object('distancia_m',d,'costo_centavos',(f->>'tarifa_centavos')::bigint,
     'franja',f->>'nombre','modalidad_tarifa','zonas','zona',f,'version',c.version,
     'origen',jsonb_build_object('direccion',c.direccion_origen,'latitud',c.latitud,'longitud',c.longitud));
   end if;
  end loop;
  raise exception 'El punto está fuera de las zonas de entrega. Elegí otra dirección o retiro.' using errcode='22023';
 end if;
 for f in select value from jsonb_array_elements(c.franjas) loop
  numero:=numero+1;
  if d<=(f->>'hasta_m')::integer then
   return jsonb_build_object('distancia_m',d,'costo_centavos',(f->>'tarifa_centavos')::bigint,
    'franja','Franja '||numero,'desde_m',previo,'hasta_m',(f->>'hasta_m')::integer,'version',c.version,
    'origen',jsonb_build_object('direccion',c.direccion_origen,'latitud',c.latitud,'longitud',c.longitud));
  end if;
  previo:=(f->>'hasta_m')::integer;
 end loop;
 raise exception 'El punto está fuera de la cobertura. Contactá al emprendimiento o elegí retiro.' using errcode='22023';
end;$$;
revoke all on function public.cotizar_entrega(bigint,numeric,numeric) from public;
grant execute on function public.cotizar_entrega(bigint,numeric,numeric) to anon,authenticated,service_role;

commit;
