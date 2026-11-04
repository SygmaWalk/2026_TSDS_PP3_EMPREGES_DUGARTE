import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { crearPanelPedidosRepository } from '../src/features/pedidos/panelPedidosRepository.js'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const client=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
let negocio,usuario,browser
const email='qa-panel-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
try{
 const alta=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(alta.error);usuario=alta.data.user
 assert.ifError((await admin.from('cuentas_acceso').update({rol:'emprendimiento'}).eq('usuario_id',usuario.id)).error)
 const n=await admin.from('emprendimientos').insert({nombre:'Cocina de prueba del panel',slug:'qa-panel-'+randomUUID()}).select().single();assert.ifError(n.error);negocio=n.data
 assert.ifError((await admin.from('miembros_emprendimiento').insert({usuario_id:usuario.id,emprendimiento_id:negocio.id})).error)
 assert.ifError((await admin.from('permisos_miembro').insert({usuario_id:usuario.id,emprendimiento_id:negocio.id,permiso:'pedidos.ver'})).error)
 const producto=await admin.from('productos').insert({emprendimiento_id:negocio.id,nombre:'Menú del día',precio:1200,visible:true}).select().single();assert.ifError(producto.error)
 // Datos históricos para verificar filtros, límites del día y paginación.
 const filas=Array.from({length:27},(_,i)=>({emprendimiento_id:negocio.id,nombre_contacto:'Contacto QA '+i,telefono_contacto:'1123456789',subtotal:1200,fecha_creacion:new Date(2026,8,20,0,0,i).toISOString()}))
 filas[26].fecha_creacion=new Date(2026,8,21,0,0,0).toISOString()
 const seed=await admin.from('pedidos').insert(filas).select();assert.ifError(seed.error)
 assert.ifError((await admin.from('detalles_pedido').insert(seed.data.map(p=>({pedido_id:p.id,producto_id:producto.data.id,nombre_producto:'Menú histórico',precio_unitario:1200,cantidad:1})))).error)
 assert.ifError((await client.auth.signInWithPassword({email,password})).error)
 const repo=crearPanelPedidosRepository(client,negocio.id,usuario.id)
 const primera=await repo.listar(),segunda=await repo.listar({pagina:1})
 assert.equal(primera.total,27);assert.equal(primera.pedidos.length,25);assert.equal(segunda.pedidos.length,2)
 assert.equal(new Set([...primera.pedidos,...segunda.pedidos].map(p=>p.id)).size,27)
 assert.equal((await repo.listar({desde:'2026-09-20',hasta:'2026-09-20',estado:'Pendiente'})).total,26)
 assert.equal((await repo.listar({desde:'2026-09-21',hasta:'2026-09-21'})).total,1)
 await assert.rejects(()=>repo.listar({desde:'2026-09-22',hasta:'2026-09-20'}),/posterior/)
 assert.equal((await repo.detalle(primera.pedidos[0].id)).detalles_pedido.length,1)
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/tienda/'+negocio.slug)
 await page.getByRole('button',{name:'Agregar Menú del día al carrito',exact:true}).click()
 await page.getByRole('button',{name:'Carrito (1)',exact:true}).click()
 await page.getByRole('button',{name:'Continuar con el pedido'}).click()
 await page.getByLabel('Nombre de contacto').fill('Cliente del recorrido completo')
 await page.getByLabel('Teléfono de contacto').fill('1123456789')
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await page.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 const numero=(await page.locator('.order-number').innerText()).split('#')[1]
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 const abrir=page.getByRole('button',{name:'Ver pedidos de '+negocio.nombre,exact:true})
 await abrir.click()
 await page.getByRole('button',{name:'Ver pedido #'+numero,exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Productos',exact:true}).count(),0,'Operador de pedidos no requiere permisos de productos')
 assert.equal(await page.locator('.orders-list .order-row').first().getByRole('button').getAttribute('aria-label'),'Ver pedido #'+numero)
 mkdirSync('test-results',{recursive:true})
 async function capturar(nombre){
  for(const [width,height,formato]of[[1280,900,'escritorio'],[390,844,'movil']]){
   await page.setViewportSize({width,height})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desborde '+nombre)
   await page.screenshot({path:'test-results/'+nombre+'-'+formato+'.png',fullPage:true})
  }
  await page.setViewportSize({width:1280,height:900})
 }
 await page.getByLabel('Desde',{exact:true}).fill('2026-09-20')
 await page.getByLabel('Hasta',{exact:true}).fill('2026-09-20')
 await page.getByRole('button',{name:'Aplicar filtros'}).click()
 await page.getByRole('heading',{name:'26 pedidos encontrados'}).waitFor()
 await page.getByRole('button',{name:'Siguiente',exact:true}).click()
 await page.getByText('Página 2',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Limpiar filtros'}).click()
 await page.getByRole('heading',{name:'28 pedidos encontrados'}).waitFor()
 // Para la captura del listado, limitar al día actual.
 const hoy=new Date(),fecha=[hoy.getFullYear(),String(hoy.getMonth()+1).padStart(2,'0'),String(hoy.getDate()).padStart(2,'0')].join('-')
 await page.getByLabel('Desde',{exact:true}).fill(fecha)
 await page.getByLabel('Hasta',{exact:true}).fill(fecha)
 await page.getByRole('button',{name:'Aplicar filtros'}).click()
 await page.getByRole('heading',{name:'1 pedido encontrado'}).waitFor()
 await capturar('panel-pedidos')
 await page.getByRole('button',{name:'Ver pedido #'+numero,exact:true}).click()
 await page.getByRole('heading',{name:'Pedido #'+numero,exact:true}).waitFor()
 await page.getByText('Cliente del recorrido completo',{exact:true}).waitFor()
 await capturar('detalle-pedido')
 assert.ifError((await admin.from('permisos_miembro').delete().eq('usuario_id',usuario.id).eq('permiso','pedidos.ver')).error)
 await assert.rejects(()=>repo.listar(),/permiso/)
 const directo=await client.from('detalles_pedido').select('*').eq('pedido_id',Number(numero));assert.ifError(directo.error);assert.equal(directo.data.length,0)
 await page.getByRole('button',{name:'Actualizar pedidos',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Ya no tenés permiso'}).waitFor()
 assert.equal(await page.getByText('Cliente del recorrido completo',{exact:true}).count(),0)
 assert.deepEqual(errores,[])
 console.log('PASS API y navegador: orden, paginación, fechas inclusivas, filtros, pedido público visible en panel, operador sin permiso de productos, detalle, revocación y vistas móvil/escritorio.')
} finally{
 await browser?.close()
 if(negocio){
  for(const tabla of ['pedidos','productos','emprendimientos'])assert.ifError((await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',negocio.id)).error)
 }
 if(usuario)assert.ifError((await admin.auth.admin.deleteUser(usuario.id)).error)
}
