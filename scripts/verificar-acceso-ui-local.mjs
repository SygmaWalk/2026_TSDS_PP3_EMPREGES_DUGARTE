import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const fixture = JSON.parse(readFileSync('.qa-persistencia.local', 'utf8'))
assert.ok(fixture.cuentas?.length === 5, 'Preparar primero las cuentas locales con --preparar-ui')
const browser = await chromium.launch({ headless: true })
mkdirSync('test-results', { recursive: true })
try {
  for (const cuenta of fixture.cuentas) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errores = []
    page.on('pageerror', error => errores.push(error.message))
    async function capturar(nombre) {
      for (const [ancho, alto, formato] of [[1280, 900, 'escritorio'], [390, 844, 'movil']]) {
        await page.setViewportSize({ width: ancho, height: alto })
        await page.screenshot({ path: 'test-results/' + nombre + '-' + formato + '.png', fullPage: true })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Desborde horizontal en ' + nombre + ' ' + formato)
      }
      await page.setViewportSize({ width: 1280, height: 900 })
    }
    const perfilArchivo = cuenta.perfil.startsWith('Emprendimiento:') ? 'gestion' : cuenta.perfil.toLowerCase()
    await page.goto('http://localhost:5173/#/ingresar')
    await page.getByRole('heading', { name: 'Ingresar', exact: true }).waitFor()
    if (perfilArchivo === 'gestion') await capturar('ingreso')
    await page.getByLabel('Correo electrónico').fill(cuenta.email)
    await page.getByLabel('Contraseña').fill(cuenta.password)
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    if (cuenta.perfil === 'Cliente') {
      await page.getByRole('heading', { name: 'Mi cuenta de cliente' }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Crear emprendimiento' }).count(), 0)
      await capturar('panel-cliente')
    } else if (cuenta.perfil === 'deshabilitada') {
      await page.getByRole('alert').filter({ hasText: 'no está habilitada' }).waitFor()
      await capturar('cuenta-deshabilitada')
    } else {
      await page.getByRole('heading', { name: cuenta.perfil === 'administrador' ? 'Administración del sistema' : 'Mis emprendimientos' }).waitFor()
      await capturar('panel-' + perfilArchivo)
      await page.getByRole('button', { name: 'Abrir productos de Prueba de persistencia', exact: true }).click()
      await page.getByRole('heading', { name: 'Productos', exact: true }).waitFor()
      await page.getByRole('heading', { name: 'Tequeños QA', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Crear producto', exact: true }).count(), cuenta.perfil === 'lector' ? 0 : 1)
      assert.equal(await page.getByRole('button', { name: 'Editar Tequeños QA', exact: true }).count(), cuenta.perfil === 'lector' ? 0 : 1)
      await capturar('productos-' + perfilArchivo)
      if (cuenta.perfil === 'lector') await page.screenshot({ path: 'test-results/acceso-lector.png', fullPage: true })
      await page.reload()
      await page.getByRole('heading', { name: cuenta.perfil === 'administrador' ? 'Administración del sistema' : 'Mis emprendimientos' }).waitFor()
    }
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await page.getByRole('heading', { name: 'Ingresar', exact: true }).waitFor()
    assert.deepEqual(errores, [])
    console.log('PASS interfaz: ' + cuenta.perfil)
    await context.close()
  }
} finally { await browser.close() }
