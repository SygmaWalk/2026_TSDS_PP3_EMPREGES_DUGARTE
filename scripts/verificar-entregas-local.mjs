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
const anon=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const editor=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const extranjero=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const usuarios=[],negocios=[]
let browser,checks=0
function ok(result){assert.ifError(result.error);return result.data}
function check(cond,mensaje){assert.ok(cond,mensaje);checks++}
async function rechazo(promesa,codigo){const r=await promesa;assert.equal(r.error?.code,codigo);checks++}
const email='qa-entregas-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
try{
 const usuario=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;usuarios.push(usuario.id)
 const otro=ok(await admin.auth.admin.createUser({email:'qa-entregas-'+randomUUID()+'@example.test',password,email_confirm:true})).user;usuarios.push(otro.id)
 ok(await admin.from('cuentas_acceso').update({rol:'emprendimiento'}).in('usuario_id',usuarios))
 await editor.auth.signInWithPassword({email,password}).then(ok)
 await extranjero.auth.signInWithPassword({email:otro.email,password}).then(ok)
 const n=ok(await admin.from('emprendimientos').insert({nombre:'Tienda QA de entregas',slug:'qa-entregas-'+randomUUID()}).select().single());negocios.push(n.id)
 const ajeno=ok(await admin.from('emprendimientos').insert({nombre:'Tienda QA ajena',slug:'qa-entregas-'+randomUUID()}).select().single());negocios.push(ajeno.id)
 ok(await admin.from('miembros_emprendimiento').insert([{usuario_id:usuario.id,emprendimiento_id:n.id},{usuario_id:otro.id,emprendimiento_id:ajeno.id}]))
 ok(await admin.from('permisos_miembro').insert([{usuario_id:usuario.id,emprendimiento_id:n.id,permiso:'entregas.configurar'},{usuario_id:usuario.id,emprendimiento_id:n.id,permiso:'pedidos.ver'},{usuario_id:otro.id,emprendimiento_id:ajeno.id,permiso:'entregas.configurar'}]))
 const p=ok(await admin.from('productos').insert({emprendimiento_id:n.id,nombre:'Producto QA con envío',precio:1200,visible:true}).select().single())
 const datos={emprendimiento_id:n.id,direccion_origen:'Origen ficticio QA 123',latitud:0,longitud:0,franjas:[{hasta_m:1000,tarifa_centavos:0},{hasta_m:2000,tarifa_centavos:50000}]}
 const cotizar=(lat,lng)=>anon.rpc('cotizar_entrega',{p_negocio:n.id,p_lat:lat,p_lng:lng})
 const payload=entrega=>({p_clave:randomUUID(),p_negocio:n.id,p_contacto:{nombre:'Cliente QA entregas',telefono:'1123456789',...(entrega?{entrega}:{})},p_items:[{producto_id:p.id,cantidad:2,precio_centavos:120000}]})
 await rechazo(cotizar(0,0),'22023')
 await rechazo(extranjero.from('configuracion_entregas').insert(datos),'42501')
 await rechazo(anon.from('configuracion_entregas').insert(datos),'42501')
 ok(await editor.from('configuracion_entregas').upsert(datos))
 check(ok(await cotizar(0,0)).costo_centavos===0,'Origen y tarifa gratuita')
 // A 6 decimales, puntos a ambos lados del límite radial de 1000 metros.
 check(ok(await cotizar(0,0.008993)).franja==='Franja 1','Dentro del primer límite')
 check(ok(await cotizar(0,0.008994)).franja==='Franja 2','Después del primer límite')
 await rechazo(cotizar(0,0.02),'22023')
 await rechazo(cotizar(null,0),'22023');await rechazo(cotizar(91,0),'22023');await rechazo(cotizar(0,181),'22023')
 for(const franjas of [[],[{hasta_m:1000,tarifa_centavos:-1}],[{hasta_m:1000,tarifa_centavos:0},{hasta_m:1000,tarifa_centavos:5}],[{hasta_m:2000,tarifa_centavos:0},{hasta_m:1000,tarifa_centavos:5}],[{hasta_m:100001,tarifa_centavos:0}]]) await rechazo(editor.from('configuracion_entregas').update({franjas}).eq('emprendimiento_id',n.id),'23514')
 const q=ok(await cotizar(0,0.01))
 const entrega={modalidad:'envio',direccion:'Destino ficticio QA 456',referencia:'Puerta azul',latitud:0,longitud:0.01,costo_centavos:q.costo_centavos,version:q.version}
 await rechazo(anon.rpc('confirmar_pedido',payload({...entrega,costo_centavos:1})),'22023')
 await rechazo(anon.rpc('confirmar_pedido',payload({...entrega,direccion:''})),'22023')
 const solicitud=payload(entrega),recibo=ok(await anon.rpc('confirmar_pedido',solicitud))
 check(recibo.total_centavos===290000 && recibo.costo_envio_centavos===50000,'Total incorpora envío')
 ok(await editor.from('configuracion_entregas').update({franjas:[{hasta_m:2000,tarifa_centavos:90000}]}).eq('emprendimiento_id',n.id))
 await rechazo(anon.rpc('confirmar_pedido',payload(entrega)),'22023')
 const repetido=ok(await anon.rpc('confirmar_pedido',solicitud))
 check(repetido.id===recibo.id&&repetido.total_centavos===290000,'Reintento conserva ID y tarifa anterior')
 const historico=ok(await editor.from('pedidos').select('entrega,costo_envio,total').eq('id',recibo.id).single())
 check(historico.entrega.direccion===entrega.direccion&&historico.costo_envio===500&&historico.total===2900,'Histórico no cambia')
 const retiro=ok(await anon.rpc('confirmar_pedido',payload({modalidad:'retiro',costo_centavos:999999})))
 check(retiro.costo_envio_centavos===0&&retiro.total_centavos===240000,'Retiro ignora tarifa manipulada')
 check(ok(await anon.rpc('confirmar_pedido',payload())).costo_envio_centavos===0,'Compatibilidad con solicitudes antiguas')
 check(ok(await extranjero.from('configuracion_entregas').update({direccion_origen:'Origen alterado'}).eq('emprendimiento_id',n.id).select()).length===0,'Miembro ajeno no modifica')
 ok(await admin.from('permisos_miembro').delete().eq('usuario_id',usuario.id).eq('permiso','entregas.configurar'))
 check(ok(await editor.from('configuracion_entregas').update({direccion_origen:'Origen alterado'}).eq('emprendimiento_id',n.id).select()).length===0,'Revocación inmediata')
 ok(await admin.from('permisos_miembro').insert({usuario_id:usuario.id,emprendimiento_id:n.id,permiso:'entregas.configurar'}))
 console.log('PASS API: '+checks+' verificaciones de cobertura, tarifas, permisos, integridad e historial.')
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage(),errores=[]
 page.on('pageerror',e=>{errores.push(e.message);console.error('Browser error:',e.message)})
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(email);await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('button',{name:'Configurar entregas de '+n.nombre,exact:true}).click()
 await page.getByLabel('Dirección de origen',{exact:true}).fill('Origen ficticio QA en Buenos Aires')
 await page.getByText('Indicar coordenadas manualmente',{exact:true}).click()
 await page.getByLabel('Latitud',{exact:true}).fill('-34.6037');await page.getByLabel('Longitud',{exact:true}).fill('-58.3816')
 await page.getByRole('button',{name:'Ubicar punto'}).click()
 await page.getByLabel('Límite en km de franja 1').fill('2');await page.getByLabel('Tarifa de franja 1').fill('500')
 await page.getByRole('button',{name:'Agregar franja'}).click()
 await page.getByLabel('Límite en km de franja 2').fill('5');await page.getByLabel('Tarifa de franja 2').fill('900')
 await page.getByRole('button',{name:'Guardar entregas'}).click()
 await page.getByText('Configuración de entregas guardada.',{exact:true}).waitFor()
 mkdirSync('test-results',{recursive:true})
 async function esperarMapa(p){await p.waitForFunction(()=>{const tiles=[...document.querySelectorAll('.leaflet-tile')];return tiles.length>0&&tiles.every(t=>t.complete&&t.naturalWidth>0&&getComputedStyle(t).opacity==='1')},{},{timeout:20000})}
 async function capturar(nombre){
  for(const [width,height,formato]of[[1280,900,'escritorio'],[390,844,'movil']]){
   await page.setViewportSize({width,height})
   if(await page.locator('.delivery-map').count())await esperarMapa(page)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desborde '+nombre)
   await page.screenshot({path:'test-results/'+nombre+'-'+formato+'.png',fullPage:true,animations:'disabled'})
  }
  await page.setViewportSize({width:1280,height:900})
 }
 await capturar('configurar-entregas')
 const publico=await browser.newContext(),tienda=await publico.newPage()
 tienda.on('pageerror',e=>errores.push(e.message))
 await tienda.goto('http://127.0.0.1:5173/#/tienda/'+n.slug)
 await tienda.getByRole('button',{name:'Agregar Producto QA con envío al carrito',exact:true}).click()
 await tienda.getByRole('button',{name:'Carrito (1)',exact:true}).click()
 await tienda.getByRole('button',{name:'Continuar con el pedido'}).click()
 await tienda.getByLabel('Nombre de contacto').fill('Cliente QA navegador')
 await tienda.getByLabel('Teléfono de contacto').fill('1123456789')
 await tienda.getByLabel('Modalidad de entrega').selectOption('envio')
 await tienda.getByLabel('Dirección de entrega',{exact:true}).fill('Destino ficticio QA 456')
 const mapa=tienda.getByLabel('Mapa para seleccionar ubicación')
 await mapa.click({position:{x:150,y:120}})
 await tienda.getByRole('button',{name:'Calcular envío'}).click()
 await tienda.getByText(/Dentro de cobertura/).waitFor()
 assert.ok(await tienda.getByRole('button',{name:'Confirmar pedido',exact:true}).isEnabled())
 for(const [width,height,formato]of[[1280,1000,'escritorio'],[390,844,'movil']]){
  await tienda.setViewportSize({width,height});await esperarMapa(tienda);assert.ok(await tienda.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await tienda.screenshot({path:'test-results/checkout-envio-'+formato+'.png',fullPage:true,animations:'disabled'})
 }
 await tienda.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
 await tienda.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 const numero=(await tienda.locator('.order-number').innerText()).split('#')[1]
 await tienda.reload();await tienda.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
 await tienda.getByText('Destino ficticio QA 456',{exact:true}).waitFor()
 const snapshot=ok(await editor.from('pedidos').select('entrega,total').eq('id',Number(numero)).single())
 // Cambiar el origen actual no debe mover el mapa ni la ruta del pedido anterior.
 ok(await editor.from('configuracion_entregas').update({latitud:-34.7,longitud:-58.5,direccion_origen:'Origen posterior QA'}).eq('emprendimiento_id',n.id))
 await page.getByRole('button',{name:'Mis emprendimientos',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedidos de '+n.nombre,exact:true}).click()
 await page.getByRole('button',{name:'Ver pedido #'+numero,exact:true}).click()
 await page.getByText('Destino ficticio QA 456',{exact:true}).waitFor()
 const mapaDetalle=page.getByLabel('Mapa de la entrega registrada')
 await mapaDetalle.waitFor()
 await page.getByText('Destino del cliente',{exact:true}).first().waitFor()
 const enlace=page.getByRole('link',{name:/Ver ruta en Google Maps/})
 const url=new URL(await enlace.getAttribute('href'))
 assert.equal(url.searchParams.get('origin'),snapshot.entrega.origen.latitud+','+snapshot.entrega.origen.longitud)
 assert.equal(url.searchParams.get('destination'),snapshot.entrega.latitud+','+snapshot.entrega.longitud)
 assert.equal(await page.getByText('Indicar coordenadas manualmente',{exact:true}).count(),0)
 const antes=await mapaDetalle.locator('path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')))
 await mapaDetalle.click({position:{x:80,y:80}})
 assert.deepEqual(await mapaDetalle.locator('path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d'))),antes,'El clic no cambia el destino')
 assert.deepEqual(ok(await editor.from('pedidos').select('entrega,total').eq('id',Number(numero)).single()),snapshot)
 await capturar('detalle-envio')
 console.log('PASS detalle: mapa de solo consulta, puntos históricos y enlace a ruta preservados después de cambiar el origen.')
 assert.deepEqual(errores,[])
 console.log('PASS navegador: configuración, mapa, cotización, confirmación, recarga, detalle interno y vistas móvil/escritorio.')
}catch(error){console.error(error);if(browser){for(const c of browser.contexts())for(const p of c.pages())console.log((await p.locator('body').innerText()).slice(-6000))}throw error}finally{
 await browser?.close()
 for(const id of negocios)for(const tabla of ['pedidos','productos','emprendimientos'])ok(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)ok(await admin.auth.admin.deleteUser(id))
}
