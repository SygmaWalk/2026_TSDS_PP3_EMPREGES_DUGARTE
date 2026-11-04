import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import {crearStockRepository} from '../src/features/stock/stockRepository.js'
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1')
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(status.API_URL,status.SECRET_KEY||status.SERVICE_ROLE_KEY,opts)
const nuevo=()=>createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,opts)
const actor=nuevo(),lector=nuevo(),ajeno=nuevo(),invitado=nuevo(),usuarios=[],negocios=[]
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
 for(const [u,n,permisos]of [[a,negocio,['productos.ver','stock.ver','stock.registrar']],[l,negocio,['productos.ver','stock.ver']],[b,otro,['productos.ver','stock.ver','stock.registrar']]]){
  data(await admin.from('miembros_emprendimiento').insert({usuario_id:u.id,emprendimiento_id:n}))
  data(await admin.from('permisos_miembro').insert(permisos.map(permiso=>({usuario_id:u.id,emprendimiento_id:n,permiso}))))
 }
 const p=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Gaseosa QA',precio:1500,visible:true}).select().single())
 const oculto=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Oculto QA',precio:100,visible:false}).select().single())
 const extranjero=data(await admin.from('productos').insert({emprendimiento_id:otro,nombre:'Gaseosa ajena QA',precio:1500,visible:true}).select().single())
 const repo=crearStockRepository(actor,negocio,a.id)
 const ver=async(id=p.id,c=actor)=>data(await c.from('stock_productos').select('*').eq('emprendimiento_id',negocio).eq('producto_id',id).maybeSingle())
 const mover=(cantidad,saldo,tipo='Entrada',extra={},c=actor)=>c.rpc('registrar_movimiento_stock',{p_negocio:negocio,p_producto:p.id,p_clave:randomUUID(),p_tipo:tipo,p_cantidad:cantidad,p_motivo:'Movimiento QA',p_referencia:'Lote QA',p_saldo_esperado:saldo,...extra})
 ok((await ver()).disponible===0,'producto existente inicia sin stock inventado')
 ok((await ver(oculto.id)).disponible===0,'producto oculto incluido en inventario')
 ok((await repo.listar()).total===2,'consulta incluye todos los productos autorizados')
 ok((await ajeno.from('stock_productos').select('*').eq('emprendimiento_id',negocio)).data.length===0,'vista aísla emprendimientos')
 ok((await invitado.from('stock_productos').select('*')).error?.code==='42501','invitado no consulta inventario')
 const clave=randomUUID()
 const entrada=data(await mover(10.5,0,'Entrada',{p_clave:clave}))
 ok(entrada.disponible===10.5,'entrada incrementa existencias con decimales')
 ok(data(await mover(10.5,0,'Entrada',{p_clave:clave})).reutilizado,'reintento no duplica movimiento')
 ok((await repo.historial(p.id)).total===1,'historial tiene una sola entrada')
 ok((await mover(11,0,'Entrada',{p_clave:clave})).error?.code==='PT409','clave no se reutiliza con otros datos')
 ok((await mover(1,0,'Entrada',{p_producto:extranjero.id})).error?.code==='PT404','rechaza producto de otro negocio')
 for(const valor of [0,-1,1.0001,'NaN','Infinity',1000000000])ok((await mover(valor,10.5)).error?.code==='22023','cantidad inválida '+valor)
 ok((await mover(1,10.5,'Entrada',{p_motivo:' '})).error?.code==='22023','ajuste requiere motivo válido')
 ok((await mover(1,10.5,'Entrada',{},lector)).error?.code==='42501','lector no registra')
 ok(!!(await mover(1,10.5,'Entrada',{},invitado)).error,'invitado no registra')
 data(await mover(2.5,10.5,'Producción'))
 data(await mover(3,13,'Ajuste negativo'))
 data(await mover(1,10,'Ajuste positivo'))
 ok((await ver()).disponible===11,'producción y ajustes conservan suma de movimientos')
 ok((await mover(12,11,'Ajuste negativo')).error?.code==='22023','no permite stock negativo')
 ok((await mover(1,10)).error?.code==='PT409','saldo desactualizado se rechaza')
 const carrera=await Promise.all([mover(7,11,'Ajuste negativo'),mover(7,11,'Ajuste negativo')])
 ok(carrera.filter(r=>!r.error).length===1&&carrera.some(r=>r.error?.code==='PT409'),'ajustes simultáneos protegidos')
 ok((await ver()).disponible===4,'ajuste concurrente no se duplica')
 const inicial=data(await actor.from('movimientos_stock').select('*').eq('id',entrada.id).single())
 ok(inicial.cantidad===10.5&&!!inicial.fecha&&inicial.usuario_id===a.id,'historial conserva cantidad, fecha y responsable')
 for(const operacion of [
  actor.from('movimientos_stock').insert({producto_id:p.id,emprendimiento_id:negocio,clave:randomUUID(),tipo:'Entrada',cantidad:1,motivo:'Intruso'}),
  actor.from('movimientos_stock').update({cantidad:999}).eq('id',entrada.id),
  actor.from('movimientos_stock').delete().eq('id',entrada.id)
 ])ok(!!(await operacion).error,'no permite escritura directa del historial')
 ok((await admin.from('movimientos_stock').insert({producto_id:extranjero.id,emprendimiento_id:negocio,clave:randomUUID(),tipo:'Entrada',cantidad:1,motivo:'Inconsistente'})).error?.code==='23503','clave compuesta protege el vínculo al negocio')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','stock.registrar'))
 ok((await mover(1,4)).error?.code==='42501','revocación de registro inmediata')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'stock.registrar'}))
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','productos.ver'))
 ok(await ver()===null,'sin permiso de productos no muestra saldos falsos')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'productos.ver'}))
 data(await admin.from('cuentas_acceso').update({habilitada:false}).eq('usuario_id',a.id))
 ok(await ver()===null,'cuenta deshabilitada pierde lectura')
 data(await admin.from('cuentas_acceso').update({habilitada:true}).eq('usuario_id',a.id))
 data(await admin.from('miembros_emprendimiento').update({habilitada:false}).eq('usuario_id',a.id))
 ok(await ver()===null,'asociación deshabilitada pierde lectura')
 data(await admin.from('miembros_emprendimiento').update({habilitada:true}).eq('usuario_id',a.id))
 for(let i=0;i<21;i++)data(await mover(1,4+i,'Entrada',{p_motivo:'Reposición '+i}))
 const h1=await repo.historial(p.id),h2=await repo.historial(p.id,1)
 ok(h1.total===26&&h1.movimientos.length===25&&h2.movimientos.length===1,'historial paginado completo')
 ok(new Set([...h1.movimientos,...h2.movimientos].map(m=>m.id)).size===26,'páginas sin movimientos duplicados')
 const nuevos=Array.from({length:26},(_,i)=>({emprendimiento_id:negocio,nombre:'Producto '+String(i).padStart(2,'0'),precio:100,visible:false}))
 data(await admin.from('productos').insert(nuevos))
 ok((await repo.listar(0)).productos.length===25&&(await repo.listar(1)).productos.length===3,'paginación de productos')
 ok((await repo.listar(0,'Producto 25')).total===1,'busca fuera de primera página')
 ok((await repo.listar(0,'%')).total===0,'búsqueda no interpreta comodines')
 browser=await chromium.launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:1360,height:1000}}),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('button',{name:'Ver inventario de Inventario QA',exact:true}).click()
 await page.getByRole('button',{name:'Ver inventario de Gaseosa QA',exact:true}).click()
 await page.getByRole('button',{name:'Registrar movimiento',exact:true}).click()
 await page.getByLabel('Tipo de movimiento').selectOption('Producción')
 await page.getByLabel('Cantidad de unidades').fill('2,125')
 await page.getByLabel('Motivo del movimiento').fill('Producción registrada desde el panel')
 await page.getByLabel('Referencia o lote (opcional)').fill('LOTE-UI-01')
 await page.getByRole('button',{name:'Guardar movimiento',exact:true}).click()
 await page.getByText('Movimiento registrado. Stock disponible: 27,125',{exact:true}).waitFor()
 ok((await ver()).disponible===27.125,'registro real desde navegador')
 await page.getByRole('button',{name:'Actualizar existencias',exact:true}).click()
 await page.getByText('Producción registrada desde el panel',{exact:true}).waitFor()
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of [[1360,1000,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
  await page.screenshot({path:'test-results/stock-movimientos-'+tipo+'.png',fullPage:true})
 }
 await page.getByRole('button',{name:'Volver al inventario',exact:true}).click()
 await page.getByLabel('Buscar producto').fill('Producto 25')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:'Ver inventario de Producto 25',exact:true}).waitFor()
 ok(true,'búsqueda funcional desde navegador')
 ok(errores.length===0,'sin errores JavaScript')
 console.log('PASS '+checks+' comprobaciones de stock')
}finally{
 await browser?.close()
 for(const c of [actor,lector,ajeno,invitado])await c.removeAllChannels()
 for(const id of negocios)for(const tabla of ['movimientos_stock','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
