import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
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
assert.ifError((await admin.from('permisos_miembro').upsert({usuario_id:sesion.data.user.id,emprendimiento_id:negocio.data.id,permiso:'pedidos.registrar_pago'})).error)
console.log('Permiso de registro de pagos habilitado para el emprendedor de Tienda de prueba.');
