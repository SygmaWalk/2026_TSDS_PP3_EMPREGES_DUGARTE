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
let negocio
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
 const alta=await admin.from('emprendimientos').insert({nombre:'Cocina de prueba',slug:'qa-confirmar-'+randomUUID()}).select().single()
 assert.ifError(alta.error);negocio=alta.data
 const producto=await admin.from('productos').insert({emprendimiento_id:negocio.id,nombre:'Menú del día de prueba',precio:2500.50,visible:true}).select().single()
 assert.ifError(producto.error)
 const ctx=await browser.newContext(),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/tienda/'+negocio.slug)
 await page.getByRole('button',{name:'Carrito (0)',exact:true}).click()
 assert.ok(await page.getByRole('button',{name:'Continuar con el pedido'}).isDisabled())
 await page.getByRole('button',{name:'Seguir eligiendo'}).click()
 async function preparar(){
  await page.getByRole('button',{name:'Agregar Menú del día de prueba al carrito',exact:true}).click()
  await page.getByRole('button',{name:'Carrito (1)',exact:true}).click()
  await page.getByRole('button',{name:'Continuar con el pedido'}).click()
  await page.getByLabel('Nombre de contacto').fill('Persona de prueba')
  await page.getByLabel('Teléfono de contacto').fill('11 1234 5678')
 }
 await preparar()
 await captura(page,'confirmar-pedido')
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).dblclick()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 const primerNumero=await page.locator('.order-number').innerText()
 let datos=await admin.from('pedidos').select('*,detalles_pedido(*)').eq('emprendimiento_id',negocio.id);assert.ifError(datos.error)
 assert.equal(datos.data.length,1);assert.equal(datos.data[0].subtotal,2500.50);assert.equal(datos.data[0].detalles_pedido.length,1)
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
 assert.deepEqual(errores,[])
 await ctx.close()
 console.log('PASS navegador: vacío, contacto, doble clic, guardado real, recibo tras recarga, carrito vaciado, respuesta perdida sin duplicar, precio cambiado y móvil.')
}finally{
 await browser.close()
 if(negocio){
  for(const tabla of ['pedidos','productos','emprendimientos']){
   assert.ifError((await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',negocio.id)).error)
  }
 }
}
