import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import {createServer} from 'vite'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false}}
const service=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const key=status.PUBLISHABLE_KEY||status.ANON_KEY
const client=createClient(status.API_URL,key,opts)
const anon=createClient(status.API_URL,key,opts)
const read=r=>{assert.ifError(r.error);return r.data}
const editor=JSON.parse(readFileSync('.qa-tienda.local','utf8')).cuentas.find(c=>c.perfil==='editor')
read(await client.auth.signInWithPassword({email:editor.email,password:editor.password}))
const negocio=read(await service.from('emprendimientos').select('id').eq('slug','cocina-demo').single()).id
const args={p_negocio:negocio}
const rows=read(await client.rpc('frecuencia_clientes',args)).clientes
assert.deepEqual(rows.map(c=>[c.nombre,c.pedidos,c.importe,c.frecuente]),[['Ana Demo',3,3000,true],['Bruno Demo',1,5000,false],['Carla Demo',0,0,false]])
assert.equal(read(await client.rpc('frecuencia_clientes',{...args,p_orden:'importe'})).clientes[0].nombre,'Bruno Demo')
assert.ok(read(await client.rpc('frecuencia_clientes',{...args,p_minimo:4})).clientes.every(c=>!c.frecuente))
assert.ok(read(await client.rpc('frecuencia_clientes',{...args,p_desde:'2099-01-01'})).clientes.every(c=>c.pedidos===0&&c.importe===0))
assert.equal(read(await client.rpc('frecuencia_clientes',{...args,p_pagina:1})).clientes.length,0)
assert.equal((await client.rpc('frecuencia_clientes',{...args,p_desde:'2026-11-06',p_hasta:'2026-11-01'})).error.code,'22023')
assert.equal((await client.rpc('frecuencia_clientes',{...args,p_negocio:-1})).error.code,'42501')
assert.equal((await anon.rpc('frecuencia_clientes',args)).error.code,'42501')
let server,browser
try {
  process.env.VITE_SUPABASE_URL=status.API_URL
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY=key
  server=await createServer({server:{host:'127.0.0.1',port:5198,strictPort:true},logLevel:'error'})
  await server.listen()
  browser=await chromium.launch()
  const page=await browser.newPage()
  await page.goto('http://127.0.0.1:5198/#/ingresar')
  await page.getByLabel('Correo electrónico').fill(editor.email)
  await page.getByLabel('Contraseña',{exact:true}).fill(editor.password)
  await page.getByRole('button',{name:'Ingresar',exact:true}).click()
  await page.waitForFunction(()=>!location.hash.includes('/ingresar'))
  await page.goto('http://127.0.0.1:5198/#/panel/'+negocio+'/clientes')
  await page.getByRole('button',{name:'Clientes frecuentes',exact:true}).click()
  await page.getByText('Cliente frecuente',{exact:true}).waitFor()
  await page.getByLabel('Ordenar por').selectOption('importe')
  await page.getByRole('button',{name:'Consultar frecuencia'}).click()
  await page.getByRole('button',{name:'Ver ficha e historial de Bruno Demo'}).waitFor()
  await page.getByRole('button',{name:'Ver ficha e historial de Ana Demo'}).click()
  await page.getByRole('heading',{name:'Ana Demo',exact:true}).waitFor()
  await page.getByText('Cancelado',{exact:true}).first().waitFor()
  console.log('OK: cálculos, cancelación, filtros, paginación, acceso y recorrido de navegador hasta el historial.')
} finally { await browser?.close(); await server?.close() }
