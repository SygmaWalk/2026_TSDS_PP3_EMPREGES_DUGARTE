begin;
-- El ejecutor remoto inicia con un rol temporal. Preparar fixtures como postgres.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-0000-0000-000000008001','editor-pgtap-membresias@example.test','{"rol":"administrador"}'),
('00000000-0000-0000-0000-000000008002','otro-pgtap-membresias@example.test','{}'),
('00000000-0000-0000-0000-000000008003','lector-pgtap-membresias@example.test','{}'),
('00000000-0000-0000-0000-000000008004','admin-pgtap-membresias@example.test','{}'),
('00000000-0000-0000-0000-000000008005','cliente-pgtap-membresias@example.test','{"rol":"administrador"}'),
('00000000-0000-0000-0000-000000008006','publicador-pgtap-membresias@example.test','{}');
select is((select rol from public.cuentas_acceso where usuario_id='00000000-0000-0000-0000-000000008005'),'cliente','Registro y metadata no conceden rol interno');
update public.cuentas_acceso set rol='emprendimiento' where usuario_id in ('00000000-0000-0000-0000-000000008001','00000000-0000-0000-0000-000000008002','00000000-0000-0000-0000-000000008003','00000000-0000-0000-0000-000000008006');
update public.cuentas_acceso set rol='administrador' where usuario_id='00000000-0000-0000-0000-000000008004';
insert into public.emprendimientos(id,nombre,slug) overriding system value values
(-98001,'Negocio A','permisos-negocio-a'),(-98002,'Negocio B','permisos-negocio-b');
insert into public.miembros_emprendimiento(emprendimiento_id,usuario_id) values
(-98001,'00000000-0000-0000-0000-000000008001'),(-98002,'00000000-0000-0000-0000-000000008002'),
(-98001,'00000000-0000-0000-0000-000000008003'),(-98001,'00000000-0000-0000-0000-000000008006');
insert into public.permisos_miembro select -98001,'00000000-0000-0000-0000-000000008001'::uuid,unnest(array['productos.ver','productos.crear','productos.editar','productos.publicar']);
insert into public.permisos_miembro values
(-98001,'00000000-0000-0000-0000-000000008003','productos.ver'),
(-98001,'00000000-0000-0000-0000-000000008006','productos.ver'),
(-98001,'00000000-0000-0000-0000-000000008006','productos.publicar');
insert into public.productos(id,emprendimiento_id,nombre,precio,visible) overriding system value values
(-98001,-98001,'Oculto A',100,false),(-98002,-98002,'Oculto B',100,false),(-98003,-98001,'Publico A',100,true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008001","role":"authenticated"}',true);
select is((select count(*) from public.miembros_emprendimiento),1::bigint,'Solo membresías propias');
select is((select count(*) from public.productos where id=-98001),1::bigint,'Permiso de lectura incluye ocultos');
select is((select count(*) from public.productos where id=-98002),0::bigint,'No ve ocultos ajenos');
select lives_ok($q$insert into public.productos(emprendimiento_id,nombre,precio) values(-98001,'Nuevo A',150)$q$,'Permiso de alta permite crear');
select throws_ok($q$insert into public.productos(emprendimiento_id,nombre,precio) values(-98002,'Intruso',150)$q$,'42501',null,'No crea en negocio ajeno');
select results_eq($q$update public.productos set precio=200 where id=-98001 returning precio$q$,ARRAY[200::numeric],'Permiso de edición funciona');
select throws_ok($q$update public.productos set emprendimiento_id=-98002 where id=-98001$q$,'42501',null,'No mueve productos');
select throws_ok($q$insert into public.emprendimientos(nombre,slug) values('Intruso','intruso-autoalta')$q$,'42501',null,'No se autoasigna un negocio');
select results_eq($q$update public.cuentas_acceso set rol='administrador' where usuario_id=auth.uid() returning usuario_id$q$,ARRAY[]::uuid[],'No eleva su rol');
select throws_ok($q$insert into public.permisos_miembro values(-98002,auth.uid(),'productos.ver')$q$,'42501',null,'No concede permisos');
select is(to_regprocedure('public.crear_emprendimiento_inicial(text,text)'),null::regprocedure,'Autoalta anterior retirada');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008003","role":"authenticated"}',true);
select is((select count(*) from public.productos where id=-98001),1::bigint,'Lector del mismo negocio consulta ocultos');
select results_eq($q$update public.productos set precio=1 where id=-98001 returning id$q$,ARRAY[]::bigint[],'Lector no edita');
select results_eq($q$update public.productos set visible=true where id=-98001 returning id$q$,ARRAY[]::bigint[],'Lector no publica');
select throws_ok($q$insert into public.productos(emprendimiento_id,nombre,precio) values(-98001,'Lector intruso',10)$q$,'42501',null,'Lector no crea');
select results_eq($q$delete from public.miembros_emprendimiento where usuario_id=auth.uid() returning usuario_id$q$,ARRAY[]::uuid[],'Miembro no administra asociaciones');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008006","role":"authenticated"}',true);
select results_eq($q$update public.productos set visible=true where id=-98001 returning visible$q$,ARRAY[true],'Publicador cambia visibilidad');
select throws_ok($q$update public.productos set precio=1 where id=-98001$q$,'42501',null,'Publicador no cambia precio');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008004","role":"authenticated"}',true);
select is((select count(*) from public.productos where id=-98002),1::bigint,'Administrador consulta sin membresía');
select results_eq($q$update public.productos set precio=250 where id=-98002 returning precio$q$,ARRAY[250::numeric],'Administrador edita productos');
select lives_ok($q$insert into public.permisos_miembro values(-98001,'00000000-0000-0000-0000-000000008003','productos.editar')$q$,'Administrador asigna permiso');
select lives_ok($q$update public.cuentas_acceso set habilitada=false where usuario_id='00000000-0000-0000-0000-000000008002'$q$,'Administrador deshabilita cuenta');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008003","role":"authenticated"}',true);
select results_eq($q$update public.productos set precio=260 where id=-98001 returning precio$q$,ARRAY[260::numeric],'Concesión funciona sin renovar JWT');
select throws_ok($q$update public.productos set visible=false where id=-98001$q$,'42501',null,'Editor sin publicar no cambia visibilidad');
set local role postgres;
delete from public.permisos_miembro where usuario_id='00000000-0000-0000-0000-000000008003' and permiso='productos.editar';
set local role authenticated;
select results_eq($q$update public.productos set precio=1 where id=-98001 returning id$q$,ARRAY[]::bigint[],'Revocación efectiva con el mismo JWT');
set local role postgres;
update public.miembros_emprendimiento set habilitada=false where usuario_id='00000000-0000-0000-0000-000000008003';
update public.productos set visible=false where id=-98001;
set local role authenticated;
select is((select count(*) from public.productos where id=-98001),0::bigint,'Membresía deshabilitada retira lectura interna');
set local role postgres;
update public.miembros_emprendimiento set habilitada=true where usuario_id='00000000-0000-0000-0000-000000008003';
update public.cuentas_acceso set habilitada=false where usuario_id='00000000-0000-0000-0000-000000008003';
set local role authenticated;
select is((select count(*) from public.productos where id=-98001),0::bigint,'Cuenta deshabilitada retira acceso con el mismo JWT');
select is((select count(*) from public.miembros_emprendimiento),0::bigint,'Cuenta deshabilitada no recibe membresías internas');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008005","role":"authenticated","user_metadata":{"rol":"administrador"}}',true);
select is((select count(*) from public.productos where id=-98001),0::bigint,'Cliente no consulta ocultos');
select is((select count(*) from public.productos where id=-98003),1::bigint,'Cliente puede consultar catálogo público');
select is((select count(*) from public.cuentas_acceso),1::bigint,'Cliente solo consulta su cuenta');
select throws_ok($q$insert into public.miembros_emprendimiento(emprendimiento_id,usuario_id) values(-98001,auth.uid())$q$,'42501',null,'Cliente no se autoasigna membresía');
set local role postgres;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*) from public.productos where id=-98003),1::bigint,'Invitado mantiene catálogo público');
select is((select count(*) from public.productos where id=-98001),0::bigint,'Invitado no consulta ocultos');
select throws_ok($q$select * from public.cuentas_acceso$q$,'42501',null,'Invitado no consulta cuentas');
set local role postgres;
select * from finish();
rollback;
