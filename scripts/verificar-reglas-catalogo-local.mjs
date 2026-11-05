import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { crearCompradorDePrueba, ingresarDesdeCarrito } from './comprador-de-prueba.mjs'

const status = JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const key = status.PUBLISHABLE_KEY || status.ANON_KEY
const opts = { auth:{persistSession:false,autoRefreshToken:false} }
const service = createClient(status.API_URL,status.SECRET_KEY || status.SERVICE_ROLE_KEY,opts)
const publicClient = () => createClient(status.API_URL,key,opts)
const slug = 'qa-catalogo-' + randomUUID()
const users = []
const read = res => { assert.ifError(res.error); return res.data }
let server, browser, id
try {
  process.env.VITE_SUPABASE_URL=status.API_URL
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY=key
  server=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true},logLevel:'error'})
  await server.listen()
  const url='http://127.0.0.1:5196/'
  const admin=await crearCompradorDePrueba(service); users.push(admin)
  const cliente=await crearCompradorDePrueba(service); users.push(cliente)
  read(await service.from('cuentas_acceso').update({rol:'administrador'}).eq('usuario_id',admin.id))
  const buyer=publicClient(), manager=publicClient()
  read(await buyer.auth.signInWithPassword({email:cliente.email,password:cliente.password}))
  read(await manager.auth.signInWithPassword({email:admin.email,password:admin.password}))
  assert.equal((await buyer.from('emprendimientos').insert({nombre:'Intento QA',slug})).error?.code,'42501')
  browser=await chromium.launch()
  const page=await browser.newPage()
  await page.goto(url+'#/ingresar')
  await page.getByLabel('Correo electrónico').fill(admin.email)
  await page.getByLabel('Contraseña',{exact:true}).fill(admin.password)
  await page.getByRole('button',{name:'Ingresar',exact:true}).click()
  await page.locator('a[href="#/admin/emprendimientos"]').first().click()
  await page.getByRole('button',{name:'Crear emprendimiento'}).click()
  await page.getByLabel('Nombre del emprendimiento').fill(slug)
  await page.getByLabel('Dirección de la tienda').fill(slug)
  await page.getByRole('button',{name:'Guardar emprendimiento'}).click()
  await page.getByRole('button',{name:'Editar '+slug,exact:true}).click()
  id=read(await service.from('emprendimientos').select('id').eq('slug',slug).single()).id
  const nombre='Cocina '+slug
  await page.getByLabel('Nombre del emprendimiento').fill(nombre)
  await page.getByRole('button',{name:'Guardar emprendimiento'}).click()
  await page.getByRole('button',{name:'Abrir panel de '+nombre,exact:true}).waitFor()
  const p=read(await service.from('productos').insert({nombre:'Pizza QA',precio:1000,visible:true,emprendimiento_id:id}).select().single())
  read(await service.from('movimientos_stock').insert({emprendimiento_id:id,producto_id:p.id,clave:randomUUID(),tipo:'Entrada',cantidad:10,motivo:'QA catálogo'}))
  await page.goto(url+'#/panel/'+id+'/productos')
  await page.getByRole('button',{name:'Configurar adicionales y promociones'}).click()
  for (const promo of [false,true]) {
    await page.getByRole('button',{name:promo?'Nueva promoción':'Nuevo adicional'}).click()
    await page.getByLabel('Nombre de la regla').fill(promo?'Descuento QA':'Queso QA')
    await page.getByLabel(promo?'Descuento (%)':'Precio adicional ($)',{exact:true}).fill(promo?'10':'125')
    await page.getByLabel('Pizza QA',{exact:true}).check()
    if(promo){
      await page.getByLabel('Inicio',{exact:true}).fill('2020-01-01T10:00')
      await page.getByLabel('Fin',{exact:true}).fill('2099-01-01T10:00')
    }
    await page.getByRole('button',{name:'Guardar regla'}).click()
    await page.getByRole('button',{name:'Editar '+(promo?'Descuento QA':'Queso QA')}).waitFor()
  }
  const reglas=read(await manager.rpc('reglas_negocio',{p_negocio:id}))
  const extra=reglas.find(r=>r.tipo==='adicional'), promo=reglas.find(r=>r.tipo==='promocion')
  const params=r=>({p_negocio:id,p_id:r.id,p_tipo:r.tipo,p_valor:r.valor,p_activo:r.activo,p_nombre:r.nombre,p_productos:r.productos,p_inicio:r.inicio,p_fin:r.fin})
  assert.equal((await buyer.rpc('guardar_regla_catalogo',params(extra))).error.code,'42501')
  const interno=await crearCompradorDePrueba(service); users.push(interno)
  const operador=publicClient()
  read(await service.from('cuentas_acceso').update({rol:'emprendimiento'}).eq('usuario_id',interno.id))
  read(await service.from('miembros_emprendimiento').insert({usuario_id:interno.id,emprendimiento_id:id,habilitada:true}))
  read(await service.from('permisos_miembro').insert(['productos.ver','productos.editar'].map(permiso=>({usuario_id:interno.id,emprendimiento_id:id,permiso}))))
  read(await operador.auth.signInWithPassword({email:interno.email,password:interno.password}))
  const segundo=read(await service.from('productos').insert({nombre:'Porción QA',precio:500,visible:true,emprendimiento_id:id}).select().single())
  read(await operador.rpc('guardar_regla_catalogo',{...params(extra),p_productos:[p.id,segundo.id]}))
  assert.ok(read(await publicClient().rpc('opciones_catalogo',{p_negocio:id})).every(o=>o.adicionales.length === 1))
  read(await operador.rpc('guardar_regla_catalogo',params(extra)))
  assert.equal(read(await publicClient().rpc('opciones_catalogo',{p_negocio:id})).find(o=>o.producto_id===segundo.id).adicionales.length,0)
  assert.equal((await operador.rpc('guardar_regla_catalogo',{...params(extra),p_negocio:0})).error.code,'42501')
  assert.equal((await operador.rpc('guardar_regla_catalogo',{...params(extra),p_productos:[-1]})).error.code,'22023')
  assert.equal((await operador.rpc('guardar_regla_catalogo',{...params(promo),p_fin:promo.inicio})).error.code,'23514')
  const tienda=await browser.newPage()
  await tienda.goto(url+'#/tienda/'+slug)
  await tienda.getByText('Descuento QA · 10% de descuento').waitFor()
  await tienda.getByRole('button',{name:'Agregar Pizza QA al carrito'}).click()
  await tienda.getByRole('button',{name:'Carrito (1)'}).click()
  await tienda.getByLabel(/Queso QA/).check()
  assert.match(await tienda.getByTestId('subtotal').innerText(),/1.025,00/)
  await tienda.getByLabel(/Queso QA/).uncheck()
  assert.match(await tienda.getByTestId('subtotal').innerText(),/900,00/)
  await tienda.getByLabel(/Queso QA/).check()
  await tienda.getByRole('button',{name:'Continuar con el pedido'}).click()
  await ingresarDesdeCarrito(tienda,cliente,slug)
  await tienda.getByLabel('Nombre de contacto').fill('Cliente QA')
  await tienda.getByLabel('Teléfono de contacto').fill('1112345678')
  await tienda.getByLabel('¿Cómo pensás pagar?').selectOption('Efectivo')
  await tienda.getByRole('button',{name:'Confirmar pedido',exact:true}).click()
  await tienda.getByRole('heading',{name:'Tu pedido quedó registrado'}).waitFor()
  const intento={p_negocio:id,p_clave:randomUUID(),p_contacto:{nombre:'Cliente QA',telefono:'1112345678',metodo_pago:'Efectivo'},p_items:[{producto_id:p.id,cantidad:1,precio_centavos:102500,adicionales:[extra.id]}]}
  read(await manager.rpc('guardar_regla_catalogo',{...params(extra),p_activo:false}))
  assert.equal((await buyer.rpc('confirmar_pedido',intento)).error?.code,'22023')
  read(await manager.rpc('guardar_regla_catalogo',{...params(promo),p_inicio:'2020-01-01',p_fin:'2020-01-02'}))
  const op=read(await publicClient().rpc('opciones_catalogo',{p_negocio:id})).find(op=>op.producto_id===p.id)
  assert.equal(op.precio_centavos,100000); assert.deepEqual(op.adicionales,[]); assert.equal(op.promocion,null)
  assert.equal((await buyer.rpc('confirmar_pedido',{...intento,p_items:[{producto_id:p.id,cantidad:1,precio_centavos:90000}]})).error?.code,'22023')
  const historial=read(await service.from('pedidos').select('subtotal,detalles_pedido(precio_unitario,adicionales,promocion)').eq('emprendimiento_id',id).single())
  assert.equal(historial.subtotal,1025)
  assert.equal(historial.detalles_pedido[0].adicionales[0].centavos,12500)
  assert.equal(historial.detalles_pedido[0].adicionales[0].nombre,'Queso QA')
  assert.equal(historial.detalles_pedido[0].promocion.nombre,'Descuento QA')
  console.log('PASS administración, permisos, configuración, descuento vigente, carrito, retorno con cuenta, compra, expiración, rechazo e historial.')
} finally {
  await browser?.close()
  await server?.close()
  if (!id) id=read(await service.from('emprendimientos').select('id').eq('slug',slug).maybeSingle())?.id
  if (id) for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','productos','emprendimientos']){
    read(await service.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
  }
  for(const user of users) read(await service.auth.admin.deleteUser(user.id))
}
