import {useState,useRef,useEffect} from 'react'
import ProductoForm from './ProductoForm.jsx'
import ProductoList from './ProductoList.jsx'
import {useCambiosSinGuardar,confirmarSalida} from '../../navigation.js'

function ConfirmacionRetiro({decision,guardando,error,onConfirmar,onCerrar}){
 const dialogo=useRef(null)
 useEffect(()=>{const d=dialogo.current;d.showModal();return()=>d.close()},[])
 const bloqueado=decision.dependencias.length>0&&decision.accion!=='restaurar'
 const verbo={eliminar:'Eliminar definitivamente',archivar:'Archivar producto',restaurar:'Restaurar producto'}[decision.accion]
 return <dialog ref={dialogo} className="product-retire-dialog" aria-labelledby="retiro-titulo" onCancel={e=>{e.preventDefault();if(!guardando)onCerrar()}}>
 <h2 id="retiro-titulo">{bloqueado?'Producto utilizado como componente':verbo}</h2>
 <p><strong>{decision.nombre}</strong></p>
 {bloqueado?<><p>Quitá primero este producto de la composición de:</p><ul>{decision.dependencias.map(p=><li key={p.id}>{p.nombre}</li>)}</ul></>:
 <p>{decision.accion==='eliminar'?'No tiene pedidos ni movimientos de stock asociados. Se eliminará definitivamente y no podrá recuperarse.':decision.accion==='archivar'?'Tiene historial y no se eliminará. Dejará de ofrecerse y pasará a Archivados, conservando pedidos, movimientos y existencias. Podrás restaurarlo.':'Volverá al listado de productos, oculto en la tienda. Podrás editarlo y publicarlo cuando lo necesites.'}</p>}
 {error&&<p role="alert" className="error-feedback">{error}</p>}
 <div className="form-actions"><button autoFocus className="button button-secondary" disabled={guardando} onClick={onCerrar}>Volver</button>{!bloqueado&&<button className="button button-primary" disabled={guardando} onClick={onConfirmar}>{guardando?'Procesando…':verbo}</button>}</div>
 </dialog>
}
export default function ProductosPanel({repository,productosIniciales,negocio,client}){
 const [productos,setProductos]=useState(productosIniciales),[edicion,setEdicion]=useState(null),[abierto,setAbierto]=useState(false),[guardando,setGuardando]=useState(false),[error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[busqueda,setBusqueda]=useState('')
 const [archivados,setArchivados]=useState(false),[decision,setDecision]=useState(null),[errorRetiro,setErrorRetiro]=useState('')
 const ocupado=useRef(false)
 const puede=p=>negocio.permisos.includes(p)
 const puedeRetirar=puede('productos.editar')&&puede('productos.publicar')
 useCambiosSinGuardar(guardando)
 async function guardar(datos){
  if(guardando)return false
  setGuardando(true);setError('')
  try{const p=edicion?await repository.editar(edicion.id,datos):await repository.crear(datos);setProductos(xs=>edicion?xs.map(x=>x.id===p.id?p:x):[...xs,p]);setAbierto(false);setEdicion(null);setMensaje('Producto guardado.')}
  catch(e){setError(e.message);return false}finally{setGuardando(false)}
 }
 async function visibilidad(p){
  if(guardando)return
  setGuardando(true);setError('')
  try{const r=await repository.visibilidad(p.id,!p.visible);setProductos(xs=>xs.map(x=>x.id===r.id?r:x));setMensaje(r.visible?'Producto publicado en la tienda.':'Producto oculto en la tienda.')}catch(e){setError(e.message)}finally{setGuardando(false)}
 }
 async function cambiarListado(valor){
  if(ocupado.current)return
  ocupado.current=true;setGuardando(true);setError('');setMensaje('')
  try{const xs=await repository.listar({archivados:valor});setProductos(xs);setArchivados(valor);setBusqueda('')}
  catch(e){setError(e.message)}finally{ocupado.current=false;setGuardando(false)}
 }
 async function revisarRetiro(p){
  if(ocupado.current)return
  ocupado.current=true;setGuardando(true);setError('');setMensaje('');setErrorRetiro('')
  try{const r=await repository.retirar(p.id);setDecision({...r,id:p.id})}
  catch(e){setError(e.message)}finally{ocupado.current=false;setGuardando(false)}
 }
 async function confirmarRetiro(){
  if(ocupado.current)return
  ocupado.current=true;setGuardando(true);setErrorRetiro('')
  try{const r=await repository.retirar(decision.id,decision.accion);setProductos(xs=>xs.filter(p=>p.id!==decision.id));setDecision(null);setMensaje(r.accion==='eliminar'?'Producto eliminado definitivamente.':r.accion==='archivar'?'Producto archivado. Su historial y existencias se conservan.':'Producto restaurado. Está oculto en la tienda.')}
  catch(e){setErrorRetiro(e.message)}finally{ocupado.current=false;setGuardando(false)}
 }
 function cerrar(){if(!confirmarSalida())return;setAbierto(false);setEdicion(null);setError('')}
 return <main className="app-shell"><header className="app-header"><div><h1>Productos</h1><p>{productos.length} {archivados?'archivados':'productos'}{!archivados&&' · '+productos.filter(p=>p.visible).length+' publicados'}</p></div>{!abierto&&!archivados&&puede('productos.crear')&&<button className="button button-primary" disabled={guardando} onClick={()=>{setEdicion(null);setAbierto(true);setMensaje('')}}>Nuevo producto</button>}</header>
 {error&&<p role="alert" className="error-feedback">{error}</p>}{mensaje&&<p role="status" className="feedback">{mensaje}</p>}
 {abierto?<div><button className="button button-secondary" disabled={guardando} onClick={cerrar}>Volver a productos</button><ProductoForm key={edicion?.id??'nuevo'} producto={edicion} productosExistentes={productos} client={client} guardando={guardando} onGuardar={guardar} onCancelar={cerrar}/></div>:<>
 <div className="product-list-tools"><div className="field-group product-search"><label htmlFor="buscar-producto">Buscar producto</label><input id="buscar-producto" type="search" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Nombre del producto"/></div>
 <div className="field-group"><label htmlFor="estado-productos">Mostrar</label><select id="estado-productos" disabled={guardando} value={archivados?'archivados':'actuales'} onChange={e=>cambiarListado(e.target.value==='archivados')}><option value="actuales">Productos actuales</option><option value="archivados">Archivados</option></select></div></div>
 <ProductoList client={client} productos={productos.filter(p=>p.nombre.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()))} guardando={guardando} archivados={archivados} puedeEditar={puede('productos.editar')} puedePublicar={puede('productos.publicar')} onEditar={p=>{setEdicion(p);setAbierto(true);setMensaje('')}} onCambiarVisibilidad={visibilidad} onRetirar={puedeRetirar?revisarRetiro:undefined} onRestaurar={puedeRetirar?revisarRetiro:undefined}/>
 </>}
 {decision&&<ConfirmacionRetiro decision={decision} guardando={guardando} error={errorRetiro} onConfirmar={confirmarRetiro} onCerrar={()=>setDecision(null)}/>}
 </main>
}
