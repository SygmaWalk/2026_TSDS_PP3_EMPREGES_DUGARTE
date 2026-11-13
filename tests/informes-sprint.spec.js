import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

function datos(respuesta) {
  if (respuesta.error) throw respuesta.error
  return respuesta.data
}

test('el emprendimiento consulta importes históricos por zona y cambia el período', async ({ page }) => {
  test.setTimeout(90000)
  const estado = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], {
    encoding: 'utf8', stdio: ['ignore','pipe','pipe'],
  }))
  expect(new URL(estado.API_URL).hostname).toBe('127.0.0.1')
  const db = createClient(estado.API_URL, estado.SECRET_KEY || estado.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const identificador = randomUUID()
  const email = 'informe-' + identificador + '@example.test'
  const password = randomUUID() + 'aB1!'
  let usuario, negocio
  try {
    usuario = datos(await db.auth.admin.createUser({ email, password, email_confirm: true })).user
    datos(await db.from('cuentas_acceso').update({ rol: 'emprendimiento' }).eq('usuario_id', usuario.id))
    negocio = datos(await db.from('emprendimientos').insert({ nombre: 'Tienda del informe', slug: 'informe-' + identificador }).select('id').single())
    const miembro = { usuario_id: usuario.id, emprendimiento_id: negocio.id }
    datos(await db.from('miembros_emprendimiento').insert(miembro))
    datos(await db.from('permisos_miembro').insert({ ...miembro, permiso: 'pedidos.ver' }))
    const zona = { nombre: 'Centro original', sur: -35, norte: -34, oeste: -59, este: -58, tarifa_centavos: 2000 }
    datos(await db.from('configuracion_entregas').insert({ emprendimiento_id: negocio.id, direccion_origen: 'Origen de prueba',
      latitud: -34.5, longitud: -58.5, modalidad: 'zonas', franjas: [], zonas: [{ ...zona, nombre: 'Centro vigente' }] }))
    const producto = datos(await db.from('productos').insert({ emprendimiento_id: negocio.id, nombre: 'Pizza vigente', precio: 100 }).select('id').single())
    const base = { emprendimiento_id: negocio.id, estado: 'Pendiente', costo_envio: 0, nombre_contacto: 'Cliente', telefono_contacto: '1123456789', subtotal: 100, fecha_creacion: '2026-11-10T12:00:00Z' }
    const entrega = { modalidad: 'envio', modalidad_tarifa: 'zonas', franja: zona.nombre, zona }
    const [pagado] = datos(await db.from('pedidos').insert({ ...base, costo_envio: 20, entrega,
      estado_pago: 'Pagado', fecha_pago: base.fecha_creacion, metodo_pago: 'Efectivo', pago_efectivo: 120 }).select('id'))
    datos(await db.from('detalles_pedido').insert({ pedido_id: pagado.id, producto_id: producto.id, nombre_producto: 'Pizza histórica', cantidad: 2, precio_unitario: 50 }))
    datos(await db.from('pedidos').insert([
      { ...base, costo_envio: 20, entrega },
      { ...base, costo_envio: 20, entrega, estado: 'Cancelado', motivo_cancelacion: 'Cancelado en prueba' },
      { ...base, entrega: { modalidad: 'retiro' } }, { ...base, entrega: null },
      { ...base, entrega: { modalidad:'envio', franja:'Franja 1', desde_m:0, hasta_m:500 } },
    ]))
    await page.goto('/#/ingresar')
    await page.getByLabel('Correo electrónico').fill(email)
    await page.getByLabel('Contraseña', { exact:true }).fill(password)
    await page.getByRole('button', { name:'Ingresar', exact:true }).click()
    await expect(page.getByRole('heading', { name:'Resumen del negocio' })).toBeVisible()
    await page.getByRole('button', { name:'Abrir pedidos' }).click()
    await page.getByRole('heading', { name:'Pedidos', exact:true }).waitFor()
    await page.getByText('Ventas y pedidos por período', { exact:true }).click()
    await page.getByLabel('Desde (informe)').fill('2026-11-10')
    await page.getByLabel('Hasta (informe)').fill('2026-11-10')
    await page.getByRole('button', { name:'Consultar período' }).click()
    const tabla = page.getByRole('table', { name:'Ventas por zona' })
    const fila = nombre => tabla.getByRole('row').filter({ has: page.getByRole('rowheader', {name:nombre}) }).getByRole('cell')
    const importes = (valores) => valores.map(n => new RegExp('^\\s*\\$\\s*' + n + '(?:,00)?\\s*$'))
    await expect(fila('Centro original')).toHaveText([/^2$/, ...importes([200,40,240])])
    await expect(fila('Centro vigente')).toHaveText([/^0$/, ...importes([0,0,0])])
    for (const nombre of ['Retiro en el local','Sin zona registrada',/Franja 1/]) {
      await expect(fila(nombre)).toHaveText([/^1$/, ...importes([100,0,100])])
    }
    await expect(page.getByText('6 pedidos recibidos')).toBeVisible()
    await expect(page.getByRole('list', { name:'Productos por unidades vendidas' })).toContainText('Pizza histórica')
    await expect(page.getByText('2 unidades', {exact:true})).toBeVisible()
    await page.setViewportSize({width:390,height:844})
    await expect(tabla).toBeVisible()
    await page.getByLabel('Desde (informe)').fill('2026-11-01')
    await page.getByLabel('Hasta (informe)').fill('2026-11-01')
    await page.getByRole('button', { name:'Consultar período' }).click()
    await expect(tabla.getByRole('row')).toHaveCount(2)
    await expect(fila('Centro vigente')).toHaveText([/^0$/, ...importes([0,0,0])])
    await expect(page.getByText('Sin pedidos en este período.')).toBeVisible()
  } finally {
    if (negocio) {
      for (const tabla of ['pedidos','productos','emprendimientos']) {
        datos(await db.from(tabla).delete().eq(tabla === 'emprendimientos' ? 'id' : 'emprendimiento_id', negocio.id))
      }
    }
    if (usuario) datos(await db.auth.admin.deleteUser(usuario.id))
  }
})
