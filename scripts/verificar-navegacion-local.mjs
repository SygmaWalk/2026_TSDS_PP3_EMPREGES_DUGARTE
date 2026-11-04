import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'

const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const nuevo=()=>createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const actor=nuevo(),lector=nuevo(),ajeno=nuevo(),invitado=nuevo(),usuarios=[],negocios=[]

let browser,checks=0
function data(r){assert.ifError(r.error);return r.data}
function ok(cond,mensaje){assert.ok(cond,mensaje);checks++;console.log('PASS '+checks+': '+mensaje)}
async function cuenta(client){
 const email='qa-stock-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const u=data(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;usuarios.push(u.id)
 data(await admin.from('cuentas_acceso').update({rol:'emprendimiento'}).eq('usuario_id',u.id))
 data(await client.auth.signInWithPassword({email,password}));return {...u,email,password}
}
try{
 const a=await cuenta(actor),l=await cuenta(lector),b=await cuenta(ajeno)
 for(const nombre of ['Inventario QA','Inventario ajeno QA'])negocios.push(data(await admin.from('emprendimientos').insert({nombre,slug:'qa-stock-'+randomUUID()}).select().single()).id)
 const [negocio,otro]=negocios
 for(const [u,n,permisos]of [[a,negocio,['productos.ver','stock.ver','stock.registrar','tienda.configurar']],[l,negocio,['productos.ver','stock.ver']],[b,otro,['productos.ver','stock.ver','stock.registrar','tienda.configurar']]]){
  data(await admin.from('miembros_emprendimiento').insert({usuario_id:u.id,emprendimiento_id:n}))
  data(await admin.from('permisos_miembro').insert(permisos.map(permiso=>({usuario_id:u.id,emprendimiento_id:n,permiso}))))
 }
 const p=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Gaseosa QA',precio:1500,visible:true}).select().single())
 const oculto=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Oculto QA',precio:100,visible:false}).select().single())
 const extranjero=data(await admin.from('productos').insert({emprendimiento_id:otro,nombre:'Gaseosa ajena QA',precio:1500,visible:true}).select().single())


 data(await admin.from('permisos_miembro').insert(['productos.crear','productos.editar','productos.publicar','pedidos.ver','clientes.ver','clientes.editar','entregas.configurar'].map(permiso=>({usuario_id:a.id,emprendimiento_id:negocio,permiso}))))
 data(await admin.from('movimientos_stock').insert({emprendimiento_id:negocio,producto_id:p.id,clave:randomUUID(),tipo:'Entrada',cantidad:20,motivo:'Prueba UX'}))
 const crear=()=>invitado.rpc('confirmar_pedido',{p_clave:randomUUID(),p_negocio:negocio,p_contacto:{nombre:'Cliente UX',telefono:'1123456789',metodo_pago:'Efectivo',entrega:{modalidad:'retiro'}},p_items:[{producto_id:p.id,cantidad:1,precio_centavos:150000}]})
 const pedido=data(await crear())
 const segundo=data(await admin.from('emprendimientos').insert({nombre:'Segundo negocio UX',slug:'qa-ux-'+randomUUID()}).select().single());negocios.push(segundo.id)
 data(await admin.from('miembros_emprendimiento').insert({usuario_id:a.id,emprendimiento_id:segundo.id}))
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:segundo.id,permiso:'pedidos.ver'}))
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:1360,height:900}}),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('heading',{name:'Pedidos',exact:true}).waitFor()
 ok(page.url().endsWith('/panel/'+negocio+'/pedidos'),'inicio directo en pedidos')
 await page.getByText('Pedidos en vivo',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Activar sonido',exact:true}).click()
 await page.getByRole('button',{name:'Silenciar sonido',exact:true}).waitFor()
 const nav=page.getByRole('complementary',{name:'Navegación del emprendimiento'})
 await nav.getByRole('link',{name:'Productos',exact:true}).click()
 await page.getByRole('heading',{name:'Productos',exact:true}).waitFor()
 ok(page.url().endsWith('/productos'),'sección con dirección propia')
 ok(await page.getByRole('button',{name:/Carrito/}).count()===0,'sin carrito de demostración')
 ok(await page.getByRole('heading',{name:'Vista previa del catálogo'}).count()===0,'sin vista previa duplicada')
 ok(await page.getByRole('button',{name:'Silenciar sonido',exact:true}).isVisible(),'sonido conserva activación al cambiar sección')
 await page.goBack();await page.getByRole('heading',{name:'Pedidos',exact:true}).waitFor()
 await page.goForward();await page.getByRole('heading',{name:'Productos',exact:true}).waitFor()
 await page.reload();await page.getByRole('heading',{name:'Productos',exact:true}).waitFor()
 ok(true,'atrás adelante y recarga conservan sección')
 await page.getByText('Pedidos en vivo',{exact:true}).waitFor()
 data(await crear())
 await page.getByText('Llegó un pedido nuevo',{exact:true}).waitFor()
 ok(true,'nuevo pedido notifica mientras se gestionan productos')
 await page.getByRole('button',{name:'Nuevo producto',exact:true}).click()
 await page.getByLabel(/^Nombre/).fill('Borrador UX')
 page.once('dialog',d=>d.dismiss())
 await nav.getByRole('link',{name:'Inventario',exact:true}).click()
 ok(await page.getByLabel(/^Nombre/).inputValue()==='Borrador UX','rechazar salida conserva formulario')
 page.once('dialog',d=>d.dismiss())
 await page.goBack()
 await page.waitForURL('**/panel/'+negocio+'/productos')
 ok(await page.getByLabel(/^Nombre/).inputValue()==='Borrador UX','cancelar Atrás conserva dirección y formulario')
 page.once('dialog',d=>d.accept())
 await nav.getByRole('link',{name:'Inventario',exact:true}).click()
 await page.getByRole('heading',{name:'Inventario',exact:true}).waitFor()
 ok(true,'aceptar salida permite cambiar sección')
 await page.getByRole('button',{name:'Ver inventario de Gaseosa QA',exact:true}).click()
 await page.getByRole('heading',{name:'Movimientos',exact:true}).waitFor()
 ok(page.url().endsWith('/stock/'+p.id),'inventario con enlace al detalle')
 await page.goBack()
 await page.getByRole('button',{name:'Ver inventario de Gaseosa QA',exact:true}).waitFor()
 ok(true,'atrás del movimiento vuelve al inventario')
 await nav.getByRole('link',{name:'Pedidos',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedido #'+pedido.id,exact:true}).click()
 await page.getByRole('heading',{name:'Pedido #'+pedido.id,exact:true}).waitFor()
 ok(page.url().endsWith('/pedidos/'+pedido.id),'detalle con enlace propio')
 await page.reload();await page.getByRole('heading',{name:'Pedido #'+pedido.id,exact:true}).waitFor()
 await page.goBack();await page.getByRole('heading',{name:'Pedidos',exact:true}).waitFor()
 await page.getByRole('button',{name:'Ver pedido #'+pedido.id,exact:true}).waitFor();ok(true,'atrás del detalle recupera listado')
 await page.getByText('Fechas y filtros avanzados',{exact:true}).click()
 await page.getByLabel('Estado',{exact:true}).selectOption('Pendiente')
 await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click()
 await nav.getByRole('link',{name:'Productos',exact:true}).click()
 await nav.getByRole('link',{name:'Pedidos',exact:true}).click()
 await page.getByText('Fechas y filtros avanzados',{exact:true}).click()
 ok(await page.getByLabel('Estado',{exact:true}).inputValue()==='Pendiente','conserva filtros al volver')
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of [[1360,900,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height});await page.screenshot({path:'test-results/navegacion-'+tipo+'.png',fullPage:true})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
 }
 await page.getByRole('button',{name:'Menú',exact:true}).click()
 await nav.getByRole('link',{name:'Productos',exact:true}).click()
 await page.getByRole('heading',{name:'Productos',exact:true}).waitFor()
 ok(!(await nav.isVisible()),'menú móvil se cierra al navegar')
 await page.screenshot({path:'test-results/productos-limpio-movil.png',fullPage:true})
 await page.setViewportSize({width:1360,height:900})
 await page.getByLabel('Emprendimiento',{exact:true}).selectOption(String(segundo.id))
 await page.getByRole('heading',{name:'Pedidos',exact:true}).waitFor()
 ok(page.url().includes('/panel/'+segundo.id+'/pedidos'),'cambia negocio sin mezclar contexto')
 await page.goto('http://127.0.0.1:5173/#/cuenta')
 await page.waitForURL('**/panel/'+segundo.id+'/pedidos')
 ok(true,'recuerda último negocio autorizado')
 await page.getByLabel('Emprendimiento',{exact:true}).selectOption(String(negocio))
 await nav.getByRole('link',{name:'Productos',exact:true}).click()
 await page.getByRole('button',{name:'Nuevo producto',exact:true}).click()
 await page.getByLabel(/^Nombre/).fill('Producto creado UX')
 await page.getByLabel(/^Precio/).fill('250')
 await page.getByRole('button',{name:'Crear producto',exact:true}).click()
 await page.getByRole('heading',{name:'Producto creado UX',exact:true}).waitFor()
 ok(true,'alta de producto confirmada vuelve al listado')
 await page.goto('http://127.0.0.1:5173/#/panel/'+otro+'/productos')
 await page.getByRole('alert').filter({hasText:'No tenés acceso'}).waitFor()
 ok(true,'enlace a otro negocio denegado')
 ok(!errores.length,'sin errores JavaScript')
 console.log('PASS '+checks+' comprobaciones UX')
}finally{
 await browser?.close()
 for(const c of [actor,lector,ajeno,invitado])await c.removeAllChannels()
 for(const id of negocios)for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
