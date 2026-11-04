import { obtenerAcceso } from '../src/features/acceso/accesoRepository.js'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { crearProductosRepository } from '../src/features/productos/productosRepository.js'

// Obtiene claves exclusivamente del entorno local, sin imprimirlas ni enviarlas al frontend.
const status = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Esta prueba solo admite Supabase local')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const conectar = () => createClient(status.API_URL, status.PUBLISHABLE_KEY || status.ANON_KEY, options)
const admin = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY, options)
const fixturePath = '.qa-persistencia.local'
async function limpiar(fixture) {
  if (fixture.negocios.length) {
    const productos = await admin.from('productos').delete().in('emprendimiento_id', fixture.negocios)
    assert.ifError(productos.error)
    const negocios = await admin.from('emprendimientos').delete().in('id', fixture.negocios)
    assert.ifError(negocios.error)
  }
  for (const id of fixture.usuarios) assert.ifError((await admin.auth.admin.deleteUser(id)).error)
}
if (process.argv.includes('--limpiar-ui')) {
  await limpiar(JSON.parse(readFileSync(fixturePath, 'utf8')))
  unlinkSync(fixturePath)
  console.log('Datos temporales de la prueba visual eliminados.')
  process.exit(0)
}
const fixture = { usuarios: [], negocios: [] }
let conservar = false
try {
  const sufijo = randomUUID()
  const password = `${randomUUID()}Aa1!`
  const email = `qa-persistencia-${sufijo}@example.test`
  const user1 = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(user1.error); fixture.usuarios.push(user1.data.user.id)
  const user2 = await admin.auth.admin.createUser({ email: `qa-otro-${sufijo}@example.test`, password, email_confirm: true })
  assert.ifError(user2.error); fixture.usuarios.push(user2.data.user.id)
  const client = conectar()
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error)
  const negocio = await admin.from('emprendimientos').insert({ nombre: 'Prueba de persistencia', slug: `qa-${sufijo}` }).select('id').single()
  assert.ifError(negocio.error)
  const inicio = { data: negocio.data.id }
  fixture.negocios.push(inicio.data)
  assert.ifError((await admin.from('cuentas_acceso').update({ rol: 'emprendimiento', habilitada: true }).eq('usuario_id', user1.data.user.id)).error)
  assert.ifError((await admin.from('miembros_emprendimiento').insert({ emprendimiento_id: inicio.data, usuario_id: user1.data.user.id })).error)
  assert.ifError((await admin.from('permisos_miembro').insert(['productos.ver','productos.crear','productos.editar','productos.publicar'].map(permiso => ({ emprendimiento_id: inicio.data, usuario_id: user1.data.user.id, permiso })))).error)
  const repo = crearProductosRepository(client, inicio.data)
  const datos = { nombre: 'Tequeños QA', precio: 1000, descripcion: null, imagenPath: null }
  const creado = await repo.crear(datos)
  assert.equal(creado.visible, false); assert.equal(typeof creado.id, 'number')
  const editado = await repo.editar(creado.id, { ...datos, precio: 1500.50 })
  assert.equal(editado.precio, 1500.50)
  assert.equal(editado.fechaCreacion, creado.fechaCreacion)
  await assert.rejects(() => repo.crear(datos), /Ya existe/)
  const anon = conectar()
  assert.deepEqual(await crearProductosRepository(anon, inicio.data).listar(), [])
  await repo.visibilidad(creado.id, true)
  assert.equal((await crearProductosRepository(anon, inicio.data).listar())[0].precio, 1500.50)
  const nuevaSesion = conectar()
  assert.ifError((await nuevaSesion.auth.signInWithPassword({ email, password })).error)
  const recargado = await crearProductosRepository(nuevaSesion, inicio.data).listar()
  assert.equal(recargado[0].id, creado.id); assert.equal(recargado[0].visible, true); assert.equal(recargado[0].precio, 1500.50)
  const ajeno = conectar()
  assert.ifError((await ajeno.auth.signInWithPassword({ email: user2.data.user.email, password })).error)
  const repoAjeno = crearProductosRepository(ajeno, inicio.data)
  await assert.rejects(() => repoAjeno.editar(creado.id, { ...datos, precio: 1 }), /permiso/)
  await assert.rejects(() => repoAjeno.crear({ ...datos, nombre: 'Intruso' }), /permiso/)
  await repo.visibilidad(creado.id, false)
  assert.deepEqual(await repoAjeno.listar(), [])
  assert.deepEqual(await crearProductosRepository(anon, inicio.data).listar(), [])
  assert.equal((await crearProductosRepository(nuevaSesion, inicio.data).listar())[0].visible, false)
  const acceso = await obtenerAcceso(client, user1.data.user.id)
  assert.equal(acceso.rol, 'emprendimiento')
  assert.equal(acceso.negocios[0].permisos.length, 4)
  const accesoCliente = await obtenerAcceso(ajeno, user2.data.user.id)
  assert.equal(accesoCliente.rol, 'cliente')
  assert.equal(accesoCliente.negocios.length, 0)
  assert.ifError((await admin.from('permisos_miembro').delete().eq('usuario_id', user1.data.user.id).eq('permiso', 'productos.editar')).error)
  await assert.rejects(() => repo.editar(creado.id, { ...datos, precio: 2 }), /permiso/)
  assert.ifError((await admin.from('permisos_miembro').insert({ emprendimiento_id: inicio.data, usuario_id: user1.data.user.id, permiso: 'productos.editar' })).error)
  assert.ifError((await admin.from('cuentas_acceso').update({ habilitada: false }).eq('usuario_id', user1.data.user.id)).error)
  await assert.rejects(() => repo.crear({ ...datos, nombre: 'No autorizado' }), /permiso/)
  assert.deepEqual(await repo.listar(), [])
  assert.equal((await obtenerAcceso(client, user1.data.user.id)).habilitada, false)
  assert.ifError((await admin.from('cuentas_acceso').update({ habilitada: true }).eq('usuario_id', user1.data.user.id)).error)
  console.log('PASS: persistencia, catálogo público, aislamiento, roles y revocación efectiva con la misma sesión.')
  if (process.argv.includes('--preparar-ui')) {
    const cuentas = [
      { perfil: 'Emprendimiento: gestión completa de productos', email, password },
      { perfil: 'Cliente', email: user2.data.user.email, password },
    ]
    for (const perfil of ['lector', 'administrador', 'deshabilitada']) {
      const correo = `qa-${perfil}-${sufijo}@example.test`
      const cuenta = await admin.auth.admin.createUser({ email: correo, password, email_confirm: true })
      assert.ifError(cuenta.error); fixture.usuarios.push(cuenta.data.user.id)
      assert.ifError((await admin.from('cuentas_acceso').update({
        rol: perfil === 'administrador' ? 'administrador' : 'emprendimiento', habilitada: perfil !== 'deshabilitada',
      }).eq('usuario_id', cuenta.data.user.id)).error)
      if (perfil === 'lector') {
        assert.ifError((await admin.from('miembros_emprendimiento').insert({ emprendimiento_id: inicio.data, usuario_id: cuenta.data.user.id })).error)
        assert.ifError((await admin.from('permisos_miembro').insert({ emprendimiento_id: inicio.data, usuario_id: cuenta.data.user.id, permiso: 'productos.ver' })).error)
      }
      cuentas.push({ perfil, email: correo, password })
    }
    writeFileSync(fixturePath, JSON.stringify({ ...fixture, email, password, cuentas }, null, 2), { flag: 'wx' })
    conservar = true
    console.log('Cuenta temporal lista para revisión visual. Ejecutar --limpiar-ui al terminar.')
  }
} finally {
  if (!conservar) await limpiar(fixture)
}
