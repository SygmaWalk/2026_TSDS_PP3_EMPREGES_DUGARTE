begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000008001','authenticated','authenticated','miembro1@example.test','',now(),'{}','{}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000008002','authenticated','authenticated','miembro2@example.test','',now(),'{}','{}',now(),now(),'','','','');

insert into public.emprendimientos (id,nombre,slug) overriding system value values
(-98001,'Negocio miembro 1','prueba-miembro-1'),(-98002,'Negocio miembro 2','prueba-miembro-2');
insert into public.miembros_emprendimiento (emprendimiento_id,usuario_id) values
(-98001,'00000000-0000-0000-0000-000000008001'),(-98002,'00000000-0000-0000-0000-000000008002');
insert into public.productos (id,emprendimiento_id,nombre,precio) overriding system value values
(-98001,-98001,'Producto oculto propio',100),(-98002,-98002,'Producto oculto ajeno',100);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000008001","role":"authenticated"}',true);
select is((select count(*) from public.miembros_emprendimiento),1::bigint,'El usuario solo ve sus membresias');
select is((select count(*) from public.productos where id=-98001),1::bigint,'El miembro ve su producto oculto');
select is((select count(*) from public.productos where id=-98002),0::bigint,'El miembro no ve el producto oculto ajeno');
select lives_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-98001,'Producto propio nuevo',150)$q$,'El miembro crea productos propios');
select throws_ok($q$insert into public.productos (emprendimiento_id,nombre,precio) values (-98002,'Producto ajeno nuevo',150)$q$,'42501',null,'El miembro no crea productos ajenos');
select results_eq($q$update public.productos set precio=200 where id=-98001 returning precio$q$,ARRAY[200::numeric],'El miembro edita sus productos');
select throws_ok($q$update public.productos set emprendimiento_id=-98002 where id=-98001$q$,'42501',null,'El miembro no mueve productos a otro negocio');
select ok(public.crear_emprendimiento_inicial('Nuevo negocio','nuevo-negocio-prueba') is not null,'El usuario puede completar el onboarding');
select ok(exists(select 1 from public.miembros_emprendimiento m join public.emprendimientos e on e.id=m.emprendimiento_id where e.slug='nuevo-negocio-prueba'),'El onboarding crea la membresia');
reset role;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($q$select public.crear_emprendimiento_inicial('Intruso','intruso-prueba')$q$,'42501',null,'Anon no ejecuta el onboarding');
reset role;
select * from finish();
rollback;