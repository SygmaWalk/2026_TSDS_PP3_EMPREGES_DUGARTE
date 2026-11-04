import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {mkdirSync,readFileSync} from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'

const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const nuevo=()=>createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const actor=nuevo(),lector=nuevo(),ajeno=nuevo(),invitado=nuevo(),usuarios=[],negocios=[]
const imagenes=[]
let browser,checks=0
function data(r){assert.ifError(r.error);return r.data}
function ok(cond,mensaje){assert.ok(cond,mensaje);checks++;console.log('PASS '+checks+': '+mensaje)}
async function cuenta(client){
 const email='qa-stock-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const u=data(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;usuarios.push(u.id)
 data(await admin.from('cuentas_acceso').update({rol:'emprendimiento'}).eq('usuario_id',u.id))
 data(await client.auth.signInWithPassword({email,password}));return {...u,email,password}
}
try{
 const a=await cuenta(actor),l=await cuenta(lector),b=await cuenta(ajeno)
 for(const nombre of ['Inventario QA','Inventario ajeno QA'])negocios.push(data(await admin.from('emprendimientos').insert({nombre,slug:'qa-stock-'+randomUUID()}).select().single()).id)
 const [negocio,otro]=negocios
 for(const [u,n,permisos]of [[a,negocio,['productos.ver','stock.ver','stock.registrar','tienda.configurar']],[l,negocio,['productos.ver','stock.ver']],[b,otro,['productos.ver','stock.ver','stock.registrar','tienda.configurar']]]){
  data(await admin.from('miembros_emprendimiento').insert({usuario_id:u.id,emprendimiento_id:n}))
  data(await admin.from('permisos_miembro').insert(permisos.map(permiso=>({usuario_id:u.id,emprendimiento_id:n,permiso}))))
 }
 const p=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Gaseosa QA',precio:1500,visible:true}).select().single())
 const oculto=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Oculto QA',precio:100,visible:false}).select().single())
 const extranjero=data(await admin.from('productos').insert({emprendimiento_id:otro,nombre:'Gaseosa ajena QA',precio:1500,visible:true}).select().single())

 const identidad={logo_path:null,portada_path:null,color_principal:'#9f2144',color_fondo:'#faf8f4'}
 const guardar=(version,datos=identidad,c=actor,n=negocio)=>c.rpc('guardar_apariencia',{p_negocio:n,p_version:version,p_identidad:datos})
 const publicar=(version,c=actor)=>c.rpc('publicar_apariencia',{p_negocio:negocio,p_version:version})
 const publico=()=>invitado.rpc('apariencia_publicada',{p_negocio:negocio})
 const bytes=readFileSync('src/assets/hero.png')
 const subir=async(c=actor,n=negocio)=>{const ruta=n+'/'+randomUUID()+'.png';data(await c.storage.from('tiendas').upload(ruta,bytes,{contentType:'image/png',upsert:false}));imagenes.push(ruta);return ruta}
 const logo=await subir()
 ok(data(await publico())===null,'tienda sin publicación usa valores predeterminados')
 ok(!!(await invitado.storage.from('tiendas').download(logo)).error,'imagen de borrador no es pública')
 ok(!(await actor.storage.from('tiendas').download(logo)).error,'editor ve sus imágenes')
 ok(!!(await lector.storage.from('tiendas').download(logo)).error,'lector sin permiso no ve borradores')
 let r=data(await guardar(null,{...identidad,logo_path:logo}))
 ok(!!r.version&&r.publicada===null,'guarda borrador independiente')
 ok(data(await publico())===null,'guardar no publica')
 ok(data(await actor.from('apariencias_tienda').select('*').eq('emprendimiento_id',negocio)).length===1,'recupera borrador persistido')
 ok(data(await lector.from('apariencias_tienda').select('*').eq('emprendimiento_id',negocio)).length===0,'lector no consulta configuración')
 ok(!!(await invitado.from('apariencias_tienda').select('*')).error,'invitado no lee tabla interna')
 for(const c of [lector,ajeno,invitado])ok(!!(await guardar(r.version,identidad,c)).error,'sin permiso no guarda')
 ok(!!(await guardar(r.version,identidad,actor,otro)).error,'no modifica negocio ajeno')
 ok((await guardar(null)).error?.code==='PT409','versión anterior no sobrescribe')
 for(const color of ['#ffffff','#zzzzzz','red'])ok((await guardar(r.version,{...identidad,color_principal:color})).error?.code==='22023','valida color principal '+color)
 ok((await guardar(r.version,{...identidad,color_fondo:'#000000'})).error?.code==='22023','rechaza fondo sin contraste')
 ok((await guardar(r.version,{...identidad,logo_path:otro+'/'+randomUUID()+'.png'})).error?.code==='22023','rechaza imagen de otro negocio')
 ok((await guardar(r.version,{...identidad,logo_path:negocio+'/'+randomUUID()+'.png'})).error?.code==='22023','rechaza imagen inexistente')
 ok(!!(await actor.from('apariencias_tienda').update({publicada:identidad}).eq('emprendimiento_id',negocio)).error,'no publica por escritura directa')
 for(const c of [lector,ajeno,invitado])ok(!!(await publicar(r.version,c)).error,'sin permiso no publica')
 r=data(await publicar(r.version))
 ok(data(await publico()).logo_path===logo,'publica identidad completa')
 ok(!(await invitado.storage.from('tiendas').download(logo)).error,'imagen publicada accesible al cliente')
 const versionPublicada=r.version,segunda=await subir()
 r=data(await guardar(r.version,{...identidad,logo_path:segunda,color_principal:'#204c3b',presentacion:'lista',orden_productos:[999]}))
 ok(r.borrador.presentacion==='cuadricula'&&r.borrador.orden_productos.length===0,'editar identidad preserva distribución')
 ok(data(await publico()).logo_path===logo,'nuevo borrador conserva publicación')
 ok(!!(await invitado.storage.from('tiendas').download(segunda)).error,'imagen nueva sigue privada')
 ok((await publicar(versionPublicada)).error?.code==='PT409','publicación desactualizada se rechaza')
 ok(data(await publico()).color_principal===identidad.color_principal,'error conserva versión pública')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','tienda.configurar'))
 ok((await publicar(r.version)).error?.code==='42501','revocación de permiso inmediata')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'tienda.configurar'}))
 data(await admin.from('emprendimientos').update({activo:false}).eq('id',negocio))
 ok(data(await publico())===null,'tienda inactiva no publica identidad')
 data(await admin.from('emprendimientos').update({activo:true}).eq('id',negocio))
 r=data(await guardar(r.version,{...identidad,logo_path:null,portada_path:null}))
 r=data(await publicar(r.version))
 ok(data(await publico()).logo_path===null,'quitar imagen recupera alternativa')
 ok(!!(await invitado.storage.from('tiendas').download(logo)).error,'imagen retirada deja de tener acceso público')
 browser=await chromium.launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:1360,height:1000}}),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('complementary',{name:'Navegación del emprendimiento'}).getByRole('link',{name:'Tienda',exact:true}).click()
 await page.getByRole('heading',{name:'Identidad de la tienda'}).waitFor()
 await page.getByLabel('Color principal',{exact:true}).fill('#204c3b')
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click()
 await page.getByText('Borrador guardado. La tienda pública conserva su versión anterior.').waitFor()
 ok(data(await publico()).color_principal==='#9f2144','guardar desde interfaz no publica')
 await page.getByRole('button',{name:'Previsualizar',exact:true}).click()
 const frame=page.frameLocator('iframe[title="Vista previa de la tienda"]')
 await frame.getByRole('heading',{name:'Inventario QA',exact:true}).waitFor()
 ok(await frame.locator('.storefront-template').evaluate(e=>getComputedStyle(e).getPropertyValue('--store-accent').trim())==='#204c3b','vista previa aplica borrador')
 await page.getByRole('button',{name:'Celular',exact:true}).click()
 ok(await frame.locator('html').evaluate(e=>e.scrollWidth<=innerWidth),'vista previa celular sin desborde')
 await page.getByRole('button',{name:'Publicar',exact:true}).click()
 await page.getByText('La identidad de tu tienda quedó publicada.').waitFor()
 ok(data(await publico()).color_principal==='#204c3b','publicación desde interfaz')
 await page.getByLabel('Logo',{exact:true}).setInputFiles({name:'logo.png',mimeType:'image/png',buffer:bytes})
 await page.getByRole('button',{name:'Quitar logo',exact:true}).waitFor()
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click()
 await page.getByText('Borrador guardado. La tienda pública conserva su versión anterior.').waitFor()
 const conImagen=data(await actor.from('apariencias_tienda').select('*').eq('emprendimiento_id',negocio).single())
 imagenes.push(conImagen.borrador.logo_path)
 await page.getByRole('button',{name:'Publicar',exact:true}).click()
 await page.getByText('La identidad de tu tienda quedó publicada.').waitFor()
 const publicoPage=await browser.newPage()
 const tienda=data(await admin.from('emprendimientos').select('slug').eq('id',negocio).single())
 await publicoPage.goto('http://127.0.0.1:5173/#/tienda/'+tienda.slug)
 await publicoPage.getByAltText('Logo de Inventario QA').waitFor()
 ok(await publicoPage.locator('.storefront-template').evaluate(e=>getComputedStyle(e).getPropertyValue('--store-accent').trim())==='#204c3b','visitante ve colores publicados')
 ok(await publicoPage.getByAltText('Logo de Inventario QA').evaluate(e=>e.complete&&e.naturalWidth>0),'visitante ve imagen publicada')
 await publicoPage.reload()
 await publicoPage.getByAltText('Logo de Inventario QA').waitFor()
 ok(true,'identidad persiste al recargar')
 await publicoPage.emulateMedia({ colorScheme: 'dark' })
 await publicoPage.locator('html[data-theme=dark]').waitFor()
 const contraste = await publicoPage.locator('.preview-grid > li > span').first().evaluate(precio => {
   const tarjeta = precio.closest('li')
   const canvas = document.createElement('canvas').getContext('2d')
   function luminancia(color) {
     canvas.fillStyle = color
     canvas.fillRect(0, 0, 1, 1)
     const rgb = Array.from(canvas.getImageData(0, 0, 1, 1).data).slice(0, 3)
     const [r, g, b] = rgb.map(n => {
       const c = n / 255
       return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
     })
     return 0.2126 * r + 0.7152 * g + 0.0722 * b
   }
   const tinta = getComputedStyle(precio).color
   const tab = getComputedStyle(document.querySelector('.store-tab-active'))
   const fondo = luminancia(getComputedStyle(tarjeta).backgroundColor)
   const texto = luminancia(tinta)
   return { coherente: tinta === tab.color && tinta === tab.borderBottomColor,
     ratio: (Math.max(texto, fondo) + .05) / (Math.min(texto, fondo) + .05) }
 })
 ok(contraste.coherente && contraste.ratio >= 4.5, 'precio y pestaña comparten un acento legible en modo oscuro')
 await publicoPage.close()
 await page.getByRole('button',{name:'Previsualizar',exact:true}).click()
 await frame.getByRole('heading',{name:'Inventario QA',exact:true}).waitFor()
 const salto = frame.getByRole('button', { name: 'Ir al contenido de la tienda' })
 await salto.focus()
 await page.keyboard.press('Enter')
 ok(await frame.locator('#store-main-content').evaluate(e => e.ownerDocument.activeElement === e), 'el salto de teclado enfoca el contenido dentro de la vista previa')
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of [[1360,1000,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'editor sin desborde '+tipo)
  await page.screenshot({path:'test-results/apariencia-'+tipo+'.png',fullPage:true})
 }
 ok(errores.length===0,'sin errores JavaScript')
 console.log('PASS '+checks+' comprobaciones de apariencia')
}finally{
 await browser?.close()
 if(imagenes.length)data(await admin.storage.from('tiendas').remove(imagenes))
 for(const c of [actor,lector,ajeno,invitado])await c.removeAllChannels()
 for(const id of negocios)for(const tabla of ['movimientos_stock','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
