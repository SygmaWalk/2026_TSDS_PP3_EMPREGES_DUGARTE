import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
const status = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }))
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1')
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY, opts)
const fixture = JSON.parse(readFileSync('.qa-tienda.local', 'utf8'))
const editor = fixture.cuentas.find(c => c.perfil === 'editor')
const uid = randomUUID(), email = 'qa-perfil-' + uid + '@example.test', password = uid + 'Aa1!'
const creados = []
let usuarioId, browser
const ok = r => { assert.ifError(r.error); return r.data }
const errores = []
mkdirSync('test-results', { recursive: true })
try {
  const activo = ok(await admin.from('emprendimientos').insert({ nombre: 'Tienda QA perfil ' + uid, slug: 'qa-perfil-' + uid, activo: true }).select().single()); creados.push(activo.id)
  const inactivo = ok(await admin.from('emprendimientos').insert({ nombre: 'Oculta QA perfil ' + uid, slug: 'qa-oculta-' + uid, activo: false }).select().single()); creados.push(inactivo.id)
  ok(await admin.from('productos').insert({ emprendimiento_id: activo.id, nombre: 'Producto QA perfil', precio: 1200, visible: true }))
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1360, height: 940 } })
  let page = await context.newPage()
  page.on('pageerror', e => errores.push(e.message))
  async function capturar(nombre) {
    for (const [width, height, formato] of [[1360,940,'escritorio'],[390,844,'movil']]) {
      await page.setViewportSize({ width, height })
      await page.screenshot({ path: 'test-results/' + nombre + '-' + formato + '.png', fullPage: true, animations: 'disabled' })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Desborde: ' + nombre + ' ' + formato)
    }
    await page.setViewportSize({ width:1360,height:940 })
  }
  await page.goto('http://127.0.0.1:5173/#/')
  await page.locator('.shop-card').first().waitFor()
  await capturar('portada-tiendas')
  await page.getByLabel('Buscar emprendimientos').fill('Oculta QA perfil ' + uid)
  await page.getByRole('button', { name:'Buscar', exact:true }).click()
  await expect(page.getByRole('heading', { name: 'No encontramos coincidencias' })).toBeVisible()
  await page.getByLabel('Buscar emprendimientos').fill('Tienda QA perfil ' + uid)
  await page.getByRole('button', { name:'Buscar', exact:true }).click()
  await expect(page.locator('.shop-card')).toHaveCount(1)
  await expect(page.locator('.shop-card')).toContainText(activo.nombre)
  console.log('PASS directorio público: búsqueda y exclusión de tiendas inactivas')
  await page.goto('http://127.0.0.1:5173/#/registro')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  const respuesta = page.waitForResponse(r => r.url().includes('/auth/v1/signup') && r.request().method() === 'POST')
  await page.getByRole('button', { name:'Crear cuenta', exact:true }).click()
  const creado = await (await respuesta).json()
  usuarioId = creado.user?.id || creado.id
  assert.ok(usuarioId, 'Registro devolvió un usuario')
  await page.getByRole('heading', { name:'Mi cuenta de cliente' }).waitFor()
  assert.equal(ok(await admin.from('cuentas_acceso').select('rol').eq('usuario_id', usuarioId).single()).rol, 'cliente')
  await page.getByLabel('Nombre y apellido').fill('Cliente de prueba visual')
  await page.getByLabel('Teléfono', { exact:true }).fill('1123456789')
  await page.getByLabel('Dirección habitual').fill('Calle de prueba 123')
  await page.getByRole('button', { name:'Guardar perfil' }).click()
  await expect(page.getByRole('status').filter({ hasText:'se guardó correctamente' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Nombre y apellido')).toHaveValue('Cliente de prueba visual')
  await capturar('perfil-cliente-nuevo')
  const perfil = ok(await admin.auth.admin.getUserById(usuarioId)).user.user_metadata.perfil_cliente
  assert.deepEqual(perfil, { nombre:'Cliente de prueba visual',telefono:'1123456789',direccion:'Calle de prueba 123' })
  console.log('PASS registro, rol Cliente, perfil persistente y recarga')
  const guardado = await context.storageState()
  await context.close()
  const restaurado = await browser.newContext({ storageState: guardado })
  page = await restaurado.newPage()
  page.on('pageerror', e => errores.push(e.message))
  await page.goto('http://127.0.0.1:5173/#/cuenta')
  await expect(page.getByLabel('Nombre y apellido')).toHaveValue('Cliente de prueba visual')
  await page.goto('http://127.0.0.1:5173/#/tienda/' + activo.slug)
  await page.getByRole('button', { name:/Agregar.*Producto QA perfil/ }).click()
  await page.getByRole('button', { name:'Ver carrito', exact:true }).click()
  await page.getByRole('button', { name:'Continuar con el pedido' }).click()
  await expect(page.getByLabel('Nombre de contacto')).toHaveValue('Cliente de prueba visual')
  await expect(page.getByLabel('Teléfono de contacto')).toHaveValue('1123456789')
  await page.getByLabel('Modalidad de entrega').selectOption('envio')
  await expect(page.getByLabel('Dirección de entrega')).toHaveValue('Calle de prueba 123')
  await expect(page.getByRole('button', { name:'Confirmar pedido', exact:true })).toBeDisabled()
  await page.goto('http://127.0.0.1:5173/#/cuenta')
  await page.getByRole('button', { name:'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { name:'Ingresar', exact:true })).toBeVisible()
  await page.goto('http://127.0.0.1:5173/#/cuenta')
  await expect(page.getByRole('heading', { name:'Ingresar', exact:true })).toBeVisible()
  await page.goto('http://127.0.0.1:5173/#/tienda/' + activo.slug)
  await page.getByRole('button', { name:'Ver carrito', exact:true }).click()
  await page.getByRole('button', { name:'Continuar con el pedido' }).click()
  await expect(page.getByLabel('Nombre de contacto')).toHaveValue('')
  console.log('PASS restauración de sesión, autocompletado, revisión de envío y limpieza al salir')
  await page.goto('http://127.0.0.1:5173/#/ingresar')
  await page.getByLabel('Correo electrónico').fill(editor.email)
  await page.getByLabel('Contraseña').fill(editor.password)
  await page.getByRole('button', { name:'Ingresar', exact:true }).click()
  await page.getByRole('heading', { name:'Mis emprendimientos' }).waitFor()
  await capturar('emprendimientos-nuevo')
  await page.locator('.business-card').filter({ has:page.getByRole('heading', { name:'Tienda de prueba',exact:true }) }).getByRole('button', { name:'Abrir panel' }).click()
  await page.getByRole('heading', { name:'Resumen de actividad' }).waitFor()
  await page.locator('.overview-metrics dd').first().waitFor()
  const negocio = ok(await admin.from('emprendimientos').select('id').eq('slug', fixture.slug).single())
  const pedidos = await admin.from('pedidos').select('id',{count:'exact',head:true}).eq('emprendimiento_id',negocio.id)
  assert.ifError(pedidos.error)
  await expect(page.locator('.overview-metrics > div').filter({has:page.getByText('Pedidos recibidos',{exact:true})}).locator('dd')).toHaveText(String(pedidos.count))
  await capturar('panel-negocio-nuevo')
  await page.getByRole('button',{name:'Consultar pedidos'}).click()
  await page.getByRole('heading',{name:'Pedidos',exact:true}).waitFor()
  console.log('PASS panel con datos reales, accesos y escritorio/móvil')
  assert.deepEqual(errores, [])
} finally {
  if (browser) await browser.close()
  if (usuarioId) { ok(await admin.auth.admin.deleteUser(usuarioId)) }
  if (creados.length) {
    ok(await admin.from('productos').delete().in('emprendimiento_id',creados))
    ok(await admin.from('emprendimientos').delete().in('id',creados))
  }
}
