import { crearCompradorDePrueba, ingresarDesdeCarrito } from './comprador-de-prueba.mjs'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const browser=await chromium.launch({headless:true})
let negocio, comprador
mkdirSync('test-results',{recursive:true})
async function captura(page,nombre){
 for(const [width,height,formato] of [[1280,900,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desborde '+nombre)
  await page.screenshot({path:'test-results/'+nombre+'-'+formato+'.png',fullPage:true})
 }
 await page.setViewportSize({width:1280,height:900})
}
try{
 comprador = await crearCompradorDePrueba(admin)
 const alta=await admin.from('emprendimientos').insert({nombre:'Cocina de prueba',slug:'qa-confirmar-'+randomUUID()}).select().single()
 assert.ifError(alta.error);negocio=alta.data
 const producto=await admin.from('productos').insert({emprendimiento_id:negocio.id,nombre:'Menú del día de prueba',precio:2500.50,visible:true}).select().single()
 assert.ifError(producto.error)
 assert.ifError((await admin.from('movimientos_stock').insert({emprendimiento_id:negocio.id,producto_id:producto.data.id,clave:randomUUID(),tipo:'Entrada',cantidad:10,motivo:'Existencias de prueba'})).error)
 assert.ifError((await admin.from('productos').insert([{emprendimiento_id:negocio.id,nombre:'Agotado QA',precio:100,visible:true},{emprendimiento_id:negocio.id,nombre:'Oculto QA',precio:100,visible:false}])).error)
 const ctx=await browser.newContext(),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/tienda/'+negocio.slug)
 await page.getByRole('heading',{name:'Cocina de prueba'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Agregar Oculto QA al carrito'}).count(),0)
 assert.ok(await page.getByRole('button',{name:'Agregar Agotado QA al carrito'}).isDisabled())
 assert.equal(await page.locator('.shop-identity img').count(),0,'Alternativas sin imágenes rotas')
 await captura(page,'plantilla-tienda')
 await page.keyboard.press('Tab')
 assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Ir al contenido de la tienda')
 await page.keyboard.press('Enter')
 assert.equal(await page.evaluate(()=>document.activeElement.id),'store-main-content')
 assert.ok(page.url().includes(negocio.slug),'Salto no rompe la ruta')
 await page.getByRole('button',{name:'Carrito (0)',exact:true}).click()
 assert.ok(await page.getByRole('button',{name:'Continuar con el pedido'}).isDisabled())
 await page.getByRole('button',{name:'Seguir eligiendo'}).click()
 async function preparar(conIngreso = false){
  await page.getByRole('button',{name:'Agregar Menú del día de prueba al carrito',exact:true}).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button',{name:'Carrito (1)',exact:true}).click()
  await page.getByRole('button',{name:'Continuar con el pedido'}).click()
  if (conIngreso) await ingresarDesdeCarrito(page, comprador, negocio.slug)
  await page.getByLabel('Nombre de contacto').fill('Persona de prueba')
  await page.getByLabel('Teléfono de contacto').fill('11 1234 5678')
  await page.getByLabel('¿Cómo pensás pagar?').selectOption('Efectivo')
 }
 await preparar(true)
 await captura(page,'confirmar-pedido')
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).dblclick()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 const primerNumero=await page.locator('.order-number').innerText()
 let datos=await admin.from('pedidos').select('*,detalles_pedido(*)').eq('emprendimiento_id',negocio.id);assert.ifError(datos.error)
 assert.equal(datos.data[0].cliente_usuario_id, comprador.id);assert.equal(datos.data.length,1);assert.equal(datos.data[0].subtotal,2500.50);assert.equal(datos.data[0].detalles_pedido.length,1)
 await captura(page,'pedido-registrado')
 await page.reload()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 assert.equal(await page.locator('.order-number').innerText(),primerNumero)
 await page.getByRole('button',{name:'Volver a la tienda'}).click()
 await page.getByRole('button',{name:'Carrito (0)',exact:true}).waitFor()
 await preparar()
 // Se guarda en el servidor, pero simulamos perder la respuesta antes de que llegue al navegador.
 let perdido=false,recibido
 await page.route('**/rest/v1/rpc/confirmar_pedido',async route=>{
  if(perdido){await route.continue();return}
  perdido=true
  const respuesta=await route.fetch()
  recibido=await respuesta.json()
  assert.ok(recibido.id)
  await route.abort('failed')
 })
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'sin duplicar'}).waitFor()
 await page.reload()
 await page.getByRole('button',{name:'Reintentar confirmación'}).click()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 assert.equal(await page.locator('.order-number').innerText(),'Pedido #'+recibido.id)
 datos=await admin.from('pedidos').select('id').eq('emprendimiento_id',negocio.id);assert.ifError(datos.error)
 assert.equal(datos.data.length,2,'Respuesta perdida no crea un tercer pedido')
 await page.unroute('**/rest/v1/rpc/confirmar_pedido')
 await page.getByRole('button',{name:'Volver a la tienda'}).click()
 await preparar()
 assert.ifError((await admin.from('productos').update({precio:3000}).eq('id',producto.data.id)).error)
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Cambió el precio'}).waitFor()
 await page.getByRole('button',{name:'Volver al carrito'}).click()
 await page.getByTestId('subtotal').filter({hasText:'3.000,00'}).waitFor()
 await page.getByRole('button',{name:'Carrito (1)',exact:true}).waitFor()
 assert.equal((await admin.from('movimientos_stock').select('cantidad').eq('producto_id',producto.data.id)).data.reduce((n,m)=>n+Number(m.cantidad),0),8,'Dos confirmaciones descuentan solo dos unidades')
 assert.deepEqual(errores,[])
 await ctx.close()
 console.log('PASS plantilla: escritorio/móvil, teclado y salto, alternativas de identidad, ocultos/agotados, carrito vacío, contacto/pago, doble clic, persistencia/recarga, recuperación sin duplicar, precios y stock.')
}finally{
 await browser.close()
 if(negocio){
  for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','productos','emprendimientos']){
   assert.ifError((await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',negocio.id)).error)
  }
 }
 if (comprador) assert.ifError((await admin.auth.admin.deleteUser(comprador.id)).error)
}
