import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const fixture=JSON.parse(readFileSync('.qa-tienda.local','utf8'))
const editor=fixture.cuentas.find(c=>c.perfil==='editor')
assert.ok(editor?.email === 'emprendedor@example.test' || (editor?.email.startsWith('qa-tienda-editor-') && editor.email.endsWith('@example.test')))
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const client=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const sesion=await client.auth.signInWithPassword({email:editor.email,password:editor.password})
assert.ifError(sesion.error);assert.ok(fixture.usuarios.includes(sesion.data.user.id))
const negocio=await admin.from('emprendimientos').select('id,nombre').eq('slug',fixture.slug).single()
assert.ifError(negocio.error);assert.ok(fixture.negocios.includes(negocio.data.id));assert.equal(negocio.data.nombre,'Tienda de prueba')
assert.ifError((await admin.from('permisos_miembro').upsert({usuario_id:sesion.data.user.id,emprendimiento_id:negocio.data.id,permiso:'pedidos.ver'})).error)
const existentes=await admin.from('pedidos').select('id',{count:'exact',head:true}).eq('emprendimiento_id',negocio.data.id);assert.ifError(existentes.error)
if(!existentes.count){
 const p=await admin.from('productos').select('id,precio').eq('emprendimiento_id',negocio.data.id).eq('visible',true).order('id').limit(1).single();assert.ifError(p.error)
 const pedido=await client.rpc('confirmar_pedido',{p_clave:randomUUID(),p_negocio:negocio.data.id,p_contacto:{nombre:'Cliente de demostración',telefono:'1123456789'},p_items:[{producto_id:p.data.id,cantidad:2,precio_centavos:Math.round(p.data.precio*100)}]})
 assert.ifError(pedido.error)
 console.log('Pedido ficticio preparado: #'+pedido.data.id)
}
console.log('Panel habilitado para el perfil editor de .qa-tienda.local. Se conservaron los pedidos existentes.')
