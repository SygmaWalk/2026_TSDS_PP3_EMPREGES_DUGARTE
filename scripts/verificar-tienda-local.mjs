import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { crearProductosRepository } from '../src/features/productos/productosRepository.js'
import { cargarTienda } from '../src/features/catalogo/catalogoRepository.js'
import { subirImagen } from '../src/features/productos/imagenes.js'

const status = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js','status','-o','json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }))
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Solo admite Supabase local')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const conectar = () => createClient(status.API_URL, status.PUBLISHABLE_KEY || status.ANON_KEY, options)
const admin = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY, options)
const archivo = new File([readFileSync('src/assets/hero.png')], 'imagen-prueba.png', { type: 'image/png' })
const fixturePath = '.qa-tienda.local'
async function limpiar(fixture) {
  for (const id of fixture.negocios) {
    assert.ifError((await admin.from('productos').delete().eq('emprendimiento_id', id)).error)
    const { data, error } = await admin.storage.from('productos').list(String(id), { limit: 1000 })
    assert.ifError(error)
    if (data.length) assert.ifError((await admin.storage.from('productos').remove(data.map(o => id + '/' + o.name))).error)
    assert.ifError((await admin.from('emprendimientos').delete().eq('id', id)).error)
  }
  for (const id of fixture.usuarios) assert.ifError((await admin.auth.admin.deleteUser(id)).error)
}
if (process.argv.includes('--limpiar-ui')) {
  await limpiar(JSON.parse(readFileSync(fixturePath, 'utf8'))); unlinkSync(fixturePath)
  console.log('Datos de tienda de prueba eliminados.'); process.exit(0)
}
if (process.argv.includes('--preparar-ui') && existsSync(fixturePath)) throw new Error('Ya existe una tienda de prueba preparada; se conserva.')
const fixture = { usuarios: [], negocios: [] }
let conservar = false
try {
  const sufijo = randomUUID()
  const password = randomUUID() + 'Aa1!'
  const cuentas = []
  for (const perfil of ['editor','lector','ajeno']) {
    const email = 'qa-tienda-' + perfil + '-' + sufijo + '@example.test'
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    assert.ifError(error); fixture.usuarios.push(data.user.id)
    assert.ifError((await admin.from('cuentas_acceso').update({ rol: 'emprendimiento' }).eq('usuario_id', data.user.id)).error)
    const client = conectar(); assert.ifError((await client.auth.signInWithPassword({ email, password })).error)
    cuentas.push({ id: data.user.id, email, perfil, client })
  }
  for (const [index,nombre] of ['Tienda de prueba','Otro emprendimiento de prueba'].entries()) {
    const { data, error } = await admin.from('emprendimientos').insert({ nombre, slug: 'tienda-' + index + '-' + sufijo }).select().single()
    assert.ifError(error); fixture.negocios.push(data.id)
  }
  for (const [i,cuenta] of cuentas.entries()) {
    const id = fixture.negocios[i === 2 ? 1 : 0]
    assert.ifError((await admin.from('miembros_emprendimiento').insert({ usuario_id: cuenta.id, emprendimiento_id: id })).error)
    const permisos = i === 1 ? ['productos.ver'] : ['productos.ver','productos.crear','productos.editar','productos.publicar']
    assert.ifError((await admin.from('permisos_miembro').insert(permisos.map(permiso => ({ usuario_id: cuenta.id, emprendimiento_id: id, permiso })))).error)
  }
  const id = fixture.negocios[0]
  const client = cuentas[0].client
  const lector = cuentas[1].client
  const ajeno = cuentas[2].client
  const anon = conectar()
  const repo = crearProductosRepository(client, id)
  const datos = { nombre: 'Producto con imagen', precio: 1500.50, descripcion: 'Producto ficticio para probar la tienda y su carrito.', imagenPath: null, archivoImagen: archivo }
  let producto = await repo.crear(datos)
  const primerPath = producto.imagenPath
  assert.ok(primerPath.startsWith(id + '/'))
  assert.ifError((await client.storage.from('productos').download(primerPath)).error)
  assert.ok((await anon.storage.from('productos').download(primerPath)).error, 'Una imagen oculta no es pública')
  await assert.rejects(() => subirImagen(lector, id, archivo), /permisos/)
  await assert.rejects(() => subirImagen(ajeno, id, archivo), /permisos/)
  await assert.rejects(() => subirImagen(anon, id, archivo), /permisos/)
  assert.ok((await client.storage.from('productos').upload(id + '/' + randomUUID() + '.png', new Blob(['x'], { type:'image/svg+xml' }), { contentType: 'image/svg+xml' })).error, 'El servidor rechaza formatos no permitidos')
  const grande = new File([new Uint8Array(5242881)], 'grande.png', { type:'image/png' })
  await assert.rejects(() => subirImagen(client, id, grande), /5 MB/)
  assert.ok((await client.storage.from('productos').upload(id + '/' + randomUUID() + '.png', grande, { contentType:'image/png' })).error, 'El servidor también valida el tamaño')
  await repo.visibilidad(producto.id, true)
  assert.ifError((await anon.storage.from('productos').download(primerPath)).error)
  await client.storage.from('productos').remove([primerPath])
  assert.ifError((await anon.storage.from('productos').download(primerPath)).error, 'No elimina una imagen todavía referenciada')
  producto = await repo.editar(producto.id, datos)
  assert.notEqual(producto.imagenPath, primerPath)
  assert.ok((await client.storage.from('productos').download(primerPath)).error, 'El reemplazo limpia el archivo anterior')
  assert.ifError((await anon.storage.from('productos').download(producto.imagenPath)).error)
  const objetosAntes = (await client.storage.from('productos').list(String(id))).data.length
  await assert.rejects(() => repo.crear(datos), /Ya existe/)
  assert.equal((await client.storage.from('productos').list(String(id))).data.length, objetosAntes, 'Un alta fallida limpia la subida nueva')
  const pathReemplazo = producto.imagenPath
  producto = await repo.editar(producto.id, { ...datos, archivoImagen: null, imagenPath: null })
  assert.equal(producto.imagenPath, null)
  assert.ok((await client.storage.from('productos').download(pathReemplazo)).error, 'Quitar imagen elimina el archivo sin uso')
  producto = await repo.editar(producto.id, datos)
  const otroRepo = crearProductosRepository(ajeno, fixture.negocios[1])
  const otro = await otroRepo.crear(datos)
  await otroRepo.visibilidad(otro.id, true)
  await assert.rejects(() => repo.editar(producto.id, { ...datos, archivoImagen: null, imagenPath: otro.imagenPath }), /imagen/)
  await repo.crear({ nombre:'Producto oculto de prueba', precio:2000, descripcion:null, imagenPath:null })
  await repo.crear({ nombre:'Producto sin imagen', precio:800, descripcion:'También se puede publicar sin fotografía.', imagenPath:null }).then(p => repo.visibilidad(p.id,true))
  const slug = 'tienda-0-' + sufijo
  let tienda = await cargarTienda(anon, slug)
  assert.equal(tienda.productos.length, 2)
  assert.ok(tienda.productos.every(p => p.visible && p.emprendimientoId === id))
  assert.equal(await cargarTienda(anon, 'tienda-inexistente-' + sufijo), null)
  await repo.visibilidad(producto.id, false)
  assert.ok((await anon.storage.from('productos').download(producto.imagenPath)).error, 'Ocultar retira acceso a nuevas descargas')
  await repo.visibilidad(producto.id, true)
  assert.ifError((await admin.from('emprendimientos').update({ activo:false }).eq('id',id)).error)
  assert.equal(await cargarTienda(anon,slug),null)
  assert.ok((await anon.storage.from('productos').download(producto.imagenPath)).error)
  assert.ifError((await admin.from('emprendimientos').update({ activo:true }).eq('id',id)).error)
  console.log('PASS: imágenes reales, aislamiento, límites, reemplazo, limpieza, catálogo público, ocultos y tienda inactiva.')
  if (process.argv.includes('--preparar-ui')) {
    writeFileSync(fixturePath, JSON.stringify({ ...fixture, slug, url:'http://127.0.0.1:5173/#/tienda/' + slug, productoId:producto.id, cuentas:cuentas.map(({perfil,email}) => ({perfil,email,password})) },null,2), {flag:'wx'})
    conservar = true
    console.log('Tienda local de prueba preparada. Credenciales y enlace en .qa-tienda.local.')
  }
} finally { if (!conservar) await limpiar(fixture) }
