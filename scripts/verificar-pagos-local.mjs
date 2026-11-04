import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const nuevo=()=>createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const actor=nuevo(),lector=nuevo(),invitado=nuevo(),ajeno=nuevo()
const usuarios=[],negocios=[],clientes=[actor,lector,invitado,ajeno]
let browser
let checks=0
function ok(cond,mensaje){assert.ok(cond,mensaje);checks++;console.log('PASS '+checks+': '+mensaje)}
function data(r){assert.ifError(r.error);return r.data}
async function cuenta(client,rol='emprendimiento'){
 const email='qa-estados-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const u=data(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;usuarios.push(u.id)
 data(await admin.from('cuentas_acceso').update({rol}).eq('usuario_id',u.id))
 data(await client.auth.signInWithPassword({email,password}));return {...u,email,password}
}
const pausa=ms=>new Promise(r=>setTimeout(r,ms))
async function esperar(predicado){for(let i=0;i<300;i++){if(await predicado())return;await pausa(100)}throw Error('No llegó el evento esperado')}
try{
 const a=await cuenta(actor),l=await cuenta(lector),b=await cuenta(ajeno)
 for(const nombre of ['Cocina en vivo QA','Negocio ajeno QA'])negocios.push(data(await admin.from('emprendimientos').insert({nombre,slug:'qa-estados-'+randomUUID()}).select().single()).id)
 const [negocio,otro]=negocios
 for(const [u,n,permisos]of[[a,negocio,['pedidos.ver','pedidos.actualizar_estado']],[l,negocio,['pedidos.ver']],[b,otro,['pedidos.ver','pedidos.actualizar_estado']]]){
  data(await admin.from('miembros_emprendimiento').insert({usuario_id:u.id,emprendimiento_id:n}))
  data(await admin.from('permisos_miembro').insert(permisos.map(permiso=>({usuario_id:u.id,emprendimiento_id:n,permiso}))))
 }
 const producto=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Menú de prueba',precio:1500,visible:true}).select().single())
 const crear=async()=>data(await invitado.rpc('confirmar_pedido',{p_clave:randomUUID(),p_negocio:negocio,p_contacto:{nombre:'Cliente de prueba',telefono:'1123456789'},p_items:[{producto_id:producto.id,cantidad:2,precio_centavos:150000}]}))
 const pedido=await crear()

 const pagar=(c,id,version,metodo='Efectivo',pagado=true,n=negocio)=>c.rpc('registrar_pago_pedido',{p_pedido:id,p_negocio:n,p_version:version,p_metodo:metodo,p_pagado:pagado})
 const leer=async id=>data(await actor.from('pedidos').select('*').eq('id',id).single())
 const inicial=await leer(pedido.id)
 ok(inicial.estado_pago==='Pendiente'&&inicial.metodo_pago===null&&inicial.fecha_pago===null,'pedido nuevo sin cobro inventado')
 ok((await pagar(actor,pedido.id,0)).error?.code==='42501','gestionar estados no autoriza pagos')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.registrar_pago'}))
 ok((await pagar(lector,pedido.id,0)).error?.code==='42501','lector no registra')
 ok((await pagar(ajeno,pedido.id,0)).error?.code==='42501','negocio ajeno no registra')
 ok(!!(await pagar(invitado,pedido.id,0)).error,'invitado no registra')
 for(const metodo of [null,'Tarjeta',''])ok((await pagar(actor,pedido.id,0,metodo)).error?.code==='22023','método inválido')
 ok((await pagar(actor,pedido.id,null)).error?.code==='PT409','versión obligatoria')
 ok((await pagar(actor,pedido.id,0,'Efectivo',null)).error?.code==='22023','estado obligatorio')
 ok(!!(await actor.from('pedidos').update({estado_pago:'Pagado'}).eq('id',pedido.id)).error,'sin escritura directa')
 const sinCobrar=data(await pagar(actor,pedido.id,0,'Transferencia',false))
 ok(sinCobrar.estado_pago==='Pendiente'&&sinCobrar.fecha_pago===null&&sinCobrar.version_pago===1,'guardar método no registra cobro')
 const carrera=await Promise.all([pagar(actor,pedido.id,1,'Transferencia'),pagar(actor,pedido.id,1,'Efectivo')])
 ok(carrera.filter(r=>!r.error).length===1&&carrera.some(r=>r.error?.code==='PT409'),'un único registro concurrente')
 const cobrado=await leer(pedido.id)
 ok(cobrado.estado_pago==='Pagado'&&!!cobrado.fecha_pago&&cobrado.usuario_pago===a.id&&cobrado.estado==='Pendiente'&&cobrado.fecha_estado===inicial.fecha_estado,'cobro auditado e independiente de preparación')
 ok((await pagar(actor,pedido.id,2,'Efectivo',false)).error?.code==='22023','no revierte pago')
 ok((await pagar(actor,pedido.id,2,'Efectivo')).error?.code==='22023','no duplica cobro ni cambia fecha')
 data(await actor.rpc('cancelar_pedido',{p_pedido:pedido.id,p_negocio:negocio,p_anterior:'Pendiente',p_motivo:'Cancelación posterior al pago'}))
 const cancelado=await leer(pedido.id)
 ok(cancelado.estado==='Cancelado'&&cancelado.estado_pago==='Pagado'&&cancelado.fecha_pago===cobrado.fecha_pago,'cancelación conserva registro de pago')
 const pc=await crear()
 data(await actor.rpc('cancelar_pedido',{p_pedido:pc.id,p_negocio:negocio,p_anterior:'Pendiente',p_motivo:'Prueba'}))
 ok((await pagar(actor,pc.id,0)).error?.code==='22023','no registra cobro en cancelado')
 const nuevoPago=await crear()
 for(const [tabla,campo,filtro]of[['cuentas_acceso','habilitada','usuario_id'],['miembros_emprendimiento','habilitada','usuario_id']]){
  data(await admin.from(tabla).update({[campo]:false}).eq(filtro,a.id))
  ok((await pagar(actor,nuevoPago.id,0)).error?.code==='42501','cuenta/asociación deshabilitada')
  data(await admin.from(tabla).update({[campo]:true}).eq(filtro,a.id))
 }
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','pedidos.registrar_pago'))
 ok((await pagar(actor,nuevoPago.id,0)).error?.code==='42501','revocación en sesión vigente')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.registrar_pago'}))
 for(const [anterior,estado]of[['Pendiente','Confirmado'],['Confirmado','En preparación'],['En preparación','Listo para entregar'],['Listo para entregar','Entregado']])data(await actor.rpc('cambiar_estado_pedido',{p_pedido:nuevoPago.id,p_negocio:negocio,p_anterior:anterior,p_estado:estado}))
 ok(data(await pagar(actor,nuevoPago.id,0)).estado_pago==='Pagado','permite cobrar después de entregar')
 const eventos=[]
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Realtime no conectado')),30000)
  actor.channel('qa-pagos-'+randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'pedidos',filter:'emprendimiento_id=eq.'+negocio},p=>eventos.push(p.new)).subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);resolve()}})
 })
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({viewport:{width:1360,height:1000}})
 const page=await context.newPage(),errores=[];page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedidos de Cocina en vivo QA',exact:true}).click()
 const ui=await crear()
 await page.getByRole('button',{name:'Actualizar pedidos',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedido #'+ui.id,exact:true}).click()
 const pago=page.getByRole('region',{name:'Pago del pedido'})
 await pago.getByLabel('Método de pago').selectOption('Transferencia')
 await pago.getByRole('button',{name:'Guardar método',exact:true}).click()
 await pago.getByText('Pago pendiente · Transferencia',{exact:true}).waitFor()
 await pago.getByRole('button',{name:'Marcar como pagado',exact:true}).click()
 await pago.getByRole('button',{name:'Volver sin registrar pago',exact:true}).click()
 ok((await leer(ui.id)).estado_pago==='Pendiente','volver sin registrar conserva pendiente')
 await pago.getByRole('button',{name:'Marcar como pagado',exact:true}).click()
 await pago.getByRole('button',{name:'Confirmar pago recibido',exact:true}).click()
 await pago.getByText('Pago registrado · Transferencia',{exact:true}).waitFor()
 await esperar(()=>eventos.some(e=>e.id===ui.id&&e.estado_pago==='Pagado'))
 ok(true,'cobro visible y evento Realtime')
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of[[1360,1000,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height});await pausa(250)
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
  await page.screenshot({path:'test-results/pago-detalle-'+tipo+'.png',fullPage:true})
 }
 await page.getByRole('button',{name:/Volver al listado/}).click()
 const tarjeta=page.getByRole('listitem').filter({has:page.getByRole('button',{name:'Ver pedido #'+ui.id,exact:true})})
 await tarjeta.getByText('Pago registrado · Transferencia',{exact:true}).waitFor()
 ok(true,'método y estado visibles en listado')
 await page.getByRole('button',{name:'Ver pedido #'+ui.id,exact:true}).click()
 await page.getByRole('button',{name:'Actualizar pedidos',exact:true}).click()
 await pago.getByText('Pago registrado · Transferencia',{exact:true}).waitFor()
 ok(!(await pago.getByRole('button',{name:'Marcar como pagado',exact:true}).count()),'pago persiste al consultar nuevamente')
 ok(errores.length===0,'sin errores de navegador')
 console.log('PASS '+checks+' comprobaciones de pagos')
} finally {
 await browser?.close()
 for(const c of clientes)await c.removeAllChannels()
 for(const id of negocios){
  for(const tabla of ['pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 }
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
