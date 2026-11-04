import { crearCompradorDePrueba, ingresarDesdeCarrito } from './comprador-de-prueba.mjs'
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
 const comprador = await crearCompradorDePrueba(admin)
 usuarios.push(comprador.id)
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


 const q=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Pizza QA',precio:2200,visible:true}).select().single())
 data(await admin.from('movimientos_stock').insert({emprendimiento_id:negocio,producto_id:p.id,clave:randomUUID(),tipo:'Entrada',cantidad:10,motivo:'QA distribución'}))
 const identidad={logo_path:null,portada_path:null,color_principal:'#204c3b',color_fondo:'#faf8f4'}
 const guardar=(version,dist,c=actor,n=negocio,ident=identidad)=>c.rpc('guardar_configuracion_tienda',{p_negocio:n,p_version:version,p_identidad:ident,p_distribucion:dist})
 const publicar=version=>actor.rpc('publicar_apariencia',{p_negocio:negocio,p_version:version})
 const publico=()=>invitado.rpc('apariencia_publicada',{p_negocio:negocio})
 const orden=[q.id,oculto.id,p.id],dist={presentacion:'lista',orden_productos:orden}
 ok(data(await actor.rpc('catalogo_configurable',{p_negocio:negocio})).length===3,'editor carga visibles y ocultos')
 for(const c of [lector,ajeno,invitado]){
  ok(!!(await c.rpc('catalogo_configurable',{p_negocio:negocio})).error,'sin permiso no enumera catálogo interno')
  ok(!!(await guardar(null,dist,c)).error,'sin permiso no guarda distribución')
 }
 ok(!!(await guardar(null,dist,actor,otro)).error,'no modifica configuración ajena')
 let r=data(await guardar(null,dist))
 ok(r.borrador.presentacion==='lista'&&JSON.stringify(r.borrador.orden_productos)===JSON.stringify(orden),'guarda presentación y orden')
 ok(data(await publico())===null,'borrador no cambia tienda pública')
 for(const d of [{...dist,presentacion:'mosaico'},{...dist,orden_productos:[p.id,p.id]},{...dist,orden_productos:[extranjero.id]},{...dist,orden_productos:[999999999]},{...dist,orden_productos:['1']},{...dist,orden_productos:null},null]){
  ok((await guardar(r.version,d)).error?.code==='22023','rechaza distribución inválida sin modificar el borrador')
 }
 ok((await guardar(null,dist)).error?.code==='PT409','rechaza guardado desactualizado')
 r=data(await publicar(r.version));ok(data(await publico()).color_principal==='#204c3b','publicar distribución conserva identidad')
 r=data(await actor.rpc('guardar_apariencia',{p_negocio:negocio,p_version:r.version,p_identidad:{...identidad,color_principal:'#9f2144'}}))
 ok(JSON.stringify(r.borrador.orden_productos)===JSON.stringify(orden)&&r.borrador.presentacion==='lista','editar identidad conserva distribución')
 r=data(await publicar(r.version))
 const nuevoProducto=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Nuevo QA',precio:100,visible:true}).select().single())
 const tienda=data(await admin.from('emprendimientos').select('slug').eq('id',negocio).single())
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 const url='http://127.0.0.1:5173/#/tienda/'+tienda.slug
 await page.goto(url);await page.getByRole('heading',{name:'Inventario QA',exact:true}).waitFor()
 const nombres=()=>page.locator('.preview-grid>li>strong').allTextContents()
 assert.deepEqual(await nombres(),['Pizza QA','Gaseosa QA','Nuevo QA']);ok(true,'orden público respeta ocultos y agrega nuevos al final')
 ok(await page.locator('.preview-list').count()===1,'vista lista publicada')
 ok(await page.getByRole('button',{name:'Agregar Pizza QA al carrito'}).isDisabled(),'lista conserva restricción por stock')
 data(await admin.from('productos').update({visible:false}).eq('id',q.id))
 await page.reload();await page.getByRole('heading',{name:'Inventario QA',exact:true}).waitFor()
 assert.deepEqual(await nombres(),['Gaseosa QA','Nuevo QA']);ok(true,'ocultar conserva posiciones relativas')
 data(await admin.from('productos').update({visible:true}).eq('id',q.id))
 await page.reload();await page.getByRole('heading',{name:'Inventario QA',exact:true}).waitFor()
 assert.deepEqual(await nombres(),['Pizza QA','Gaseosa QA','Nuevo QA']);ok(true,'volver a mostrar recupera posición')
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of [[1280,900,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'lista pública sin desborde '+tipo)
  await page.screenshot({path:'test-results/catalogo-lista-'+tipo+'.png',fullPage:true})
 }
 await page.getByRole('button',{name:'Agregar Gaseosa QA al carrito'}).click()
 await page.getByRole('button',{name:'Carrito (1)',exact:true}).click()
 await page.getByRole('button',{name:'Continuar con el pedido'}).click()
 await ingresarDesdeCarrito(page, comprador, tienda.slug)
 await page.getByLabel('Nombre de contacto').fill('Cliente distribución QA')
 await page.getByLabel('Teléfono de contacto').fill('11 1234 5678')
 await page.getByLabel('¿Cómo pensás pagar?').selectOption('Efectivo')
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 ok(data(await admin.from('pedidos').select('id').eq('emprendimiento_id',negocio)).length===1,'compra desde lista en celular')
 const editor=await browser.newPage({viewport:{width:1280,height:900}})
 editor.on('pageerror',e=>errores.push(e.message))
 await editor.goto('http://127.0.0.1:5173/#/ingresar')
 await editor.getByLabel('Correo electrónico').fill(a.email);await editor.getByLabel('Contraseña',{exact:true}).fill(a.password)
 await editor.getByRole('button',{name:'Ingresar',exact:true}).click()
 await editor.getByRole('complementary',{name:'Navegación del emprendimiento'}).getByRole('link',{name:'Tienda',exact:true}).click()
 await editor.getByLabel('Vista de los productos').waitFor()
 ok(await editor.getByLabel('Vista de los productos').inputValue()==='lista','editor recupera distribución')
 await editor.getByLabel('Vista de los productos').selectOption('cuadricula')
 await editor.getByRole('button',{name:'Subir Gaseosa QA',exact:true}).focus();await editor.keyboard.press('Enter')
 assert.deepEqual(await editor.locator('.catalog-order li strong').allTextContents(),['Pizza QA','Gaseosa QA','Oculto QA','Nuevo QA']);ok(true,'reordenar con teclado incluye ocultos')
 await editor.getByRole('button',{name:'Previsualizar',exact:true}).click()
 const frame=editor.frameLocator('iframe')
 await frame.locator('.preview-grid').waitFor()
 assert.deepEqual(await frame.locator('.preview-grid>li>strong').allTextContents(),['Pizza QA','Gaseosa QA','Nuevo QA'])
 ok(await frame.locator('.preview-list').count()===0,'previsualiza cuadrícula sin publicar')
 await editor.route('**/rest/v1/rpc/guardar_configuracion_tienda',route=>route.abort('failed'))
 await editor.getByRole('button',{name:'Guardar borrador',exact:true}).click()
 await editor.getByRole('alert').waitFor()
 ok(await editor.getByLabel('Vista de los productos').inputValue()==='cuadricula','error conserva formulario')
 ok(data(await publico()).presentacion==='lista','error conserva versión pública')
 await editor.unroute('**/rest/v1/rpc/guardar_configuracion_tienda')
 await editor.getByRole('button',{name:'Guardar borrador',exact:true}).click()
 await editor.getByText('Borrador guardado. La tienda pública conserva su versión anterior.').waitFor()
 await editor.getByRole('button',{name:'Recargar borrador',exact:true}).click()
 await editor.getByLabel('Vista de los productos').waitFor()
 ok(await editor.getByLabel('Vista de los productos').inputValue()==='cuadricula','borrador persiste al recuperar')
 await editor.getByRole('button',{name:'Publicar',exact:true}).click()
 await editor.getByText('La identidad de tu tienda quedó publicada.').waitFor()
 await page.getByRole('button',{name:'Volver a la tienda',exact:true}).click();await page.reload();await page.locator('.preview-grid').waitFor()
 ok(await page.locator('.preview-list').count()===0,'publica cuadrícula')
 ok(data(await publico()).color_principal==='#9f2144','publicar desde editor conserva colores')
 for(const [width,height,tipo]of [[1280,900,'escritorio'],[390,844,'movil']]){
  await editor.setViewportSize({width,height})
  ok(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'editor sin desborde '+tipo)
  await editor.screenshot({path:'test-results/catalogo-orden-'+tipo+'.png',fullPage:true})
 }
 // Completar también una compra en la cuadrícula publicada desde escritorio.
 await page.setViewportSize({width:1280,height:900})
 await page.getByRole('button',{name:'Agregar Gaseosa QA al carrito'}).click()
 await page.getByRole('button',{name:'Carrito (1)',exact:true}).click()
 await page.getByRole('button',{name:'Continuar con el pedido'}).click()
 await page.getByLabel('Nombre de contacto').fill('Cliente distribución QA')
 await page.getByLabel('Teléfono de contacto').fill('11 1234 5678')
 await page.getByLabel('¿Cómo pensás pagar?').selectOption('Efectivo')
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 const compras = data(await admin.from('pedidos').select('cliente_usuario_id').eq('emprendimiento_id',negocio))
 ok(compras.length===2 && compras.every(pedido=>pedido.cliente_usuario_id===comprador.id),'ambas presentaciones registran la compra con la identidad del cliente')
 // La eliminación posterior no bloquea nuevas ediciones: recargar limpia referencias obsoletas.
 data(await admin.from('productos').delete().eq('id',oculto.id))
 await editor.getByRole('button',{name:'Recargar borrador',exact:true}).click()
 await editor.getByRole('button',{name:'Subir Oculto QA',exact:true}).waitFor({state:'detached'})
 await editor.getByRole('button',{name:'Guardar borrador',exact:true}).click()
 await editor.getByText('Borrador guardado. La tienda pública conserva su versión anterior.').waitFor()
 ok(true,'eliminar un producto no bloquea guardar después de recargar')
 ok(!errores.length,'sin errores JavaScript')
 console.log('PASS '+checks+' comprobaciones de distribución')
}finally{
 await browser?.close()
 for(const c of [actor,lector,ajeno,invitado])await c.removeAllChannels()
 for(const id of negocios){
  const pedidos=data(await admin.from('pedidos').select('id').eq('emprendimiento_id',id))
  for(const pedido of pedidos)data(await admin.from('detalles_pedido').delete().eq('pedido_id',pedido.id))
  for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 }
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
