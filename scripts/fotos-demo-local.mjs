import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Fotos ilustrativas de Pexels. Ficha y licencia: pexels.com/photo/{id}/ y pexels.com/license/.
const tiendas = [
  { slug: 'demo-mesa-del-sur', portada: 29336193, productos: {
    'Pizza al molde': 825661, 'Empanada de calabaza': 37297542, 'Limonada de la casa': 5472299,
    'Combo para dos': 27647971, 'Especial del domingo': 315755 } },
  { slug: 'demo-cafe-del-patio', portada: 32655925, productos: {
    'Café filtrado': 312418, 'Roll de canela': 5419190, 'Budín de limón': 6375432 } },
]
const status = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js','status','-o','json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(status.API_URL,'http://127.0.0.1:54321')
const db = createClient(status.API_URL,status.SECRET_KEY || status.SERVICE_ROLE_KEY)
async function foto(id, ancho) {
  const url = 'https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?auto=compress&cs=tinysrgb&w='+ancho
  const r = await fetch(url)
  if (!r.ok) throw new Error('Pexels '+id+': '+r.status)
  const bytes = Buffer.from(await r.arrayBuffer())
  assert.equal(bytes.readUInt16BE(), 0xffd8)
  return bytes
}
async function guardar(bucket, negocio, id, ancho) {
  const bytes = await foto(id, ancho)
  const hash = createHash('sha256').update(bytes).digest('hex')
  const nombre = [hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-')
  const path = negocio+'/'+nombre+'.jpg'
  const {error} = await db.storage.from(bucket).upload(path,bytes,{contentType:'image/jpeg'})
  if (error && !/exist|duplicate/i.test(error.message)) throw error
  return path
}
function datos(r) { if(r.error)throw r.error; return r.data }
for(const tienda of tiendas) {
  const {id} = datos(await db.from('emprendimientos').select('id').eq('slug',tienda.slug).single())
  const productos = datos(await db.from('productos').select('id,nombre,imagen_path').eq('emprendimiento_id',id))
  for(const p of productos) {
    if(!tienda.productos[p.nombre] || p.imagen_path)continue
    const imagen_path=await guardar('productos',id,tienda.productos[p.nombre],720)
    datos(await db.from('productos').update({imagen_path}).eq('id',p.id).is('imagen_path',null))
  }
  const actual=datos(await db.from('apariencias_tienda').select('*').eq('emprendimiento_id',id).maybeSingle())
  if(!actual?.publicada?.portada_path) {
    const portada_path=await guardar('tiendas',id,tienda.portada,1280)
    const base={color_fondo:'#faf8f4',color_principal:'#842d40',logo_path:null,presentacion:'cuadricula',orden_productos:[]}
    datos(await db.from('apariencias_tienda').upsert({emprendimiento_id:id,borrador:{...base,...actual?.borrador,portada_path:actual?.borrador?.portada_path || portada_path},publicada:{...base,...actual?.publicada,portada_path},fecha_publicacion:new Date().toISOString()}))
  }
}
mkdirSync('src/assets',{recursive:true})
writeFileSync('src/assets/mesa-cliente.jpg',await foto(825661,900))
console.log('Fotografías preparadas.')
