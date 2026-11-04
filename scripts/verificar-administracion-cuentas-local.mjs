import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const service=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const anon=()=>createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const users=[],negocios=[];let checks=0,browser
function data(r){assert.ifError(r.error);return r.data}
function ok(c,m){assert.ok(c,m);console.log('PASS '+(++checks)+': '+m)}
try{
 for(let i=0;i<3;i++){
 const email='qa-admin-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const user=data(await service.auth.admin.createUser({email,password,email_confirm:true})).user
 const client=anon();users.push({id:user.id,email,password,client})
 data(await client.auth.signInWithPassword({email,password}))
 }
 data(await service.from('cuentas_acceso').update({rol:'administrador'}).eq('usuario_id',users[0].id))
 for(let i=0;i<2;i++)negocios.push(data(await service.from('emprendimientos').insert({nombre:'QA permisos '+i,slug:'qa-permisos-'+randomUUID()}).select().single()))
 const admin=users[0].client,member=users[1].client,customer=users[2].client
 const save=(c,associations=[],extra={})=>c.rpc('administracion_guardar_cuenta',{p_usuario:users[1].id,p_habilitada:true,p_interna:true,p_asociaciones:associations,...extra})
 const association=(i,permissions)=>({emprendimiento_id:negocios[i].id,habilitada:true,permisos:permissions})
 ok(!!(await anon().rpc('administracion_cuentas')).error,'anónimo no consulta cuentas')
 ok((await customer.rpc('administracion_cuentas')).error?.code==='42501','cliente no consulta cuentas')
 ok((await save(customer)).error?.code==='42501','cliente no concede permisos por RPC')
 ok((await customer.from('cuentas_acceso').update({rol:'administrador'}).eq('usuario_id',users[2].id).select()).data?.length===0,'RLS impide elevar rol directamente')
 ok(data(await admin.rpc('administracion_cuentas',{p_busqueda:users[1].email})).length===1,'búsqueda por correo para administrador')
 data(await save(admin,[association(0,['productos.ver','productos.crear'])]))
 ok(data(await service.from('cuentas_acceso').select('rol').eq('usuario_id',users[1].id).single()).rol==='emprendimiento','habilita cuenta interna registrada')
 const insert=(i)=>member.from('productos').insert({emprendimiento_id:negocios[i].id,nombre:'QA permiso',precio:10,visible:false}).select()
 ok(data(await insert(0)).length===1,'sesión existente recibe permiso de alta')
 ok((await insert(1)).error?.code==='42501','permiso no se extiende a otro negocio')
 ok((await save(member)).error?.code==='42501','cuenta interna no administra permisos')
 data(await save(admin,[association(0,['productos.ver']),association(1,['stock.ver'])]))
 ok((await insert(0)).error?.code==='42501','revocación efectiva en la misma sesión')
 const failed=await save(admin,[association(0,['productos.editar'])])
 ok(failed.error?.code==='22023','rechaza permisos sin consulta requerida')
 ok(data(await admin.rpc('administracion_cuentas',{p_busqueda:users[1].email}))[0].asociaciones.length===2,'error conserva todas las asociaciones previas')
 ok((await save(admin,[association(0,['inventado'])])).error?.code==='22023','rechaza permiso desconocido')
 ok((await save(admin,[],{p_usuario:users[0].id})).error?.code==='42501','protege cuenta administradora')
 data(await save(admin,[association(1,['stock.ver'])]))
 ok(data(await member.from('miembros_emprendimiento').select('*')).length===1,'retira asociación al negocio anterior')
 data(await save(admin,[association(1,['stock.ver'])],{p_habilitada:false}))
 ok(data(await member.from('miembros_emprendimiento').select('*')).length===0,'deshabilitar cuenta retira acceso vigente')
 data(await save(admin,[],{p_interna:false}))
 ok(data(await member.from('cuentas_acceso').select('rol').single()).rol==='cliente','puede volver a cuenta cliente sin asociaciones')
 // El navegador valida el guardado real con cuentas temporales, sin tocar las de demostración.
 browser=await chromium.launch()
 const page=await browser.newPage({viewport:{width:1360,height:900}})
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(users[0].email)
 await page.getByLabel('Contraseña',{exact:true}).fill(users[0].password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('link',{name:'Usuarios y permisos',exact:true}).click()
 await page.getByLabel('Buscar por correo').fill(users[1].email)
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:'Administrar '+users[1].email,exact:true}).click()
 await page.getByLabel('Acceso interno a emprendimientos').check()
 await page.getByLabel('Agregar emprendimiento').selectOption(String(negocios[0].id))
 await page.getByLabel('Crear productos',{exact:true}).check()
 ok(await page.getByLabel('Consultar productos',{exact:true}).isChecked(),'seleccionar escritura incluye consulta')
 await page.getByRole('button',{name:'Revisar cambios'}).click()
 await page.getByRole('button',{name:'Confirmar y guardar'}).click()
 await page.getByRole('status').filter({hasText:'Cuenta y permisos actualizados.'}).waitFor()
 ok(data(await admin.rpc('administracion_cuentas',{p_busqueda:users[1].email}))[0].asociaciones[0].permisos.includes('productos.crear'),'guardado desde navegador llega a la base')
 await page.getByRole('button',{name:'Administrar '+users[1].email,exact:true}).click()
 for(const theme of ['light','dark']){
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
 for(const width of [1360,390]){
 await page.setViewportSize({width,height:900})
 await page.screenshot({path:'test-results/administracion-'+width+'-'+theme+'.png',fullPage:true})
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde horizontal '+theme+' '+width)
 }}
 console.log('TOTAL '+checks+' comprobaciones')
}finally{
 if(browser)await browser.close()
 for(const n of negocios){data(await service.from('productos').delete().eq('emprendimiento_id',n.id));data(await service.from('emprendimientos').delete().eq('id',n.id))}
 for(const u of users)data(await service.auth.admin.deleteUser(u.id))
}
