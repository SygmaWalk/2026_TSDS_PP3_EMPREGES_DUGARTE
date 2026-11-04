import {useRuta,leerRuta,navegar,rutaNegocio,useCambiosSinGuardar} from '../../navigation.js'
import HistorialCliente from './HistorialCliente.jsx'
import { useEffect,useMemo,useRef,useState } from 'react'
import { Marca } from '../acceso/InterfazAcceso.jsx'
import { crearClientesRepository, filtroBusqueda } from './clientesRepository.js'
function Ficha({id,repository,puedeEditar,puedeVerPedidos,onVolver}) {
 const [cliente,setCliente]=useState(null),[borrador,setBorrador]=useState(null),[error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[cargando,setCargando]=useState(true),[guardando,setGuardando]=useState(false),[version,setVersion]=useState(0)
 useCambiosSinGuardar(borrador!==null||guardando)
 const ocupado=useRef(false)
 useEffect(()=>{let vigente=true;repository.detalle(id).then(c=>{if(vigente){setCliente(c);setCargando(false)}}).catch(e=>{if(vigente){setCliente(null);setError(e.message);setCargando(false)}});return()=>{vigente=false}},[id,repository,version])
 async function guardar(e){
  e.preventDefault();if(ocupado.current)return
  ocupado.current=true;setGuardando(true);setError('');setMensaje('')
  try{const c=await repository.guardar(borrador);setCliente(c);setBorrador(null);setMensaje('Datos del cliente actualizados.')}
  catch(fallo){setError(fallo.message)}
  finally{ocupado.current=false;setGuardando(false)}
 }
 return <section className="panel customer-detail">
  <button className="button button-secondary" disabled={guardando} onClick={onVolver}>Volver a clientes</button>
  {error&&<p role="alert" className="error-feedback">{error}</p>}
  {cargando?<p role="status">Cargando ficha…</p>:!cliente?<><p>La ficha no está disponible o ya no tenés acceso.</p><button className="button" onClick={()=>{setCargando(true);setError('');setVersion(v=>v+1)}}>Reintentar</button></>:<>
   <span className="eyebrow">FICHA COMERCIAL</span><h2>{cliente.nombre}</h2>
   {borrador?<form className="product-form" onSubmit={guardar}><fieldset className="form-fields" disabled={guardando}>
    <div className="field-group"><label htmlFor="cliente-nombre">Nombre del cliente</label><input id="cliente-nombre" required minLength={2} maxLength={100} value={borrador.nombre} onChange={e=>setBorrador({...borrador,nombre:e.target.value})}/></div>
    <div className="field-group"><label htmlFor="cliente-telefono">Teléfono del cliente</label><input id="cliente-telefono" type="tel" required maxLength={30} value={borrador.telefono} onChange={e=>setBorrador({...borrador,telefono:e.target.value})}/><small>Usá el mismo código de país y área para reconocer compras futuras.</small></div>
    <div className="field-group"><label htmlFor="cliente-direccion">Dirección de contacto</label><input id="cliente-direccion" maxLength={200} value={borrador.direccion} onChange={e=>setBorrador({...borrador,direccion:e.target.value})}/></div>
    <div className="field-group"><label htmlFor="cliente-referencia">Referencia de dirección</label><textarea id="cliente-referencia" maxLength={300} value={borrador.referencia} onChange={e=>setBorrador({...borrador,referencia:e.target.value})}/></div>
    <p>Los pedidos anteriores conservarán sus datos. Al cambiar el teléfono, las compras futuras se reconocerán por el nuevo número.</p>
    <div className="payment-actions"><button className="button button-primary" type="submit">{guardando?'Guardando…':'Guardar datos del cliente'}</button><button className="button button-secondary" type="button" onClick={()=>{setBorrador(null);setError('');setVersion(v=>v+1)}}>Volver sin guardar</button></div>
   </fieldset></form>:<>
    <dl className="order-contact"><div><dt>Teléfono</dt><dd>{cliente.telefono}</dd></div><div><dt>Dirección de contacto</dt><dd>{cliente.direccion||'Sin dirección registrada'}</dd></div><div><dt>Referencia</dt><dd>{cliente.referencia||'Sin referencia'}</dd></div></dl>
    <p>Última actualización: {new Date(cliente.fecha_actualizacion).toLocaleString('es-AR')}</p>
    {puedeEditar?<button className="button button-primary" onClick={()=>{setBorrador({...cliente});setMensaje('');setError('')}}>Editar datos del cliente</button>:<p>Tu cuenta tiene acceso de consulta.</p>}
   </>}
   {mensaje&&<p role="status" className="feedback">{mensaje}</p>}
   {!borrador&&(puedeVerPedidos?<HistorialCliente clienteId={id} repository={repository}/>:<p>Necesitás permiso para consultar pedidos y ver el historial de este cliente.</p>)}
  </>}
 </section>
}
export default function PanelClientes({client,negocio,usuarioId,onVolver,repository:externo}) {
 const repository=useMemo(()=>externo??crearClientesRepository(client,negocio.id,usuarioId),[externo,client,negocio.id,usuarioId])
 const [busqueda,setBusqueda]=useState(''),[consulta,setConsulta]=useState(''),[errorBusqueda,setErrorBusqueda]=useState('')
 const [pagina,setPagina]=useState(0),[version,setVersion]=useState(0),[seleccionLocal,setSeleccionLocal]=useState(null),[resultado,setResultado]=useState({cargando:true,clientes:[],total:0,error:''})
 const ruta=useRuta(),destino=leerRuta(ruta),seleccionado=destino?.seccion==='clientes'?destino.detalle:seleccionLocal
 const setSeleccionado=id=>destino?.seccion==='clientes'?navegar(rutaNegocio(negocio.id,'clientes',id??'')):setSeleccionLocal(id)
 useEffect(()=>{let vigente=true;repository.listar(pagina,consulta).then(r=>{if(vigente)setResultado({...r,cargando:false,error:''})}).catch(e=>{if(vigente)setResultado({clientes:[],total:0,cargando:false,error:e.message})});return()=>{vigente=false}},[repository,pagina,version,consulta])
 function recargar(){setResultado({cargando:true,clientes:[],total:0,error:''});setVersion(v=>v+1)}
 function buscar(e){e.preventDefault();try{filtroBusqueda(busqueda);setErrorBusqueda('');setConsulta(busqueda.trim());setPagina(0);recargar()}catch(error){setErrorBusqueda(error.message)}}
 function limpiar(){setBusqueda('');setConsulta('');setPagina(0);setErrorBusqueda('');recargar()}
 function cambiarPagina(p){setPagina(p);recargar()}
 return <main className="workspace-page"><header className="dashboard-topbar"><Marca/><button className="button button-outline" onClick={onVolver}>Volver al panel</button></header><div className="app-shell">
  <header className="app-header"><div><h1>Clientes</h1><p>{negocio.nombre}</p></div></header>

  {seleccionado!==null?<Ficha key={seleccionado} id={seleccionado} repository={repository} puedeEditar={negocio.permisos.includes('clientes.editar')} puedeVerPedidos={negocio.permisos.includes('pedidos.ver')} onVolver={()=>{setSeleccionado(null);recargar()}}/>:<>
   <form className="customer-search" onSubmit={buscar}>
    <div className="field-group"><label htmlFor="buscar-cliente">Buscar por nombre o teléfono</label><input id="buscar-cliente" type="search" maxLength={100} value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Ej.: Ana o 11 5555-6666"/></div>
    <button className="button button-primary" type="submit">Buscar clientes</button>
    <button className="button button-secondary" type="button" onClick={limpiar}>Limpiar búsqueda</button>
   </form>
   {errorBusqueda&&<p role="alert" className="error-feedback">{errorBusqueda}</p>}
   <button className="button button-secondary" onClick={recargar}>Actualizar clientes</button>
   {consulta&&<p>Resultados para «{consulta}»</p>}
   {resultado.cargando?<p role="status">Cargando clientes…</p>:resultado.error?<p role="alert" className="error-feedback">{resultado.error}</p>:<>
    <div className="section-heading"><h2>{resultado.total} {consulta ? 'clientes encontrados' : 'clientes registrados'}</h2></div>
    {!resultado.clientes.length?<div className="access-state"><h3>{consulta?'No encontramos clientes con esa búsqueda':'Todavía no hay clientes en esta página'}</h3><p>{consulta?'Probá con parte del nombre o del teléfono.':'Al confirmar un pedido, su contacto aparecerá aquí.'}</p></div>:<ul className="customers-list">{resultado.clientes.map(c=><li className="panel customer-card" key={c.id}><div><h3>{c.nombre}</h3><p>{c.telefono}</p><p>{c.direccion||'Sin dirección registrada'}</p></div><button className="button button-secondary" aria-label={'Ver ficha de '+c.nombre} onClick={()=>setSeleccionado(c.id)}>Ver ficha ↗</button></li>)}</ul>}
    <nav className="orders-pagination" aria-label="Páginas de clientes"><button className="button button-secondary" disabled={pagina===0} onClick={()=>cambiarPagina(pagina-1)}>Anterior</button><span>Página {pagina+1}</span><button className="button button-secondary" disabled={(pagina+1)*25>=resultado.total} onClick={()=>cambiarPagina(pagina+1)}>Siguiente</button></nav>
   </>}
  </>}
 </div></main>
}
