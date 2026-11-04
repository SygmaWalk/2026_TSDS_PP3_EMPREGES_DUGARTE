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

 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.registrar_pago'}))
 data(await admin.from('configuracion_entregas').insert({emprendimiento_id:negocio,direccion_origen:'Origen QA 123',latitud:0,longitud:0,franjas:[{hasta_m:1000,tarifa_centavos:0}]}))
 const quote=data(await invitado.rpc('cotizar_entrega',{p_negocio:negocio,p_lat:0,p_lng:0}))
 const envio={modalidad:'envio',direccion:'Destino QA 123',latitud:0,longitud:0,costo_centavos:0,version:quote.version}
 const payload=(metodo='Transferencia',entrega={modalidad:'retiro'})=>({p_clave:randomUUID(),p_negocio:negocio,p_contacto:{nombre:'Cliente QA',telefono:'1123456789',metodo_pago:metodo,entrega},p_items:[{producto_id:producto.id,cantidad:2,precio_centavos:150000}]})
 const crear=async(m,e)=>data(await invitado.rpc('confirmar_pedido',payload(m,e)))
 const leer=async id=>data(await actor.from('pedidos').select('*,historial_estados_pedido(*)').eq('id',id).single())
 const cambiar=(id,anterior,estado,c=actor)=>c.rpc('cambiar_estado_pedido',{p_pedido:id,p_negocio:negocio,p_anterior:anterior,p_estado:estado})
 const finalizar=(p,metodo=null,cobrado=false,c=actor)=>c.rpc('finalizar_entrega_pedido',{p_pedido:p.id,p_negocio:negocio,p_anterior:p.estado,p_version_pago:p.version_pago,p_metodo:metodo,p_cobrado:cobrado})
 const pagar=(p,metodo)=>actor.rpc('registrar_pago_pedido',{p_pedido:p.id,p_negocio:negocio,p_version:p.version_pago,p_metodo:metodo,p_pagado:true})
 const cancelar=p=>actor.rpc('cancelar_pedido',{p_pedido:p.id,p_negocio:negocio,p_anterior:p.estado,p_motivo:'El cliente desistió; entrega detenida'})
 for(const metodo of [null,'Tarjeta',''])ok((await invitado.rpc('confirmar_pedido',payload(metodo))).error?.code==='22023','rechaza elección inválida')
 const sol=payload(),recibo=data(await invitado.rpc('confirmar_pedido',sol))
 ok(recibo.metodo_pago_previsto==='Transferencia','recibo conserva elección')
 ok(data(await invitado.rpc('confirmar_pedido',sol)).id===recibo.id,'reintento mismo método no duplica')
 ok((await invitado.rpc('confirmar_pedido',{...sol,p_contacto:{...sol.p_contacto,metodo_pago:'Efectivo'}})).error?.code==='22023','no cambia elección reutilizando clave')
 const inicial=await leer(recibo.id)
 ok(inicial.estado_pago==='Pendiente'&&inicial.metodo_pago===null,'elección no inventa cobro')
 ok((await cambiar(recibo.id,'Pendiente','Confirmado')).error?.code==='22023','no crea estado antiguo')
 ok((await finalizar(inicial,'Efectivo',true)).error?.code==='22023','no entrega prematuramente')
 const eventos=[]
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Sin Realtime')),30000);actor.channel('qa-flujo-'+randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'pedidos',filter:'emprendimiento_id=eq.'+negocio},p=>eventos.push(p.new)).subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);resolve()}})})
 for(const modalidad of ['retiro','envio']){
  const r=await crear('Transferencia',modalidad==='envio'?envio:{modalidad:'retiro'})
  data(await cambiar(r.id,'Pendiente','En preparación'))
  const listo=modalidad==='envio'?'En ruta de entrega':'Listo para retirar'
  const incorrecto=modalidad==='envio'?'Listo para retirar':'En ruta de entrega'
  ok((await cambiar(r.id,'En preparación',incorrecto)).error?.code==='22023','rechaza etapa ajena a '+modalidad)
  data(await cambiar(r.id,'En preparación',listo))
  const p=await leer(r.id)
  ok((await cambiar(r.id,listo,'Entregado')).error?.code==='22023','entrega exige revisión')
  for(const c of [lector,ajeno,invitado])ok(!!(await finalizar(p,'Efectivo',true,c)).error,'bloquea finalización no autorizada')
  ok((await finalizar(p,'Tarjeta',true)).error?.code==='22023','método inválido revierte toda la entrega')
  ok((await leer(r.id)).estado===listo,'sin cambio parcial')
  const simultaneos=await Promise.all([finalizar(p,'Efectivo',true),finalizar(p,'Transferencia',true)])
  ok(simultaneos.filter(r=>!r.error).length===1&&simultaneos.some(r=>r.error?.code==='PT409'),'una sola entrega y cobro concurrentes')
  const fin=await leer(r.id)
  ok(fin.estado==='Entregado'&&fin.estado_pago==='Pagado'&&fin.metodo_pago_previsto==='Transferencia'&&!!fin.fecha_pago,'entrega y pago guardados sin sobrescribir elección')
  ok(fin.historial_estados_pedido.filter(h=>h.estado_nuevo==='Entregado').length===1,'historial único')
  await esperar(()=>eventos.some(e=>e.id===r.id&&e.estado==='Entregado'))
  ok(true,'entrega emitida en vivo')
 }
 async function listo(metodo='Transferencia'){
  const r=await crear(metodo);data(await cambiar(r.id,'Pendiente','En preparación'));data(await cambiar(r.id,'En preparación','Listo para retirar'));return leer(r.id)
 }
 let p=await listo()
 data(await finalizar(p,'Efectivo',false))
 let guardado=await leer(p.id)
 ok(guardado.estado==='Entregado'&&guardado.estado_pago==='Pendiente'&&guardado.metodo_pago==='Efectivo'&&guardado.metodo_pago_previsto==='Transferencia','entregado pendiente con método cambiado')
 p=await listo();data(await pagar(p,'Transferencia'));guardado=await leer(p.id)
 ok((await finalizar(p,'Efectivo',true)).error?.code==='PT409','pago previo invalida revisión antigua')
 data(await finalizar(guardado))
 ok((await leer(p.id)).fecha_pago===guardado.fecha_pago,'entrega conserva cobro anticipado')
 p=await listo()
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','pedidos.registrar_pago'))
 ok((await finalizar(p,'Efectivo',true)).error?.code==='42501','permiso pago revocado impide cobro')
 data(await finalizar(p))
 ok((await leer(p.id)).estado_pago==='Pendiente','operador entrega sin permiso para cobrar')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'pedidos.registrar_pago'}))
 const ruta=await crear('Efectivo',envio);data(await cambiar(ruta.id,'Pendiente','En preparación'));data(await cambiar(ruta.id,'En preparación','En ruta de entrega'));data(await cancelar(await leer(ruta.id)))
 ok((await leer(ruta.id)).estado==='Cancelado','cancelación en ruta conserva pedido')
 // Pedidos anteriores: conservar estados e historial; continuar desde su etapa.
 for(const [estado,entrega,destino]of[['Confirmado',{modalidad:'retiro'},'En preparación'],['Listo para entregar',envio,'En ruta de entrega']]){
  const old=await crear();data(await admin.from('pedidos').update({estado,entrega,metodo_pago_previsto:null}).eq('id',old.id))
  data(await cambiar(old.id,estado,destino));ok((await leer(old.id)).metodo_pago_previsto===null,'compatibilidad sin inventar elección antigua')
 }
 browser=await chromium.launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:1360,height:1000}}),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 const tienda=data(await admin.from('emprendimientos').select('slug').eq('id',negocio).single())
 await page.goto('http://127.0.0.1:5173/#/tienda/'+tienda.slug)
 await page.getByRole('button',{name:'Agregar Menú de prueba al carrito',exact:true}).click()
 await page.getByRole('button',{name:'Carrito (1)',exact:true}).click()
 await page.getByRole('button',{name:'Continuar con el pedido'}).click()
 await page.getByLabel('Nombre de contacto').fill('Cliente navegador')
 await page.getByLabel('Teléfono de contacto').fill('1123456789')
 await page.getByLabel('¿Cómo pensás pagar?').selectOption('Transferencia')
 mkdirSync('test-results',{recursive:true})
 await page.screenshot({path:'test-results/checkout-metodo.png',fullPage:true})
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 const numero=Number((await page.locator('.order-number').innerText()).replace('Pedido #',''))
 ok((await leer(numero)).metodo_pago_previsto==='Transferencia','elección real desde checkout')
 await page.reload();await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 ok(await page.getByText('Método elegido:').textContent()==='Método elegido: Transferencia','recibo persiste elección al recargar')
 const operador=await browser.newContext({viewport:{width:1360,height:1000}}),panel=await operador.newPage()
 panel.on('pageerror',e=>errores.push(e.message))
 await panel.goto('http://127.0.0.1:5173/#/ingresar')
 await panel.getByLabel('Correo electrónico').fill(a.email);await panel.getByLabel('Contraseña').fill(a.password)
 await panel.getByRole('button',{name:'Ingresar',exact:true}).click()
 await panel.getByRole('button',{name:'Ver pedidos de Cocina en vivo QA',exact:true}).click()
 await panel.getByRole('button',{name:'Ver pedido #'+numero,exact:true}).click()
 await panel.getByRole('button',{name:'Pasar a En preparación',exact:true}).click()
 await panel.getByRole('button',{name:'Pasar a Listo para retirar',exact:true}).click()
 await panel.getByRole('button',{name:'Revisar y marcar entregado',exact:true}).click()
 await panel.getByLabel('Método acordado al entregar').selectOption('Efectivo')
 await panel.getByRole('checkbox',{name:'Confirmo que recibí el importe completo'}).check()
 for(const [width,height,tipo]of[[1360,1000,'escritorio'],[390,844,'movil']]){
  await panel.setViewportSize({width,height})
  ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
  await panel.screenshot({path:'test-results/entrega-pago-'+tipo+'.png',fullPage:true})
 }
 await panel.getByRole('button',{name:'Confirmar entrega',exact:true}).click()
 await panel.getByText('Pedido entregado',{exact:true}).waitFor()
 await panel.getByText('Pago registrado · Efectivo',{exact:true}).waitFor()
 const real=await leer(numero)
 ok(real.estado==='Entregado'&&real.metodo_pago_previsto==='Transferencia'&&real.metodo_pago==='Efectivo'&&real.estado_pago==='Pagado','flujo completo: elección y método efectivo diferentes')
 ok(errores.length===0,'sin errores navegador')
 console.log('PASS '+checks+' comprobaciones de flujo y pago previsto')
} finally {
 await browser?.close()
 for(const c of clientes)await c.removeAllChannels()
 for(const id of negocios){
  for(const tabla of ['pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 }
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
