import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const clientes=[],usuarios=[],negocios=[],productos=[];let checks=0
function data(r){assert.ifError(r.error);return r.data}
function ok(c,m){assert.ok(c,m);console.log('PASS '+(++checks)+': '+m)}
try{
 for(let i=0;i<3;i++){
 const c=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
 const email='qa-limite-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const u=data(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;usuarios.push(u.id)
 data(await c.auth.signInWithPassword({email,password}));clientes.push(c)
 }
 for(let i=0;i<5;i++){
 const n=data(await admin.from('emprendimientos').insert({nombre:'QA límite '+i,slug:'qa-limite-'+randomUUID()}).select().single());negocios.push(n.id)
 const p=data(await admin.from('productos').insert({emprendimiento_id:n.id,nombre:'Producto QA',precio:100,visible:true}).select().single());productos.push(p.id)
 data(await admin.from('movimientos_stock').insert({emprendimiento_id:n.id,producto_id:p.id,clave:randomUUID(),tipo:'Entrada',cantidad:100,motivo:'Ensayo límites',referencia:''}))
 }
 const solicitud=(i=0)=>({p_clave:randomUUID(),p_negocio:negocios[i],p_contacto:{nombre:'Cliente QA',telefono:'1123456789',metodo_pago:'Efectivo',entrega:{modalidad:'retiro'}},p_items:[{producto_id:productos[i],cantidad:1,precio_centavos:10000}]})
 const pedidos=Array.from({length:8},()=>solicitud())
 const respuestas=await Promise.all(pedidos.map(s=>clientes[0].rpc('confirmar_pedido',s)))
 ok(respuestas.filter(r=>!r.error).length===5,'solo cinco confirmaciones simultáneas')
 ok(respuestas.filter(r=>r.error?.code==='PT429').length===3,'tres rechazos temporales controlados')
 const i=respuestas.findIndex(r=>!r.error)
 const repetido=data(await clientes[0].rpc('confirmar_pedido',pedidos[i]))
 ok(repetido.id===respuestas[i].data.id,'recupera el mismo pedido aun con cupo agotado')
 const stock=data(await admin.from('movimientos_stock').select('cantidad').eq('producto_id',productos[0])).reduce((s,x)=>s+Number(x.cantidad),0)
 ok(stock===95,'rechazos no descuentan stock')
 data(await clientes[1].rpc('confirmar_pedido',solicitud()))
 ok(true,'otra cuenta conserva su propio cupo')
 data(await clientes[0].rpc('confirmar_pedido',solicitud(1)))
 ok(true,'el límite corto es por tienda')
 for(let n=0;n<4;n++)for(let j=0;j<5;j++)data(await clientes[2].rpc('confirmar_pedido',solicitud(n)))
 ok((await clientes[2].rpc('confirmar_pedido',solicitud(4))).error?.code==='PT429','límite global de veinte incluye distintas tiendas')
 const rows=data(await admin.from('pedidos').select('id').eq('cliente_usuario_id',usuarios[2]).order('id'))
 // Solo registros temporales creados por este ensayo.
 data(await admin.from('pedidos').update({fecha_creacion:new Date(Date.now()-61*60000).toISOString()}).eq('id',rows[0].id))
 data(await clientes[2].rpc('confirmar_pedido',solicitud(4)))
 ok(true,'el cupo se libera al salir de la ventana temporal')
 const own=data(await admin.from('pedidos').select('id').eq('cliente_usuario_id',usuarios[0]).eq('emprendimiento_id',negocios[0]))
 data(await admin.from('pedidos').update({estado:'Cancelado',motivo_cancelacion:'Cancelación de ensayo'}).eq('id',own[0].id))
 ok((await clientes[0].rpc('confirmar_pedido',solicitud())).error?.code==='PT429','cancelar no permite evadir el límite')
 console.log('TOTAL '+checks+' comprobaciones')
}finally{
 for(const id of negocios)for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
