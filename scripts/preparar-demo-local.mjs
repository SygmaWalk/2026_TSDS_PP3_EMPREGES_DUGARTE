import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createClient} from '@supabase/supabase-js'

const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
// El preparador usa credenciales administrativas exclusivamente contra Docker local.
assert.equal(new URL(status.API_URL).origin,'http://127.0.0.1:54321')
const db=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const path='CUENTAS-DEMO.local'
const names=['ana','bruno','clara','cocina','consulta','admin']
if (!existsSync(path)) {
  const cuentas=names.map(name=>({email:name+'@demo.example.test',password:randomBytes(15).toString('base64url')+'Aa2!'}))
  writeFileSync(path,JSON.stringify(cuentas,null,2),{flag:'wx'})
}
const cuentas=JSON.parse(readFileSync(path,'utf8'))
for (const name of names) {
  const email=name+'@demo.example.test'
  const {password}=cuentas.find(c=>c.email===email)
  const client=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  if ((await client.auth.signInWithPassword({email,password})).error) {
    const r=await db.auth.admin.createUser({email,password,email_confirm:true})
    if(r.error) throw new Error('No se pudo crear '+email+': '+r.error.message)
  }
}
const {data,error}=await db.from('emprendimientos').select('slug').in('slug',['demo-mesa-del-sur','demo-cafe-del-patio'])
if(error)throw error
if(data.length===2){console.log('Las dos tiendas ya existen. Se conserva el avance de la demo.')}
else {
  const sql=readFileSync(new URL('./demo-local.sql',import.meta.url),'utf8')
  execFileSync('docker',['exec','-i','supabase_db_2026_TSDS_PP3_EMPREGES_DUGARTE','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','inherit','inherit']})
}
console.log('Accesos locales en '+path)
