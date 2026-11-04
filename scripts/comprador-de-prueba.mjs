import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export async function crearCompradorDePrueba(admin) {
  const email = 'qa-compra-' + randomUUID() + '@example.test'
  const password = randomUUID() + 'Aa1!'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(error)
  return { id: data.user.id, email, password }
}

export async function ingresarDesdeCarrito(page, comprador, slug) {
  await page.getByRole('heading', { name: 'Ingresá para confirmar tu pedido' }).waitFor()
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByLabel('Correo electrónico').fill(comprador.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(comprador.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL('**/#/tienda/' + slug)
  await page.getByRole('button', { name: 'Carrito (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar con el pedido', exact: true }).click()
}
