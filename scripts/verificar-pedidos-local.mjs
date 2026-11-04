import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
const status = JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const anon=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const negocios=[],usuarios=[]
let pruebas=0
function ok(valor,mensaje){assert.ok(valor,mensaje);pruebas++}
try {
 for(const i of [0,1]){
  const {data,error}=await admin.from('emprendimientos').insert({nombre:'QA pedidos '+i,slug:'qa-pedidos-'+randomUUID()}).select().single()
  assert.ifError(error);negocios.push(data.id)
 }
 const {data:productos,error}=await admin.from('productos').insert([
 {emprendimiento_id:negocios[0],nombre:'Producto A',precio:1500.50,visible:true},
 {emprendimiento_id:negocios[0],nombre:'Producto B',precio:800,visible:true},
 {emprendimiento_id:negocios[1],nombre:'Ajeno',precio:500,visible:true}
 ]).select().order('id')
 assert.ifError(error)
 const [a,b,ajeno]=productos
 const entrada=()=>({p_clave:randomUUID(),p_negocio:negocios[0],p_contacto:{nombre:'Cliente de prueba',telefono:'+54 (11) 1234-5678'},p_items:[{producto_id:a.id,cantidad:3,precio_centavos:150050},{producto_id:b.id,cantidad:2,precio_centavos:80000}]})
 const rpc=(p,client=anon)=>client.rpc('confirmar_pedido',p)
 const original=entrada()
 const paralelos=await Promise.all([rpc(original),rpc(original),rpc(original)])
 paralelos.forEach(r=>assert.ifError(r.error))
 const recibo=paralelos[0].data
 ok(paralelos.every(r=>r.data.id===recibo.id),'Tres solicitudes concurrentes producen un pedido')
 ok(recibo.subtotal_centavos===610150 && recibo.estado==='Pendiente' && !Number.isNaN(Date.parse(recibo.fecha)),'Subtotal, estado y fecha generados por el servidor')
 const guardado=await admin.from('pedidos').select('*,detalles_pedido(*)').eq('id',recibo.id).single()
 assert.ifError(guardado.error)
 ok(guardado.data.detalles_pedido.length===2 && guardado.data.cliente_usuario_id===null && guardado.data.telefono_contacto==='+541112345678','Pedido invitado y detalle guardados')
 const contar=async()=>{const r=await admin.from('pedidos').select('id',{count:'exact',head:true}).in('emprendimiento_id',negocios);assert.ifError(r.error);return r.count}
 const antes=await contar()
 const invalidos=[
 {...entrada(),p_items:[]},
 {...entrada(),p_contacto:{nombre:' ',telefono:'123'}},
 {...entrada(),p_items:[{producto_id:a.id,cantidad:0,precio_centavos:150050}]},
 {...entrada(),p_items:[{producto_id:a.id,cantidad:1.5,precio_centavos:150050}]},
 {...entrada(),p_items:[{producto_id:a.id,cantidad:1000,precio_centavos:150050}]},
 {...entrada(),p_items:[{producto_id:ajeno.id,cantidad:1,precio_centavos:50000}]},
 {...entrada(),p_items:[{producto_id:a.id,cantidad:1,precio_centavos:1}]},
 {...entrada(),p_items:[{producto_id:a.id,cantidad:1,precio_centavos:150050},{producto_id:a.id,cantidad:1,precio_centavos:150050}]},
 {...entrada(),p_items:null},
 {...entrada(),p_items:Array.from({length:101},()=>({producto_id:a.id,cantidad:1,precio_centavos:150050}))},
 {...original,p_contacto:{nombre:'Otra persona',telefono:'1123456789'}}
 ]
 for(const p of invalidos) ok((await rpc(p)).error?.code==='22023','Se rechaza entrada inválida sin insertar')
 ok(await contar()===antes,'Ninguna entrada inválida creó un pedido parcial')
 await admin.from('productos').update({visible:false}).eq('id',b.id).then(r=>assert.ifError(r.error))
 ok((await rpc(entrada())).error?.code==='22023','Oculto invalida todo el pedido')
 ok(await contar()===antes,'No queda cabecera ni detalle parcial por producto oculto')
 await admin.from('productos').update({visible:true,precio:900}).eq('id',b.id).then(r=>assert.ifError(r.error))
 ok((await rpc(entrada())).error?.code==='22023','Precio obsoleto requiere revisión')
 const repetido=await rpc(original);assert.ifError(repetido.error)
 ok(repetido.data.subtotal_centavos===610150 && repetido.data.id===recibo.id,'Reintento recupera comprobante histórico aun con precios nuevos')
 await admin.from('emprendimientos').update({activo:false}).eq('id',negocios[0]).then(r=>assert.ifError(r.error))
 ok((await rpc(entrada())).error?.code==='22023','Tienda inactiva rechaza pedidos nuevos')
 await admin.from('emprendimientos').update({activo:true}).eq('id',negocios[0]).then(r=>assert.ifError(r.error))
 ok(Boolean((await anon.from('pedidos').select('*')).error),'Visitante no puede listar contactos')
 ok(Boolean((await anon.from('pedidos').insert({emprendimiento_id:negocios[0],nombre_contacto:'Falso',telefono_contacto:'1234567',subtotal:1})).error),'No se permite alta directa con importe adulterado')
 const email='qa-pedido-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const usuario=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(usuario.error);usuarios.push(usuario.data.user.id)
 const cliente=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
 assert.ifError((await cliente.auth.signInWithPassword({email,password})).error)
 const pedidoCliente=entrada();pedidoCliente.p_items[1].precio_centavos=90000
 const asociado=await rpc(pedidoCliente,cliente);assert.ifError(asociado.error)
 const fila=await admin.from('pedidos').select('cliente_usuario_id').eq('id',asociado.data.id).single();assert.ifError(fila.error)
 ok(fila.data.cliente_usuario_id===usuarios[0],'Identidad Cliente obtenida desde sesión, no desde formulario')
 const lectura=await cliente.from('pedidos').select('*');assert.ifError(lectura.error)
 ok(lectura.data.length===0,'Una cuenta sin permiso no enumera pedidos')
 await admin.from('cuentas_acceso').update({habilitada:false}).eq('usuario_id',usuarios[0]).then(r=>assert.ifError(r.error))
 ok((await rpc({...pedidoCliente,p_clave:randomUUID()},cliente)).error?.code==='42501','Revocación se aplica al JWT existente')
 const anonOtraIdentidad=await rpc(pedidoCliente)
 ok(anonOtraIdentidad.error?.code==='22023','Un invitado no recupera el intento de un cliente')
 const finales=await admin.from('pedidos').select('*,detalles_pedido(*)').in('emprendimiento_id',negocios);assert.ifError(finales.error)
 ok(finales.data.every(p=>Math.round(p.subtotal*100)===p.detalles_pedido.reduce((s,d)=>s+Math.round(d.precio_unitario*100)*d.cantidad,0)),'Subtotal coincide con detalles históricos')
 console.log('PASS '+pruebas+' comprobaciones API: atomicidad, contacto, precio, disponibilidad, identidad, privacidad y reintentos concurrentes.')
} finally {
 if(negocios.length){
  for(const tabla of ['pedidos','productos','emprendimientos']){
   const campo=tabla==='emprendimientos'?'id':'emprendimiento_id'
   assert.ifError((await admin.from(tabla).delete().in(campo,negocios)).error)
  }
 }
 for(const id of usuarios)assert.ifError((await admin.auth.admin.deleteUser(id)).error)
}
