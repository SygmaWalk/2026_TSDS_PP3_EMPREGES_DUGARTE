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
 const cambiar=(c,anterior,estado,id=pedido.id,n=negocio)=>c.rpc('cambiar_estado_pedido',{p_pedido:id,p_negocio:n,p_anterior:anterior,p_estado:estado})
 ok((await cambiar(lector,'Pendiente','Confirmado')).error?.code==='42501','lector no escribe')
 ok((await cambiar(ajeno,'Pendiente','Confirmado')).error?.code==='42501','negocio ajeno no escribe')
 ok(!!(await cambiar(invitado,'Pendiente','Confirmado')).error,'invitado no escribe')
 ok((await cambiar(actor,'Pendiente','Entregado')).error?.code==='22023','no salta estados')
 {const r=await cambiar(actor,null,'Confirmado');ok(r.error?.code==='PT409','requiere estado previo')}
 ok(!!(await actor.from('pedidos').update({estado:'Entregado'}).eq('id',pedido.id)).error,'sin UPDATE directo')
 ok(!!(await actor.from('historial_estados_pedido').insert({pedido_id:pedido.id,estado_anterior:'Pendiente',estado_nuevo:'Entregado'})).error,'sin historial falsificado')
 const cambios=await Promise.all([cambiar(actor,'Pendiente','Confirmado'),cambiar(actor,'Pendiente','Confirmado')])
 ok(cambios.filter(r=>!r.error).length===1 && cambios.some(r=>r.error?.code==='PT409'),'solo un cambio concurrente')
 const historial=data(await actor.from('historial_estados_pedido').select('*').eq('pedido_id',pedido.id))
 ok(historial.length===1 && historial[0].usuario_id===a.id,'historial único con actor')
 ok(data(await ajeno.from('historial_estados_pedido').select('*').eq('pedido_id',pedido.id)).length===0,'historial ajeno protegido')
 ok(data(await actor.from('pedidos').select('fecha_estado').eq('id',pedido.id).single()).fecha_estado===historial[0].fecha,'fecha consistente')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','pedidos.actualizar_estado'))
 ok((await cambiar(actor,'Confirmado','En preparación')).error?.code==='42501','revocación misma sesión')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.actualizar_estado'}))
 data(await admin.from('miembros_emprendimiento').update({habilitada:false}).eq('usuario_id',a.id))
 ok((await cambiar(actor,'Confirmado','En preparación')).error?.code==='42501','asociación deshabilitada')
 data(await admin.from('miembros_emprendimiento').update({habilitada:true}).eq('usuario_id',a.id))
 data(await admin.from('cuentas_acceso').update({habilitada:false}).eq('usuario_id',a.id))
 ok((await cambiar(actor,'Confirmado','En preparación')).error?.code==='42501','cuenta deshabilitada')
 data(await admin.from('cuentas_acceso').update({habilitada:true}).eq('usuario_id',a.id))
 for(const [anterior,estado]of[['Confirmado','En preparación'],['En preparación','Listo para entregar'],['Listo para entregar','Entregado']])ok(data(await cambiar(actor,anterior,estado)).estado===estado,'avance '+estado)
 ok((await cambiar(actor,'Entregado','Pendiente')).error?.code==='22023','no reabre entregado')
 const eventos=[],prohibidos=[]
 async function canal(c,lista){return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Realtime no conectó')),15000)
  const ch=c.channel('qa-'+randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'pedidos',filter:'emprendimiento_id=eq.'+negocio},p=>lista.push(p))
  ch.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(timeout);resolve(ch)}else if(s==='CHANNEL_ERROR'){clearTimeout(timeout);reject(Error('Error de Realtime'))}})
 })}
 await canal(actor,eventos);await canal(ajeno,prohibidos)
 const nuevoPedido=await crear()
 await esperar(()=>eventos.some(p=>p.eventType==='INSERT'&&p.new.id===nuevoPedido.id))
 ok(true,'INSERT en vivo')
 data(await cambiar(actor,'Pendiente','Confirmado',nuevoPedido.id))
 await esperar(()=>eventos.some(p=>p.eventType==='UPDATE'&&p.new.id===nuevoPedido.id&&p.new.estado==='Confirmado'))
 ok(true,'UPDATE en vivo');await pausa(600);ok(prohibidos.length===0,'RLS de Realtime deniega negocio ajeno')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','pedidos.ver'))
 const denegado=await crear();await pausa(1000);ok(!eventos.some(p=>p.new.id===denegado.id),'Realtime no entrega tras revocar lectura')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.ver'}))
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({viewport:{width:1360,height:1000}})
 await context.addInitScript(()=>{
  window.tonosQA=0;const crear=AudioContext.prototype.createOscillator
  AudioContext.prototype.createOscillator=function(...args){const o=crear.apply(this,args),start=o.start.bind(o);o.start=(...a)=>{window.tonosQA++;return start(...a)};return o}
 })
 const page=await context.newPage(),errores=[];page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedidos de Cocina en vivo QA',exact:true}).click()
 await page.getByText('Pedidos en vivo',{exact:true}).waitFor()
 ok(await page.getByText('Llegó un pedido nuevo',{exact:true}).count()===0,'no alerta por pedidos antiguos')
 await page.getByRole('button',{name:'Activar sonido',exact:true}).click()
 await page.getByRole('button',{name:'Silenciar sonido',exact:true}).waitFor()
 const tonos=await page.evaluate(()=>window.tonosQA)
 const reciente=await crear()
 await page.getByText('Llegó un pedido nuevo',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Ver pedido #'+reciente.id,exact:true}).waitFor()
 ok(await page.evaluate(()=>window.tonosQA)>tonos,'emite tonos por nuevo pedido')
 await page.getByRole('button',{name:'Ver pedido #'+reciente.id,exact:true}).click()
 await page.getByRole('button',{name:'Pasar a Confirmado',exact:true}).click()
 await page.getByText('Pendiente → Confirmado',{exact:true}).waitFor()
 ok(true,'acción de estado e historial en navegador')
 // Otro operador modifica el mismo pedido: el detalle abierto se actualiza.
 data(await cambiar(actor,'Confirmado','En preparación',reciente.id))
 await page.getByRole('button',{name:'Pasar a Listo para entregar',exact:true}).waitFor()
 ok(true,'detalle sigue cambios externos')
 mkdirSync('test-results',{recursive:true})
 async function captura(nombre){
  for(const [width,height,tipo]of[[1360,1000,'escritorio'],[390,844,'movil']]){
   await page.setViewportSize({width,height});await pausa(250)
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
   await page.screenshot({path:'test-results/'+nombre+'-'+tipo+'.png',fullPage:true})
  }
  await page.setViewportSize({width:1360,height:1000})
 }
 await captura('estados-detalle')
 await page.getByRole('button',{name:/Volver al listado/}).click()
 await page.getByRole('button',{name:'En preparación',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedido #'+reciente.id,exact:true}).waitFor()
 await captura('pedidos-en-vivo')
 await page.getByRole('button',{name:'Silenciar sonido',exact:true}).click()
 await page.getByRole('button',{name:'Descartar aviso',exact:true}).click()
 const antes=await page.evaluate(()=>window.tonosQA)
 await crear();await page.getByText('Llegó un pedido nuevo',{exact:true}).waitFor()
 ok(await page.evaluate(()=>window.tonosQA)===antes,'silenciado conserva alerta visual')
 ok(await page.getByRole('button',{name:'En preparación',exact:true}).getAttribute('aria-pressed')==='true','alerta conserva filtro')
 await page.getByRole('button',{name:'Ver nuevos pedidos',exact:true}).click()
 await page.getByRole('button',{name:'Todos',exact:true}).waitFor()
 ok(await page.getByRole('button',{name:'Todos',exact:true}).getAttribute('aria-pressed')==='true','ver nuevos limpia filtros')
 ok(errores.length===0,'sin errores JavaScript')

 const cancelar=(c,id,anterior,motivo='El cliente desistió',n=negocio)=>c.rpc('cancelar_pedido',{p_pedido:id,p_negocio:n,p_anterior:anterior,p_motivo:motivo})
 const pc=await crear()
 ok((await cancelar(lector,pc.id,'Pendiente')).error?.code==='42501','lector no cancela')
 ok((await cancelar(ajeno,pc.id,'Pendiente')).error?.code==='42501','negocio ajeno no cancela')
 ok(!!(await cancelar(invitado,pc.id,'Pendiente')).error,'invitado no cancela')
 for(const motivo of [null,'  \n\t','x'.repeat(501)])ok((await cancelar(actor,pc.id,'Pendiente',motivo)).error?.code==='22023','rechaza motivo inválido')
 const cc=await Promise.all([cancelar(actor,pc.id,'Pendiente'),cambiar(actor,'Pendiente','Confirmado',pc.id)])
 ok(cc.filter(r=>!r.error).length===1&&cc.some(r=>r.error?.code==='PT409'),'cancelar y avanzar simultáneos: un solo ganador')
 for(const estado of ['Pendiente','Confirmado','En preparación','Listo para entregar']){
  const cp=await crear()
  let previo='Pendiente'
  for(const dest of ['Confirmado','En preparación','Listo para entregar']){
   if(previo===estado)break
   data(await cambiar(actor,previo,dest,cp.id));previo=dest
  }
  data(await cancelar(actor,cp.id,estado,'  Solicitud del cliente  '))
  const guardado=data(await actor.from('pedidos').select('*,historial_estados_pedido(*),detalles_pedido(*)').eq('id',cp.id).single())
  const h=guardado.historial_estados_pedido.filter(x=>x.estado_nuevo==='Cancelado')
  ok(guardado.estado==='Cancelado'&&guardado.motivo_cancelacion==='Solicitud del cliente'&&h.length===1&&h[0].usuario_id===a.id&&h[0].fecha===guardado.fecha_estado&&guardado.detalles_pedido.length===1&&Number(guardado.subtotal)===3000,'cancela '+estado+' conservando motivo, actor, fecha y productos')
  ok((await cancelar(actor,cp.id,'Cancelado')).error?.code==='22023','no repite cancelación')
  ok((await cambiar(actor,'Cancelado','Confirmado',cp.id)).error?.code==='22023','no reabre cancelado')
 }
 ok((await cancelar(actor,pedido.id,'Entregado')).error?.code==='22023','no cancela entregado')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','pedidos.actualizar_estado'))
 ok((await cancelar(actor,pc.id,'Pendiente')).error?.code==='42501','revocación impide cancelar en sesión vigente')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.actualizar_estado'}))
 await page.getByRole('button',{name:'Ver pedido #'+reciente.id,exact:true}).click()
 await page.getByRole('button',{name:'Cancelar pedido',exact:true}).click()
 await page.getByLabel('Motivo de cancelación').fill('El cliente solicitó cancelar el pedido')
 await captura('cancelacion-formulario')
 await page.getByRole('button',{name:'Confirmar cancelación',exact:true}).click()
 await page.getByText('En preparación → Cancelado',{exact:true}).waitFor()
 ok(await page.getByText('El cliente solicitó cancelar el pedido',{exact:true}).count()===1,'motivo guardado visible')
 await captura('cancelacion-detalle')
 await page.getByRole('button',{name:/Volver al listado/}).click()
 await page.getByRole('button',{name:'Cancelado',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedido #'+reciente.id,exact:true}).waitFor()
 ok(true,'filtro de cancelados conserva pedido')

 console.log('PASS '+checks+' comprobaciones: estados, concurrencia, permisos, historial, Realtime real/RLS, sonido, alertas y móvil.')
} finally {
 await browser?.close()
 for(const c of clientes)await c.removeAllChannels()
 for(const id of negocios){
  for(const tabla of ['pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 }
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
