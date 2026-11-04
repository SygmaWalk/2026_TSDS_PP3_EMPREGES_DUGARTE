import { crearClientesRepository } from '../src/features/clientes/clientesRepository.js'
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
try{
 const a=await cuenta(actor),l=await cuenta(lector),b=await cuenta(ajeno)
 for(const nombre of ['Cocina en vivo QA','Negocio ajeno QA'])negocios.push(data(await admin.from('emprendimientos').insert({nombre,slug:'qa-estados-'+randomUUID()}).select().single()).id)
 const [negocio,otro]=negocios
 for(const [u,n,permisos]of[[a,negocio,['pedidos.ver','pedidos.actualizar_estado']],[l,negocio,['pedidos.ver']],[b,otro,['pedidos.ver','pedidos.actualizar_estado']]]){
  data(await admin.from('miembros_emprendimiento').insert({usuario_id:u.id,emprendimiento_id:n}))
  data(await admin.from('permisos_miembro').insert(permisos.map(permiso=>({usuario_id:u.id,emprendimiento_id:n,permiso}))))
 }
 const producto=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Menú de prueba',precio:1500,visible:true}).select().single())

 for(const permiso of ['clientes.ver','clientes.editar'])data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso}))
 data(await admin.from('permisos_miembro').insert({usuario_id:l.id,emprendimiento_id:negocio,permiso:'clientes.ver'}))
 data(await admin.from('permisos_miembro').insert({usuario_id:b.id,emprendimiento_id:otro,permiso:'clientes.ver'}))
 const prodOtro=data(await admin.from('productos').insert({emprendimiento_id:otro,nombre:'Otro',precio:1500,visible:true}).select().single())
 const payload=(telefono,n=negocio,productoId=producto.id,nombre='Ana QA')=>({p_clave:randomUUID(),p_negocio:n,p_contacto:{nombre,telefono,metodo_pago:'Efectivo',entrega:{modalidad:'retiro'}},p_items:[{producto_id:productoId,cantidad:1,precio_centavos:150000}]})
 const crear=async(...args)=>data(await invitado.rpc('confirmar_pedido',payload(...args)))
 const leerPedido=async id=>data(await admin.from('pedidos').select('*').eq('id',id).single())
 const fichas=async(c=actor,n=negocio)=>data(await c.from('clientes_comerciales').select('*').eq('emprendimiento_id',n))
 const guardar=(c,f,extra={},n=negocio)=>c.rpc('editar_cliente_comercial',{p_cliente:f.id,p_negocio:n,p_version:f.version,p_nombre:f.nombre,p_telefono:f.telefono,p_direccion:f.direccion,p_referencia:f.referencia,...extra})
 const sol=payload('+54 (11) 1234-5678'),r=data(await invitado.rpc('confirmar_pedido',sol))
 ok(data(await invitado.rpc('confirmar_pedido',sol)).id===r.id,'reintento no duplica pedido ni ficha')
 const primero=await leerPedido(r.id)
 ok(!!primero.cliente_comercial_id&&primero.cliente_usuario_id===null,'invitado vinculado sin crear cuenta')
 await crear('541112345678')
 const paralelos=await Promise.all([crear('+54 11 1234-5678'),crear('541112345678')])
 let lista=await fichas(),f=lista[0]
 ok(lista.length===1&&f.telefono_normalizado==='541112345678','normalización y concurrencia sin duplicados')
 for(const p of paralelos)ok((await leerPedido(p.id)).cliente_comercial_id===f.id,'pedidos asociados')
 const extranjero=await crear('541112345678',otro,prodOtro.id)
 ok((await leerPedido(extranjero.id)).cliente_comercial_id!==f.id,'misma persona separada por negocio')
 ok((await fichas(ajeno)).length===0,'RLS niega negocio ajeno')
 ok((await invitado.from('clientes_comerciales').select('*')).error?.code==='42501','invitado no consulta fichas')
 ok((await fichas(lector)).length===1,'lector autorizado consulta')
 ok((await guardar(lector,f)).error?.code==='42501','lector no edita')
 ok((await guardar(ajeno,f)).error?.code==='42501','ajeno no edita')
 ok(!!(await guardar(invitado,f)).error,'invitado no edita')
 ok(!!(await actor.from('clientes_comerciales').update({nombre:'Intruso'}).eq('id',f.id)).error,'sin UPDATE directo')
 ok(!!(await actor.from('clientes_comerciales').insert({emprendimiento_id:negocio,nombre:'Intruso',telefono:'1123456789'})).error,'sin INSERT directo')
 const carrera=await Promise.all([guardar(actor,f,{p_nombre:'Ana corregida',p_direccion:'Nueva calle 456'}),guardar(actor,f,{p_nombre:'Otro cambio'})])
 ok(carrera.filter(x=>!x.error).length===1&&carrera.some(x=>x.error?.code==='PT409'),'edición concurrente protegida')
 const posterior=await leerPedido(r.id)
 ok(posterior.nombre_contacto===primero.nombre_contacto&&posterior.telefono_contacto===primero.telefono_contacto&&JSON.stringify(posterior.entrega)===JSON.stringify(primero.entrega),'edición no modifica pedido histórico')
 f=(await fichas())[0]
 await crear('541112345678',negocio,producto.id,'Nombre enviado por invitado')
 ok((await fichas())[0].nombre===f.nombre,'invitado no sobrescribe correcciones internas')
 await crear('1198765432',negocio,producto.id,'Otro cliente')
 ok((await guardar(actor,f,{p_telefono:'11 9876-5432'})).error?.code==='PT422','no fusiona teléfonos duplicados silenciosamente')
 ok((await guardar(actor,f,{p_telefono:'abc'})).error?.code==='22023','rechaza teléfono inválido')
 data(await guardar(actor,f,{p_nombre:'Ana QA corregida',p_telefono:'+54 11 5555-6666',p_direccion:'Calle nueva 456'}))
 const nuevo=await crear('541155556666')
 ok((await leerPedido(nuevo.id)).cliente_comercial_id===f.id,'nuevo teléfono reutiliza ficha editada')
 ok((await leerPedido(r.id)).cliente_comercial_id===f.id,'pedido anterior conserva vínculo')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','clientes.editar'))
 f=(await fichas()).find(x=>x.id===f.id)
 ok((await guardar(actor,f)).error?.code==='42501','revocación edición inmediata')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'clientes.editar'}))
 data(await admin.from('cuentas_acceso').update({habilitada:false}).eq('usuario_id',a.id))
 ok((await fichas()).length===0&&(await guardar(actor,f)).error?.code==='42501','cuenta deshabilitada pierde acceso')
 data(await admin.from('cuentas_acceso').update({habilitada:true}).eq('usuario_id',a.id))
 data(await admin.from('miembros_emprendimiento').update({habilitada:false}).eq('usuario_id',a.id))
 ok((await fichas()).length===0,'asociación deshabilitada pierde lectura')
 data(await admin.from('miembros_emprendimiento').update({habilitada:true}).eq('usuario_id',a.id))
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','clientes.ver'))
 ok((await fichas()).length===0,'revocación lectura inmediata')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'clientes.ver'}))

 const repo=crearClientesRepository(actor,negocio,a.id)
 ok((await repo.listar(0,'aNa qa')).clientes.some(c=>c.id===f.id),'búsqueda parcial sin distinguir mayúsculas')
 ok((await repo.listar(0,'11 5555-66')).clientes.some(c=>c.id===f.id),'búsqueda por teléfono con formato')
 ok((await repo.listar(0,'zzSinCoincidencias')).total===0,'búsqueda sin resultados')
 ok((await repo.listar(0,'%')).total===0,'porcentaje no actúa como comodín')
 ok((await repo.listar(0,"Ana,telefono_normalizado.neq.0")).total===0,'texto especial no altera filtros')
 const historico=await repo.historial(f.id)
 ok(historico.total===6&&historico.pedidos.some(p=>p.id===r.id),'historial mantiene compras previas al cambio de teléfono')
 ok(historico.pedidos[0].id===nuevo.id,'historial más reciente primero')
 const detalle=await repo.detallePedido(r.id,f.id)
 ok(detalle.nombre_contacto===primero.nombre_contacto&&detalle.telefono_contacto===primero.telefono_contacto,'detalle conserva contacto original')
 const otraFicha=(await fichas()).find(c=>c.id!==f.id)
 ok(await repo.detallePedido(r.id,otraFicha.id)===null,'pedido de otra ficha no se abre')
 ok(await repo.detallePedido(extranjero.id,f.id)===null,'pedido ajeno no se abre')
 ok((await repo.historial((await leerPedido(extranjero.id)).cliente_comercial_id)).total===0,'historial excluye ficha de otro negocio')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',l.id).eq('permiso','pedidos.ver'))
 await assert.rejects(()=>crearClientesRepository(lector,negocio,l.id).historial(f.id),/permiso/)
 ok(true,'permiso de clientes solo no permite historial')
 ok(data(await lector.from('pedidos').select('id').eq('cliente_comercial_id',f.id)).length===0,'RLS niega pedidos sin permiso')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','clientes.ver'))
 await assert.rejects(()=>repo.historial(f.id),/acceso/)
 ok(true,'revocación de clientes impide historial')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'clientes.ver'}))
 // Superar una página tanto en fichas como en historial.
 for(let i=0;i<26;i++)await crear('119000'+String(i).padStart(4,'0'),negocio,producto.id,'Cliente paginado '+String(i).padStart(2,'0'))
 ok((await repo.listar(0)).clientes.length===25&&(await repo.listar(1)).clientes.length===3,'paginación de fichas sin pérdida')
 ok((await repo.listar(0,'Cliente paginado 25')).total===1,'busca fuera de la primera página')
 for(let i=0;i<20;i++)await crear('541155556666')
 const h1=await repo.historial(f.id),h2=await repo.historial(f.id,1)
 ok(h1.total===26&&h1.pedidos.length===25&&h2.pedidos.length===1,'historial paginado completo')
 ok(new Set([...h1.pedidos,...h2.pedidos].map(p=>p.id)).size===26,'paginación sin duplicados')

 browser=await chromium.launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:1360,height:1000}}),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('button',{name:'Ver clientes de Cocina en vivo QA',exact:true}).click()
 await page.getByRole('button',{name:'Ver ficha de Ana QA corregida',exact:true}).click()
 await page.getByRole('button',{name:'Editar datos del cliente',exact:true}).click()
 await page.getByLabel('Dirección de contacto').fill('Domicilio corregido desde el panel')
 await page.getByRole('button',{name:'Guardar datos del cliente',exact:true}).click()
 await page.getByText('Datos del cliente actualizados.',{exact:true}).waitFor()
 ok((await fichas()).find(x=>x.id===f.id).direccion==='Domicilio corregido desde el panel','edición real en navegador')

 await page.getByRole('button',{name:'Volver a clientes',exact:true}).click()
 await page.getByLabel('Buscar por nombre o teléfono').fill('11 5555-66')
 await page.getByRole('button',{name:'Buscar clientes',exact:true}).click()
 await page.getByText('1 clientes encontrados',{exact:true}).waitFor()
 ok(true,'búsqueda de teléfono desde navegador')
 await page.getByRole('button',{name:'Ver ficha de Ana QA corregida',exact:true}).click()
 const historial=page.getByRole('region',{name:'Historial de pedidos del cliente'})
 await historial.getByText('26 pedidos registrados',{exact:true}).waitFor()
 await historial.getByRole('button',{name:'Más pedidos',exact:true}).click()
 await historial.getByRole('button',{name:'Ver pedido #'+r.id,exact:true}).click()
 await page.getByRole('heading',{name:'Pedido #'+r.id,exact:true}).waitFor()
 await page.getByText('Productos del pedido',{exact:true}).waitFor()
 ok(true,'navegación de historial paginado a detalle original')
 await page.getByRole('button',{name:'← Volver al historial del cliente',exact:true}).click()
 await historial.getByRole('button',{name:'Ver pedido #'+r.id,exact:true}).waitFor()
 ok(true,'volver conserva página del historial')

 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of[[1360,1000,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
  await page.screenshot({path:'test-results/cliente-historial-'+tipo+'.png',fullPage:true})
 }
 await page.getByRole('button',{name:'Volver a clientes',exact:true}).click()
 await page.getByRole('button',{name:'Ver ficha de Ana QA corregida',exact:true}).waitFor()
 ok(await page.getByLabel('Buscar por nombre o teléfono').inputValue()==='11 5555-66','volver conserva búsqueda')
 ok(errores.length===0,'navegador sin errores')
 console.log('PASS '+checks+' comprobaciones de clientes comerciales')
} finally {
 await browser?.close()
 for(const c of clientes)await c.removeAllChannels()
 for(const id of negocios){
  for(const tabla of ['pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 }
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
