import { crearCompradorDePrueba } from './comprador-de-prueba.mjs'
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
 const configurar=(valor,id=p.id,c=actor,n=negocio)=>c.rpc('configurar_umbral_stock',{p_negocio:n,p_producto:id,p_minimo:valor})
 const mover=(cantidad,saldo,tipo='Entrada',id=p.id)=>actor.rpc('registrar_movimiento_stock',{p_negocio:negocio,p_producto:id,p_clave:randomUUID(),p_tipo:tipo,p_cantidad:cantidad,p_motivo:'Existencias QA',p_referencia:'',p_saldo_esperado:saldo})
 ok((await ver()).umbral_stock===null,'no inventa mínimos de productos existentes')
 ok((await ver()).estado_stock==='sin_stock','cero se distingue sin configurar mínimo')
 data(await mover(10,0))
 data(await configurar(5))
 ok((await ver()).estado_stock==='normal','por encima del mínimo no alerta')
 data(await mover(5,10,'Ajuste negativo'))
 ok((await ver()).estado_stock==='bajo'&&(await ver()).bajo_umbral,'igual al mínimo sí alerta')
 data(await mover(1,5,'Ajuste negativo'))
 ok((await ver()).estado_stock==='bajo','por debajo del mínimo alerta')
 data(await mover(4,4,'Ajuste negativo'))
 ok((await ver()).estado_stock==='sin_stock'&&(await ver()).bajo_umbral,'cero se diferencia y permanece bajo el mínimo')
 data(await mover(6,0))
 ok((await ver()).estado_stock==='normal'&&!(await ver()).bajo_umbral,'reposición quita el aviso automáticamente')
 data(await configurar(6.125))
 ok((await ver()).estado_stock==='bajo','mínimo admite decimales')
 for(const valor of [-1,1.0001,'NaN','Infinity',1000000000])ok((await configurar(valor)).error?.code==='22023','rechaza mínimo inválido '+valor)
 ok((await ver()).umbral_stock===6.125,'errores no modifican configuración')
 data(await configurar(null))
 ok((await ver()).umbral_stock===null&&!(await ver()).bajo_umbral,'permite desactivar el mínimo')
 data(await configurar(0))
 ok((await ver()).estado_stock==='normal','mínimo cero no alerta con existencias')
 for(const [c,label] of [[lector,'lector'],[ajeno,'otro emprendimiento'],[invitado,'invitado']])ok(!!(await configurar(4,p.id,c)).error,'impide configurar a '+label)
 ok((await configurar(4,extranjero.id)).error?.code==='PT404','rechaza producto ajeno con negocio propio')
 for(const op of [actor.from('umbrales_stock').update({minimo:999}).eq('producto_id',p.id),actor.from('umbrales_stock').delete().eq('producto_id',p.id),actor.from('umbrales_stock').insert({producto_id:oculto.id,emprendimiento_id:negocio,minimo:2})])ok(!!(await op).error,'escritura directa bloqueada')
 ok(!!(await invitado.from('umbrales_stock').select('*')).error,'mínimos no son públicos')
 ok(data(await ajeno.from('umbrales_stock').select('*').eq('emprendimiento_id',negocio)).length===0,'lectura aísla negocios')
 ok((await ver(p.id,lector)).umbral_stock===0,'lector autorizado consulta mínimo')
 data(await admin.from('permisos_miembro').delete().eq('usuario_id',a.id).eq('permiso','stock.registrar'))
 ok((await configurar(1)).error?.code==='42501','revocación de permiso inmediata')
 data(await admin.from('permisos_miembro').insert({usuario_id:a.id,emprendimiento_id:negocio,permiso:'stock.registrar'}))
 const combo=data(await admin.from('productos').insert({emprendimiento_id:negocio,nombre:'Combo QA',precio:2500,es_combo:true,visible:true}).select().single())
 data(await admin.from('componentes_producto').insert({producto_id:combo.id,componente_id:p.id,emprendimiento_id:negocio,cantidad:2}))
 data(await configurar(3,combo.id))
 ok((await ver(combo.id)).disponible===3&&(await ver(combo.id)).estado_stock==='bajo','combo alerta según unidades armables')
 data(await mover(2,6))
 ok((await ver(combo.id)).disponible===4&&(await ver(combo.id)).estado_stock==='normal','reponer componente quita aviso del combo')
 data(await configurar(7))
 const comprador = await crearCompradorDePrueba(admin)
 usuarios.push(comprador.id)
 const cliente = nuevo()
 data(await cliente.auth.signInWithPassword({email: comprador.email, password: comprador.password}))
 const pedido=data(await cliente.rpc('confirmar_pedido',{p_clave:randomUUID(),p_negocio:negocio,p_contacto:{nombre:'Cliente QA',telefono:'1123456789',metodo_pago:'Efectivo',entrega:{modalidad:'retiro'}},p_items:[{producto_id:p.id,cantidad:1,precio_centavos:150000}]}))
 ok(!!pedido.id&&(await ver()).disponible===7&&(await ver()).estado_stock==='bajo','venta activa aviso en el límite')
 data(await admin.from('permisos_miembro').insert(['pedidos.ver','pedidos.actualizar_estado'].map(permiso=>({usuario_id:a.id,emprendimiento_id:negocio,permiso}))))
 data(await actor.rpc('cancelar_pedido_stock',{p_pedido:pedido.id,p_negocio:negocio,p_anterior:'Pendiente',p_motivo:'Devolución QA',p_devoluciones:[{producto_id:p.id,cantidad:1}]}))
 ok((await ver()).disponible===8&&(await ver()).estado_stock==='normal','devolución quita aviso')
 const muchos=data(await admin.from('productos').insert(Array.from({length:28},(_,i)=>({emprendimiento_id:negocio,nombre:'Producto '+String(i).padStart(2,'0'),precio:100,visible:false}))).select())
 data(await configurar(2,muchos[27].id))
 ok((await repo.listar(0,'','bajo')).productos.some(x=>x.producto_id===muchos[27].id),'filtro consulta más allá de primera página')
 ok((await repo.listar(0,'Producto 27','bajo')).total===1,'búsqueda y filtro combinados')
 ok((await repo.listar(0,'','sin_stock')).total===29,'filtro de agotados incluye productos sin mínimo')
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:1360,height:1000}}),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña',{exact:true}).fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('complementary',{name:'Navegación del emprendimiento'}).getByRole('link',{name:'Inventario',exact:true}).click()
 await page.getByRole('button',{name:'Ver inventario de Gaseosa QA',exact:true}).click()
 await page.getByRole('button',{name:'Configurar mínimo',exact:true}).click()
 await page.getByLabel('Avisar con esta cantidad o menos').fill('8')
 await page.getByRole('button',{name:'Guardar mínimo',exact:true}).click()
 await page.getByText('Stock bajo',{exact:true}).waitFor()
 ok((await ver()).umbral_stock===8,'configura mínimo desde navegador')
 data(await mover(1,8))
 await page.getByText('Stock bajo',{exact:true}).waitFor({state:'hidden',timeout:22000})
 ok(true,'actualización automática quita aviso sin recargar la página')
 await page.getByRole('button',{name:'Configurar mínimo',exact:true}).click()
 await page.getByLabel('Avisar con esta cantidad o menos').fill('10')
 await page.getByRole('button',{name:'Guardar mínimo',exact:true}).click()
 await page.getByText('Stock bajo',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Volver al inventario',exact:true}).click()
 await page.getByLabel('Mostrar inventario').selectOption('bajo')
 await page.getByRole('button',{name:'Ver inventario de Producto 27',exact:true}).waitFor()
 ok(await page.getByRole('button',{name:'Ver inventario de Gaseosa QA',exact:true}).count()===1,'filtro muestra avisos y producto de otra página')
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of [[1360,1000,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
  await page.screenshot({path:'test-results/stock-bajo-'+tipo+'.png',fullPage:true})
 }
 ok(!errores.length,'sin errores JavaScript')
 console.log('PASS '+checks+' comprobaciones de stock bajo')
}finally{
 await browser?.close()
 for(const c of [actor,lector,ajeno,invitado])await c.removeAllChannels()
 for(const id of negocios)for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','componentes_producto','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
