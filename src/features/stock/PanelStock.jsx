import {useRuta,leerRuta,navegar,rutaNegocio} from '../../navigation.js'
import UmbralStock from './UmbralStock.jsx'
import EstadoStock from './EstadoStock.jsx'
import {useEffect,useMemo,useRef,useState} from 'react'
import {Marca} from '../acceso/InterfazAcceso.jsx'
import {cantidadStock,crearStockRepository} from './stockRepository.js'
const cantidad=n=>Number(n).toLocaleString('es-AR',{maximumFractionDigits:3})
function DetalleStock({producto,repository,puedeRegistrar,puedeConfigurar,onVolver,onActualizar}) {
 const [movimiento,setMovimiento]=useState(null),[error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[guardando,setGuardando]=useState(false)
 const [pagina,setPagina]=useState(0),[version,setVersion]=useState(0),[historial,setHistorial]=useState({cargando:true,movimientos:[],total:0,error:''})
 const clave=useRef(null),ocupado=useRef(false)
 useEffect(()=>{let vigente=true;repository.historial(producto.producto_id,pagina).then(r=>{if(vigente)setHistorial({...r,cargando:false,error:''})}).catch(e=>{if(vigente)setHistorial({cargando:false,movimientos:[],total:0,error:e.message})});return()=>{vigente=false}},[repository,producto.producto_id,pagina,version])
 function actualizar(){setHistorial(h=>({...h,cargando:true}));setVersion(v=>v+1);onActualizar()}
 function editar(campos){clave.current=null;setMovimiento(m=>({...m,...campos}));setMensaje('');setError('')}
 async function guardar(e){
  e.preventDefault();if(ocupado.current||!puedeRegistrar)return
  try{cantidadStock(movimiento.cantidad);if(movimiento.motivo.trim().length<2)throw Error('Ingresá un motivo para este movimiento.')}
  catch(e){setError(e.message);return}
  ocupado.current=true;setGuardando(true);setError('');setMensaje('')
  clave.current??=crypto.randomUUID()
  try{const r=await repository.registrar(producto,{...movimiento,clave:clave.current});setMovimiento(null);clave.current=null;setMensaje('Movimiento registrado. Stock disponible: '+cantidad(r.disponible));setPagina(0);actualizar()}
  catch(e){setError(e.message)}
  finally{ocupado.current=false;setGuardando(false)}
 }
 return <section className="panel stock-detail">
  <button className="button button-secondary" disabled={guardando} onClick={onVolver}>Volver al inventario</button>
  <div className="stock-detail-heading"><h2>{producto.nombre}{producto.es_combo?' · Combo':''}</h2><span className="stock-quantity">{cantidad(producto.disponible)} <small>unidades disponibles</small></span></div>
  <EstadoStock producto={producto}/>
  {producto.es_combo&&<p>Disponibilidad calculada a partir de sus componentes.</p>}
  {!producto.es_combo&&producto.disponible_para_venta!==undefined&&Number(producto.disponible_para_venta)<Number(producto.disponible)&&<p>Disponibles para vender con sus componentes: {cantidad(producto.disponible_para_venta)}</p>}
  <UmbralStock producto={producto} repository={repository} puedeConfigurar={puedeConfigurar} onActualizar={onActualizar}/>
  {error&&<p role="alert" className="error-feedback">{error}</p>}{mensaje&&<p role="status" className="feedback">{mensaje}</p>}
  {puedeRegistrar&&!movimiento&&<button className="button button-primary" onClick={()=>{setMovimiento({tipo:'Entrada',cantidad:'',motivo:'',referencia:''});setError('');setMensaje('');clave.current=null}}>Registrar movimiento</button>}
  {movimiento&&<form className="stock-form" onSubmit={guardar}><fieldset className="form-fields" disabled={guardando}>
   <div className="field-group"><label htmlFor="stock-tipo">Tipo de movimiento</label><select id="stock-tipo" value={movimiento.tipo} onChange={e=>editar({tipo:e.target.value})}>{['Entrada','Producción','Ajuste positivo','Ajuste negativo'].map(t=><option key={t}>{t}</option>)}</select></div>
   <div className="field-group"><label htmlFor="stock-cantidad">Cantidad de unidades</label><input id="stock-cantidad" required inputMode="decimal" value={movimiento.cantidad} onChange={e=>editar({cantidad:e.target.value})}/><small>{movimiento.tipo==='Ajuste negativo'?'Se restará esta cantidad del stock.':'Se sumará esta cantidad al stock.'}</small></div>
   <div className="field-group"><label htmlFor="stock-motivo">Motivo del movimiento</label><textarea id="stock-motivo" required minLength={2} maxLength={300} value={movimiento.motivo} onChange={e=>editar({motivo:e.target.value})}/></div>
   <div className="field-group"><label htmlFor="stock-referencia">Referencia o lote (opcional)</label><input id="stock-referencia" maxLength={100} value={movimiento.referencia} onChange={e=>editar({referencia:e.target.value})}/></div>
   <div className="payment-actions"><button className="button button-primary" type="submit">{guardando?'Guardando…':'Guardar movimiento'}</button><button className="button button-secondary" type="button" onClick={()=>{setMovimiento(null);setError('');clave.current=null}}>Descartar</button></div>
  </fieldset></form>}
  <div className="section-heading"><h3>Movimientos</h3><button className="button button-secondary" disabled={guardando} onClick={actualizar}>Actualizar existencias</button></div>
  {historial.cargando?<p role="status">Cargando movimientos…</p>:historial.error?<p role="alert" className="error-feedback">{historial.error}</p>:<>
   {!historial.movimientos.length?<p>Todavía no hay movimientos registrados.</p>:<ul className="stock-movements">{historial.movimientos.map(m=><li key={m.id}><div><strong>{m.tipo}</strong><time dateTime={m.fecha}>{new Date(m.fecha).toLocaleString('es-AR')}</time><p>{m.motivo}</p>{m.referencia&&<small>Referencia: {m.referencia}</small>}</div><span className={'stock-delta '+(Number(m.cantidad)<0?'stock-negative':'')}>{Number(m.cantidad)>0?'+':''}{cantidad(m.cantidad)}</span></li>)}</ul>}
   <nav className="orders-pagination" aria-label="Páginas de movimientos"><button className="button button-secondary" disabled={pagina===0} onClick={()=>{setHistorial(h=>({...h,cargando:true}));setPagina(p=>p-1)}}>Anterior</button><span>Página {pagina+1}</span><button className="button button-secondary" disabled={(pagina+1)*25>=historial.total} onClick={()=>{setHistorial(h=>({...h,cargando:true}));setPagina(p=>p+1)}}>Siguiente</button></nav>
  </>}
 </section>
}
export default function PanelStock({client,negocio,usuarioId,onVolver,repository:externo}) {
 const repository=useMemo(()=>externo??crearStockRepository(client,negocio.id,usuarioId),[externo,client,negocio.id,usuarioId])
 const [pagina,setPagina]=useState(0),[busqueda,setBusqueda]=useState(''),[consulta,setConsulta]=useState(''),[seleccionado,setSeleccionadoLocal]=useState(null),[version,setVersion]=useState(0)
 const [filtro,setFiltro]=useState('todos')
 const [resultado,setResultado]=useState({cargando:true,productos:[],total:0,error:''})
 const ruta=useRuta(),destino=leerRuta(ruta)
 const seleccionadoId=destino?.seccion==='stock'?destino.detalle:seleccionado?.producto_id
 const setSeleccionado=p=>destino?.seccion==='stock'?navegar(rutaNegocio(negocio.id,'stock',p?.producto_id??'')):setSeleccionadoLocal(p)
 useEffect(()=>{
  let vigente=true
  async function cargar(){
   try{
    const r=await repository.listar(pagina,consulta,filtro)
    const detalle=seleccionadoId!=null?(r.productos.find(p=>p.producto_id===seleccionadoId)??(repository.obtener?await repository.obtener(seleccionadoId):null)):null
    if(vigente){setResultado({...r,cargando:false,error:''});setSeleccionadoLocal(detalle);if(pagina>0&&pagina*25>=r.total)setPagina(Math.max(0,Math.ceil(r.total/25)-1))}
   }catch(e){if(vigente)setResultado({cargando:false,productos:[],total:0,error:e.message})}
  }
  cargar();return()=>{vigente=false}
 },[repository,pagina,consulta,filtro,version,seleccionadoId])
 useEffect(()=>{
  const refrescar=()=>{if(!document.hidden)setVersion(v=>v+1)}
  const timer=setInterval(refrescar,15000)
  window.addEventListener('focus',refrescar)
  return()=>{clearInterval(timer);window.removeEventListener('focus',refrescar)}
 },[])
 function actualizar(){setResultado(r=>({...r,cargando:true}));setVersion(v=>v+1)}
 const producto=seleccionado?.producto_id===seleccionadoId?seleccionado:null
 return <main className="workspace-page"><header className="dashboard-topbar"><Marca/><button className="button button-outline" onClick={onVolver}>Volver al panel</button></header><div className="app-shell">
  <header className="app-header"><div><h1>Inventario</h1><p>{negocio.nombre}</p></div><button className="button button-secondary" onClick={actualizar}>Actualizar inventario</button></header>
  {resultado.error&&<p role="alert" className="error-feedback">{resultado.error}</p>}
  {seleccionadoId!=null&&!producto?<p role="status">{resultado.cargando?'Cargando producto…':'El producto no está disponible.'}</p>:seleccionadoId!=null&&producto?<DetalleStock key={producto.producto_id} producto={producto} repository={repository} puedeRegistrar={!producto.es_combo&&negocio.permisos.includes('stock.registrar')} puedeConfigurar={negocio.permisos.includes('stock.registrar')} onVolver={()=>setSeleccionado(null)} onActualizar={actualizar}/>:<>
   <form className="customer-search" onSubmit={e=>{e.preventDefault();setPagina(0);setConsulta(busqueda.trim());actualizar()}}><div className="field-group"><label htmlFor="stock-buscar">Buscar producto</label><input type="search" id="stock-buscar" maxLength={100} value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></div><button className="button button-primary" type="submit">Buscar</button><button className="button button-secondary" type="button" onClick={()=>{setBusqueda('');setConsulta('');setPagina(0);actualizar()}}>Limpiar</button></form>
   <div className="stock-filter field-group"><label htmlFor="stock-filtro">Mostrar inventario</label><select id="stock-filtro" value={filtro} onChange={e=>{setFiltro(e.target.value);setPagina(0);actualizar()}}><option value="todos">Todos los productos</option><option value="bajo">En el mínimo o por debajo</option><option value="sin_stock">Sin existencias</option></select></div>
   {resultado.cargando?<p role="status">Cargando inventario…</p>:!resultado.error&&<>
    <p>{resultado.total} productos</p>
    {!resultado.productos.length?<p>{consulta||filtro!=='todos'?'No hay productos que coincidan con los filtros.':'Los productos que crees aparecerán aquí.'}</p>:<ul className="stock-products">{resultado.productos.map(p=><li className="panel stock-product" key={p.producto_id}><div><h2>{p.nombre}</h2><EstadoStock producto={p}/><span>{p.visible?'Publicado':'Oculto en la tienda'}</span></div><strong className="stock-quantity">{cantidad(p.disponible)}<small>{Number(p.disponible)===0?'Sin existencias':'unidades disponibles'}</small></strong><button className="button button-secondary" aria-label={'Ver inventario de '+p.nombre} onClick={()=>setSeleccionado(p)}>Ver movimientos ↗</button></li>)}</ul>}
    <nav className="orders-pagination" aria-label="Páginas de inventario"><button className="button button-secondary" disabled={pagina===0} onClick={()=>{setPagina(p=>p-1);actualizar()}}>Anterior</button><span>Página {pagina+1}</span><button className="button button-secondary" disabled={(pagina+1)*25>=resultado.total} onClick={()=>{setPagina(p=>p+1);actualizar()}}>Siguiente</button></nav>
   </>}
  </>}
 </div></main>
}
