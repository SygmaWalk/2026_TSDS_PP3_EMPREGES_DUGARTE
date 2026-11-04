import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import {crearProductosRepository} from '../src/features/productos/productosRepository.js'
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
 const email='qa-stock-pedido-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!'
 const u=data(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;usuarios.push(u.id)
 data(await admin.from('cuentas_acceso').update({rol:'emprendimiento'}).eq('usuario_id',u.id))
 data(await client.auth.signInWithPassword({email,password}));return {...u,email,password}
}
try{
 const a=await cuenta(actor),l=await cuenta(lector),b=await cuenta(ajeno)
 for(const nombre of ['Combos QA','Otro QA'])negocios.push(data(await admin.from('emprendimientos').insert({nombre,slug:'qa-combos-'+randomUUID()}).select().single()).id)
 const [negocio,otro]=negocios
 for(const [u,n,permisos]of [[a,negocio,['productos.ver','productos.crear','productos.editar','productos.publicar','stock.ver','stock.registrar','pedidos.ver','pedidos.actualizar_estado','pedidos.registrar_pago']],[l,negocio,['productos.ver','stock.ver','pedidos.ver']],[b,otro,['productos.ver','productos.crear','productos.editar','stock.ver','stock.registrar','pedidos.ver','pedidos.actualizar_estado']]]){
  data(await admin.from('miembros_emprendimiento').insert({usuario_id:u.id,emprendimiento_id:n}))
  data(await admin.from('permisos_miembro').insert(permisos.map(permiso=>({usuario_id:u.id,emprendimiento_id:n,permiso}))))
 }
 const guardar=(id,nombre,precio=100,combo=false,componentes=[],c=actor,n=negocio)=>c.rpc('guardar_producto_compuesto',{p_negocio:n,p_producto:id,p_nombre:nombre,p_descripcion:null,p_precio:precio,p_imagen:null,p_combo:combo,p_componentes:componentes})
 const mini=data(await guardar(null,'Mini QA',10)),salsa=data(await guardar(null,'Salsa QA',20)),coca=data(await guardar(null,'Gaseosa QA',1500))
 const porcion=data(await guardar(null,'Porción QA',1800,true,[{componente_id:mini.id,cantidad:24},{componente_id:salsa.id,cantidad:2}]))
 const combo=data(await guardar(null,'Combo QA',3000,true,[{componente_id:coca.id,cantidad:1},{componente_id:porcion.id,cantidad:1}]))
 const simple=data(await guardar(null,'Producto con salsa QA',500,false,[{componente_id:salsa.id,cantidad:2}]))
 for(const p of [mini,salsa,coca,porcion,combo,simple])data(await actor.from('productos').update({visible:true}).eq('id',p.id))
 const cargar=(p,cantidad,saldo=0)=>actor.rpc('registrar_movimiento_stock',{p_negocio:negocio,p_producto:p.id,p_clave:randomUUID(),p_tipo:'Entrada',p_cantidad:cantidad,p_motivo:'Existencias QA',p_referencia:'',p_saldo_esperado:saldo})
 for(const [p,q]of [[mini,240],[salsa,20],[coca,10],[simple,5]])data(await cargar(p,q))
 const stock=async id=>data(await actor.from('stock_productos').select('*').eq('producto_id',id).single())
 const disponibilidad=async()=>data(await invitado.rpc('catalogo_disponibilidad',{p_negocio:negocio}))
 ok((await disponibilidad()).find(p=>p.producto_id===combo.id).disponible===10,'combo depende de componentes anidados')
 ok((await cargar(combo,1)).error?.code==='22023','combo no recibe stock independiente')
 ok((await guardar(null,'Vacío QA',100,true)).error?.code==='22023','combo vacío se rechaza')
 ok((await guardar(coca.id,'Gaseosa QA',1500,true,[{componente_id:mini.id,cantidad:1}])).error?.code==='22023','no convierte stock físico existente en combo')
 ok((await guardar(mini.id,'Mini cambiado',10,false,[{componente_id:combo.id,cantidad:1}])).error?.code==='22023','rechaza ciclos indirectos')
 ok(data(await actor.from('productos').select('nombre').eq('id',mini.id).single()).nombre==='Mini QA','composición inválida revierte también edición de nombre')
 ok((await guardar(null,'Repetido QA',100,true,[{componente_id:mini.id,cantidad:1},{componente_id:mini.id,cantidad:2}])).error?.code==='23505','componentes duplicados rechazados')
 const ajenoProd=data(await guardar(null,'Ajeno',100,false,[],ajeno,otro))
 ok((await guardar(null,'Ajeno compuesto',100,true,[{componente_id:ajenoProd.id,cantidad:1}])).error?.code==='22023','composición no admite producto de otro negocio')
 ok((await guardar(combo.id,'Combo QA',3000,true,[{componente_id:coca.id,cantidad:1}],lector)).error?.code==='42501','lector no edita composición')
 ok((await actor.from('productos').update({es_combo:true}).eq('id',mini.id)).error?.code==='42501','tipo de producto no se altera por API directa')
 ok(!!(await actor.from('componentes_producto').insert({emprendimiento_id:negocio,producto_id:mini.id,componente_id:salsa.id,cantidad:1})).error,'composición no se escribe directamente')
 const repo=crearProductosRepository(actor,negocio)
 const publicados=await repo.listar()
 ok(publicados.find(p=>p.id===combo.id).componentes.length===2,'repositorio carga composición persistida')
 ok((await repo.visibilidad(combo.id,true)).componentes.length===2,'publicar no pierde componentes en interfaz')
 const payload=(items=[{producto_id:combo.id,cantidad:2,precio_centavos:300000}])=>({p_clave:randomUUID(),p_negocio:negocio,p_contacto:{nombre:'Cliente combos',telefono:'1123456789',metodo_pago:'Efectivo',entrega:{modalidad:'retiro'}},p_items:items})
 const sol=payload(),r=data(await invitado.rpc('confirmar_pedido',sol))
 const leer=async id=>data(await actor.from('pedidos').select('*,consumos_stock_pedido(*)').eq('id',id).single())
 ok(r.total_centavos===600000,'precio del combo sin cargos por componentes')
 ok((await stock(mini.id)).disponible===192&&(await stock(salsa.id)).disponible===16&&(await stock(coca.id)).disponible===8,'descuenta 48 minis, 4 salsas y 2 bebidas')
 const pedido=await leer(r.id)
 ok(pedido.stock_descontado&&pedido.consumos_stock_pedido.length===3,'guarda consumo consolidado e histórico')
 ok(data(await invitado.rpc('confirmar_pedido',sol)).id===r.id&&(await stock(mini.id)).disponible===192,'reintento no vuelve a descontar')
 ok((await invitado.rpc('confirmar_pedido',payload([{producto_id:combo.id,cantidad:9,precio_centavos:300000}]))).error?.code==='22023','insuficiencia impide pedido completo')
 ok((await stock(mini.id)).disponible===192,'fallo no descuenta parcialmente')
 const simpleR=data(await invitado.rpc('confirmar_pedido',payload([{producto_id:simple.id,cantidad:1,precio_centavos:50000}])))
 ok((await stock(simple.id)).disponible===4&&(await stock(salsa.id)).disponible===14,'producto simple descuenta propio stock y obligatorios')
 const cancelar=(id,devoluciones,c=actor,anterior='Pendiente')=>c.rpc('cancelar_pedido_stock',{p_pedido:id,p_negocio:negocio,p_anterior:anterior,p_motivo:'Cancelación QA',p_devoluciones:devoluciones})
 ok((await actor.rpc('cancelar_pedido',{p_pedido:r.id,p_negocio:negocio,p_anterior:'Pendiente',p_motivo:'Sin decisión'})).error?.code==='22023','API anterior exige decidir devolución')
 for(const devoluciones of [[{producto_id:mini.id,cantidad:49}],[{producto_id:simple.id,cantidad:1}],[{producto_id:coca.id,cantidad:1},{producto_id:coca.id,cantidad:1}],[{producto_id:mini.id,cantidad:-1}]])ok((await cancelar(r.id,devoluciones)).error?.code==='22023','devolución inválida no cancela')
 ok((await leer(r.id)).estado==='Pendiente','errores dejan pedido pendiente')
 ok((await cancelar(r.id,[],lector)).error?.code==='42501','lector no cancela')
 ok((await cancelar(r.id,[],ajeno)).error?.code==='42501','otro negocio no cancela')
 data(await cancelar(r.id,[{producto_id:coca.id,cantidad:2},{producto_id:mini.id,cantidad:24},{producto_id:salsa.id,cantidad:0}]))
 ok((await stock(coca.id)).disponible===10&&(await stock(mini.id)).disponible===216&&(await stock(salsa.id)).disponible===14,'devolución selectiva recupera solo lo elegido')
 ok((await leer(r.id)).consumos_stock_pedido.find(p=>p.producto_id===mini.id).cantidad_devuelta===24,'devolución queda registrada')
 ok((await cancelar(r.id,[{producto_id:coca.id,cantidad:2}])).error?.code==='PT409'&&(await stock(coca.id)).disponible===10,'cancelación repetida no repone dos veces')
 data(await guardar(combo.id,'Combo actualizado QA',3000,true,[{componente_id:coca.id,cantidad:1}]))
 ok((await leer(r.id)).consumos_stock_pedido.find(p=>p.producto_id===mini.id).cantidad===48,'editar combo no reescribe consumo histórico')
 // Dos clientes compiten por la última botella: solo un pedido debe confirmarse.
 const bebidaSaldo=(await stock(coca.id)).disponible
 data(await actor.rpc('registrar_movimiento_stock',{p_negocio:negocio,p_producto:coca.id,p_clave:randomUUID(),p_tipo:'Ajuste negativo',p_cantidad:bebidaSaldo-1,p_motivo:'Última unidad QA',p_referencia:'',p_saldo_esperado:bebidaSaldo}))
 const carrera=await Promise.all([invitado.rpc('confirmar_pedido',payload([{producto_id:coca.id,cantidad:1,precio_centavos:150000}])),invitado.rpc('confirmar_pedido',payload([{producto_id:coca.id,cantidad:1,precio_centavos:150000}]))])
 ok(carrera.filter(r=>!r.error).length===1&&carrera.some(r=>r.error?.code==='22023'),'última unidad no se vende dos veces')
 ok((await disponibilidad()).find(p=>p.producto_id===coca.id).disponible===0,'catálogo público refleja agotado')
 // Reponer una botella para el recorrido del navegador.
 data(await cargar(coca,1,0))
 const ganador=carrera.find(r=>!r.error).data
 browser=await chromium.launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:1360,height:1000}}),page=await ctx.newPage(),errores=[]
 page.on('pageerror',e=>errores.push(e.message))
 const tienda=data(await admin.from('emprendimientos').select('slug').eq('id',negocio).single())
 await page.goto('http://127.0.0.1:5173/#/ingresar')
 await page.getByLabel('Correo electrónico').fill(a.email);await page.getByLabel('Contraseña').fill(a.password)
 await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedidos de Combos QA',exact:true}).click()
 await page.getByRole('button',{name:'Ver pedido #'+ganador.id,exact:true}).click()
 await page.getByRole('button',{name:'Cancelar pedido',exact:true}).click()
 await page.getByLabel('Motivo de cancelación').fill('La bebida se puede reutilizar')
 await page.getByRole('button',{name:'Devolver todo',exact:true}).click()
 mkdirSync('test-results',{recursive:true})
 for(const [width,height,tipo]of [[1360,1000,'escritorio'],[390,844,'movil']]){
  await page.setViewportSize({width,height})
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde '+tipo)
  await page.screenshot({path:'test-results/cancelacion-stock-'+tipo+'.png',fullPage:true})
 }
 await page.getByRole('button',{name:'Confirmar cancelación',exact:true}).click()
 await page.getByText('Pedido cancelado',{exact:true}).waitFor()
 ok((await stock(coca.id)).disponible===2,'cancelación devuelve stock desde navegador')
 await page.getByRole('button',{name:'Volver al panel',exact:true}).click()
 await page.getByRole('button',{name:'Gestionar productos',exact:false}).click()
 await page.getByLabel('Nombre',{exact:false}).fill('Combo desde interfaz QA')
 await page.getByLabel('Precio',{exact:false}).fill('4000')
 await page.getByRole('checkbox',{name:/Es un combo/}).check()
 await page.getByRole('button',{name:'Agregar componente',exact:true}).click()
 await page.getByLabel('Componente 1',{exact:true}).selectOption(String(coca.id))
 await page.getByLabel('Cantidad del componente 1',{exact:true}).fill('2')
 await page.getByRole('button',{name:'Crear producto',exact:true}).click()
 await page.getByRole('heading',{name:'Combo desde interfaz QA',exact:true}).waitFor()
 const desdeUI=data(await actor.from('productos').select('id,es_combo,componentes_producto!componentes_padre_fk(*)').eq('nombre','Combo desde interfaz QA').single())
 ok(desdeUI.es_combo&&desdeUI.componentes_producto[0].cantidad===2,'creación y composición atómicas desde interfaz')
 ok(errores.length===0,'sin errores JavaScript')
 console.log('PASS '+checks+' comprobaciones de pedidos y componentes')
}finally{
 await browser?.close()
 for(const c of [actor,lector,ajeno,invitado])await c.removeAllChannels()
 for(const id of negocios)for(const tabla of ['movimientos_stock','consumos_stock_pedido','pedidos','componentes_producto','productos','emprendimientos'])data(await admin.from(tabla).delete().eq(tabla==='emprendimientos'?'id':'emprendimiento_id',id))
 for(const id of usuarios)data(await admin.auth.admin.deleteUser(id))
}
