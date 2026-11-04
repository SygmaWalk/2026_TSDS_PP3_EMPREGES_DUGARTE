import {useRuta,leerRuta,navegar,rutaNegocio} from '../../navigation.js'
import DevolucionStock from './DevolucionStock.jsx'
import { cantidadesDevolucion } from './devolucionStock.js'
import FinalizarEntrega from './FinalizarEntrega.jsx'
import PagoPedido, { ResumenPago } from './PagoPedido.jsx'
import UbicacionEntrega from '../entregas/UbicacionEntrega.jsx'
import ResumenEntrega from '../entregas/ResumenEntrega.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marca, InsigniaRol } from '../acceso/InterfazAcceso.jsx'
import { formatearCentavos } from '../carrito/carrito.js'
import { crearPanelPedidosRepository, intervaloFechas, TAMANO_PAGINA } from './panelPedidosRepository.js'
import { ESTADOS_PEDIDO, flujoPedido, puedeCancelar, siguienteEstado, claseEstado } from './estadosPedido.js'
import { crearSonidoPedidos } from './sonidoPedidos.js'
const importe = valor => formatearCentavos(Math.round(Number(valor)*100))
const fecha = valor => new Date(valor).toLocaleString('es-AR')
function Estado({valor}) { return <span className={'order-status status-'+claseEstado(valor)}>{valor}</span> }

export function Avisos({repository,onActualizar,onVerNuevos}) {
  const [conexion,setConexion]=useState(repository.suscribir?'CONNECTING':'MANUAL')
  const [nuevos,setNuevos]=useState([])
  const [sonido,setSonido]=useState(false)
  const [error,setError]=useState('')
  const audio=useMemo(()=>crearSonidoPedidos(),[])
  const solicitado=useRef(false)
  useEffect(()=>{
    let vigente=true, temporizador
    const vistos=new Set()
    let ultimoSonido=0
    const cerrar=repository.suscribir?.(evento=>{
      if(!vigente)return
      if(evento.tipo==='INSERT' && !vistos.has(evento.id)) {
        vistos.add(evento.id)
        if(vistos.size>1000)vistos.delete(vistos.values().next().value)
        setNuevos(prev=>[...prev.filter(id=>id!==evento.id),evento.id].slice(-100))
        if(solicitado.current && Date.now()-ultimoSonido>1500) {
          ultimoSonido=Date.now()
          if(!audio.sonar()) {setSonido(false);solicitado.current=false;setError('El navegador pausó el sonido. Activá el sonido nuevamente.')}
        }
      }
      clearTimeout(temporizador)
      temporizador=setTimeout(onActualizar,200)
    },estado=>{if(vigente)setConexion(estado)})
    return()=>{vigente=false;clearTimeout(temporizador);cerrar?.()}
  },[repository,onActualizar,audio])
  useEffect(()=>()=>audio.cerrar(),[audio])
  async function alternar() {
    if(sonido){audio.silenciar();solicitado.current=false;setSonido(false);setError('');return}
    try{await audio.activar();solicitado.current=true;setSonido(true);setError('')}
    catch(fallo){setError(fallo.message)}
  }
  const conectado=conexion==='SUBSCRIBED'
  const etiqueta=conectado?'Pedidos en vivo':conexion==='CONNECTING'?'Conectando avisos…':conexion==='MANUAL'?'Actualización manual':conexion==='SIN_ACCESO'?'Revisá tu acceso':'Reconectando avisos…'
  return <section className="orders-live" aria-label="Avisos de pedidos">
    <div className="orders-live-tools"><span className={'live-indicator '+(conectado?'is-live':'')}><i aria-hidden="true"/>{etiqueta}</span><button className="button button-secondary" aria-pressed={sonido} onClick={alternar}>{sonido?'Silenciar sonido':'Activar sonido'}</button></div>
    <p className="orders-live-hint">{conectado?'Los pedidos y sus estados se actualizan automáticamente.':'El listado también se revisa cada 30 segundos y al volver a esta ventana.'} Sonido activo mientras trabajás en este emprendimiento.</p>
    {error&&<p className="error-feedback" role="alert">{error}</p>}
    {nuevos.length>0&&<div className="new-orders-notice" role="status"><div><strong>{nuevos.length===1?'Llegó un pedido nuevo':nuevos.length+' pedidos nuevos'}</strong><span>Revisá las nuevas solicitudes de tu tienda.</span></div><button className="button button-primary" onClick={()=>{setNuevos([]);onVerNuevos()}}>Ver nuevos pedidos</button><button className="button button-secondary" onClick={()=>setNuevos([])}>Descartar aviso</button></div>}
  </section>
}

export function DetallePedido({repository,id,version,puedeGestionar,puedeRegistrarPago,onVolver,onReintentar,onActualizar,etiquetaVolver="← Volver al listado"}) {
  const [resultado,setResultado]=useState({cargando:true,pedido:null,error:''})
  const [guardando,setGuardando]=useState(false)
  const [mensaje,setMensaje]=useState('')
  const [falloCambio,setFalloCambio]=useState('')
  const [cancelando,setCancelando]=useState(false)
  const [motivo,setMotivo]=useState('')
  const [devoluciones,setDevoluciones]=useState({})
  const enVuelo=useRef(false)
  useEffect(()=>{
    let vigente=true
    repository.detalle(id).then(pedido=>{if(vigente)setResultado({cargando:false,pedido,error:''})})
      .catch(error=>{if(vigente)setResultado({cargando:false,pedido:null,error:error.message})})
    return()=>{vigente=false}
  },[repository,id,version])
  const p=resultado.pedido
  async function avanzar(cancelar=false) {
    if(enVuelo.current||!p||!puedeGestionar)return
    const destino=siguienteEstado(p.estado,p.entrega)
    if(cancelar ? !puedeCancelar(p.estado) : !destino)return
    if(cancelar && (!motivo.trim() || motivo.trim().length>500)){setFalloCambio('Ingresá un motivo de entre 1 y 500 caracteres.');return}
    let stockDevuelto
    try{if(cancelar&&p.stock_descontado)stockDevuelto=cantidadesDevolucion(p.consumos_stock_pedido??[],devoluciones)}catch(error){setFalloCambio(error.message);return}
    enVuelo.current=true;setGuardando(true);setFalloCambio('');setMensaje('')
    try {
      const actualizado=cancelar ? await repository.cancelar(p.id,p.estado,motivo.trim(),...(p.stock_descontado?[stockDevuelto]:[])) : await repository.cambiarEstado(p.id,p.estado,destino)
      setResultado(prev=>({...prev,pedido:prev.pedido?{...prev.pedido,...actualizado}:null}))
      setMensaje(cancelar?'Cancelación guardada.':'Estado actualizado a '+actualizado.estado+'.');setCancelando(false);setMotivo('')
    }catch(error){setFalloCambio(error.message)}
    finally{enVuelo.current=false;setGuardando(false);onActualizar()}
  }
  return <section className="panel order-detail">
    <button className="button button-secondary" onClick={onVolver}>{etiquetaVolver}</button>
    {resultado.cargando ? <p role="status">Cargando detalle…</p> : resultado.error ? <><p role="alert" className="error-feedback">{resultado.error}</p><button className="button" onClick={onReintentar}>Reintentar detalle</button></> : !p ? <p role="alert">El pedido no está disponible o ya no tenés acceso.</p> : <>
      <div className="order-detail-heading"><div><span className="eyebrow">DETALLE DEL PEDIDO</span><h2>Pedido #{p.id}</h2><time dateTime={p.fecha_creacion}>{fecha(p.fecha_creacion)}</time></div><Estado valor={p.estado}/></div>
      {p.estado!=='Cancelado'&&<ol className="order-progress" aria-label="Progreso del pedido">{flujoPedido(p.entrega).map((estado,i)=><li key={estado} className={i<=flujoPedido(p.entrega).indexOf(p.estado)?'step-reached':''} aria-current={estado===p.estado?'step':undefined}><span aria-hidden="true">{i+1}</span>{estado}</li>)}</ol>}
      <div className="order-next-action"><div><strong>{p.estado==='Cancelado'?'Pedido cancelado':p.estado==='Entregado'?'Pedido entregado':'Próximo paso'}</strong><p>{puedeGestionar?(siguienteEstado(p.estado,p.entrega)?'Confirmá el avance cuando la operación esté realizada.':p.estado==='Cancelado'?'Se conserva en el historial y no puede reabrirse.':'El recorrido de este pedido está completo.'):'Tu cuenta tiene acceso de consulta a este pedido.'}</p></div>{puedeGestionar&&siguienteEstado(p.estado,p.entrega)&&siguienteEstado(p.estado,p.entrega)!=='Entregado'&&<button className="button button-primary" disabled={guardando} onClick={()=>avanzar()}>{guardando?'Guardando…':'Pasar a '+siguienteEstado(p.estado,p.entrega)}</button>}</div>
      {puedeGestionar&&siguienteEstado(p.estado,p.entrega)==='Entregado'&&<FinalizarEntrega pedido={p} puedeRegistrarPago={puedeRegistrarPago} repository={repository} onActualizar={onActualizar}/>}
      {p.estado==='Cancelado'&&<section className="order-cancellation"><h3>Motivo de cancelación</h3><p className="cancellation-reason">{p.motivo_cancelacion}</p><time dateTime={p.fecha_estado}>{fecha(p.fecha_estado)}</time></section>}
      {puedeGestionar&&puedeCancelar(p.estado)&&<section className="order-cancellation">
        {!cancelando?<button className="button button-secondary" disabled={guardando} onClick={()=>{setCancelando(true);setFalloCambio('');setDevoluciones({})}}>Cancelar pedido</button>:
        <form onSubmit={e=>{e.preventDefault();void avanzar(true)}}>
          <h3>Cancelar pedido #{p.id}</h3>{p.estado==='En ruta de entrega'&&<p>El pedido ya está en ruta. Coordiná la interrupción de la entrega antes de cancelar.</p>}<p>El pedido quedará cancelado y no podrá reabrirse. Sus productos e historial se conservarán.</p>{p.estado_pago==='Pagado'&&<p>El pago registrado se conservará. Esta acción no registra ni realiza una devolución.</p>}
          <div className="field-group"><label htmlFor="motivo-cancelacion">Motivo de cancelación</label><textarea id="motivo-cancelacion" autoFocus required maxLength={500} rows={3} value={motivo} disabled={guardando} onChange={e=>setMotivo(e.target.value)}/><small>Hasta 500 caracteres.</small></div>
          {p.stock_descontado&&<DevolucionStock consumos={p.consumos_stock_pedido??[]} valores={devoluciones} onChange={setDevoluciones} disabled={guardando}/>}
          <div className="cancellation-actions"><button className="button button-primary" disabled={guardando||!motivo.trim()} type="submit">{guardando?'Guardando…':'Confirmar cancelación'}</button><button className="button button-secondary" disabled={guardando} type="button" onClick={()=>{setCancelando(false);setMotivo('');setFalloCambio('')}}>Volver sin cancelar</button></div>
        </form>}
      </section>}
      {mensaje&&<p className="feedback" role="status">{mensaje}</p>}{falloCambio&&<p className="error-feedback" role="alert">{falloCambio}</p>}
      <dl className="order-contact"><div><dt>Cliente</dt><dd>{p.nombre_contacto}</dd></div><div><dt>Teléfono</dt><dd>{p.telefono_contacto}</dd></div><div><dt>Último cambio de estado</dt><dd>{fecha(p.fecha_estado??p.fecha_creacion)}</dd></div></dl>
      <h3>Productos del pedido</h3><ul className="order-lines">{p.detalles_pedido.map(d=><li key={d.producto_id}><span><strong>{d.cantidad} × {d.nombre_producto}</strong><small>{importe(d.precio_unitario)} por unidad</small></span><strong>{importe(d.precio_unitario*d.cantidad)}</strong></li>)}</ul>
      <div className="cart-summary"><span>Subtotal de productos</span><strong>{importe(p.subtotal)}</strong></div>
      <ResumenEntrega entrega={p.entrega} costo={Math.round(Number(p.costo_envio??0)*100)} total={Math.round(Number(p.total??p.subtotal)*100)}/>
      {!(puedeGestionar&&siguienteEstado(p.estado,p.entrega)==='Entregado'&&p.estado_pago!=='Pagado')&&<PagoPedido pedido={p} puedeRegistrar={puedeRegistrarPago} repository={repository} onActualizar={onActualizar}/>}
      <UbicacionEntrega entrega={p.entrega}/>
{p.stock_descontado&&<details className="order-stock-history"><summary>Stock del pedido</summary><ul>{(p.consumos_stock_pedido??[]).map(c=><li key={c.producto_id}>{c.nombre_producto}: {Number(c.cantidad).toLocaleString('es-AR')} descontado{p.estado==='Cancelado'?' · '+Number(c.cantidad_devuelta).toLocaleString('es-AR')+' devuelto':''}</li>)}</ul></details>}
      <details className="order-history"><summary>Historial de estados</summary><ol><li><strong>Pedido recibido · Pendiente</strong><time>{fecha(p.fecha_creacion)}</time></li>{[...(p.historial_estados_pedido??[])].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.id-b.id).map(h=><li key={h.id}><strong>{h.estado_anterior} → {h.estado_nuevo}</strong><time dateTime={h.fecha}>{fecha(h.fecha)}</time></li>)}</ol></details>
    </>}
  </section>
}
function Lista({repository,consulta,version,onAbrir,onPagina,onReintentar}) {
  const [resultado,setResultado]=useState({cargando:true,pedidos:[],total:0,error:''})
  useEffect(()=>{
    let vigente=true
    repository.listar(consulta).then(data=>{if(vigente)setResultado({...data,cargando:false,error:''})})
      .catch(error=>{if(vigente)setResultado({cargando:false,pedidos:[],total:0,error:error.message})})
    return()=>{vigente=false}
  },[repository,consulta,version])
  if(resultado.cargando)return <div className="access-state" role="status">Cargando pedidos…</div>
  if(resultado.error)return <div className="access-state"><p role="alert" className="error-feedback">{resultado.error}</p><button className="button button-secondary" onClick={onReintentar}>Reintentar</button></div>
  const filtrado=consulta.estado||consulta.desde||consulta.hasta
  return <section aria-label="Pedidos recibidos">
    <div className="section-heading"><h2>{resultado.total} {resultado.total===1?'pedido encontrado':'pedidos encontrados'}</h2><span>Más recientes primero</span></div>
    {!resultado.pedidos.length ? <div className="access-state"><h3>{filtrado?'No hay pedidos para estos filtros':'Todavía no hay pedidos'}</h3><p>{filtrado?'Probá con otras fechas o quitá los filtros.':'Los pedidos confirmados en tu tienda pública aparecerán aquí.'}</p></div> :
      <ul className="orders-list">{resultado.pedidos.map(p=><li key={p.id} className={'order-row order-card state-'+claseEstado(p.estado)}>
        <div className="order-card-identity"><span className="eyebrow">PEDIDO</span><strong>#{p.id}</strong><time dateTime={p.fecha_creacion}>{fecha(p.fecha_creacion)}</time></div>
        <div className="order-card-customer"><strong>{p.nombre_contacto}</strong><span>{p.telefono_contacto}</span><small>{p.entrega?.modalidad==='envio'?'Envío a domicilio':p.entrega?.modalidad==='retiro'?'Retiro en el local':'Entrega no informada'}</small></div>
        <div className="order-row-total"><Estado valor={p.estado}/><strong>{importe(p.total??p.subtotal)}</strong><ResumenPago pedido={p}/></div>
        <button className="button button-secondary" onClick={()=>onAbrir(p.id)} aria-label={'Ver pedido #'+p.id}>Ver detalle ↗</button>
      </li>)}</ul>}
    <nav className="orders-pagination" aria-label="Páginas de pedidos"><button className="button button-secondary" disabled={consulta.pagina===0} onClick={()=>onPagina(consulta.pagina-1)}>Anterior</button><span>Página {consulta.pagina+1}</span><button className="button button-secondary" disabled={(consulta.pagina+1)*TAMANO_PAGINA>=resultado.total} onClick={()=>onPagina(consulta.pagina+1)}>Siguiente</button></nav>
  </section>
}
export default function PanelPedidos({client,negocio,usuarioId,rol,email,onVolver,onProductos,repository:externo,avisosExternos=false}) {
  const repository=useMemo(()=>externo??crearPanelPedidosRepository(client,negocio.id,usuarioId),[externo,client,negocio.id,usuarioId])
  const claveFiltros='empreges:pedidos:'+usuarioId+':'+negocio.id
  const [inicial]=useState(()=>{if(avisosExternos&&!window.location.hash.includes('?nuevos='))try{const x=JSON.parse(sessionStorage.getItem(claveFiltros));if(x&&typeof x.estado==='string'&&typeof x.desde==='string'&&typeof x.hasta==='string'&&Number.isInteger(x.pagina)&&x.pagina>=0)return x}catch{/* Preferencias opcionales. */}return {estado:'',desde:'',hasta:'',pagina:0,...(avisosExternos?{grupo:'activos'}:{})}})
  const [filtros,setFiltros]=useState(inicial)
  const [consulta,setConsulta]=useState(inicial)
  useEffect(()=>{if(avisosExternos)try{sessionStorage.setItem(claveFiltros,JSON.stringify(consulta))}catch{/* Preferencias opcionales. */}},[avisosExternos,claveFiltros,consulta])
  const [error,setError]=useState('')
  const [seleccionLocal,setSeleccionLocal]=useState(null)
  const ruta=useRuta(),destino=leerRuta(ruta)
  const seleccionado=destino?.seccion==='pedidos'?destino.detalle:seleccionLocal
  const setSeleccionado=id=>destino?.seccion==='pedidos'?navegar(rutaNegocio(negocio.id,'pedidos',id??'')):setSeleccionLocal(id)
  const [version,setVersion]=useState(0)
  const actualizar=useCallback(()=>setVersion(v=>v+1),[])
  useEffect(()=>{
    window.addEventListener('focus',actualizar)
    window.addEventListener('empreges:pedidos',actualizar)
    const intervalo=window.setInterval(actualizar,30000)
    return()=>{window.removeEventListener('focus',actualizar);window.removeEventListener('empreges:pedidos',actualizar);window.clearInterval(intervalo)}
  },[actualizar])
  function limpiar(){
    const vacios={estado:'',desde:'',hasta:'',...(avisosExternos?{grupo:consulta.grupo??'activos'}:{})}
    setFiltros(vacios);setConsulta({...vacios,pagina:0});setSeleccionado(null);setError('');actualizar()
  }
  function aplicar(e){
    e.preventDefault()
    try{intervaloFechas(filtros.desde,filtros.hasta);setConsulta({...filtros,pagina:0});setSeleccionado(null);setError('');actualizar()}
    catch(fallo){setError(fallo.message)}
  }
  return <main className="workspace-page"><header className="dashboard-topbar"><Marca/><div className="topbar-account"><InsigniaRol rol={rol}/><span className="account-email">{email}</span><button className="button button-outline" onClick={onVolver}>Volver al panel</button></div></header>
    <div className="app-shell orders-shell"><header className="app-header orders-heading"><div><h1>Pedidos</h1><p>{negocio.nombre}</p></div><button className="button button-secondary" onClick={actualizar}>Actualizar pedidos</button></header>
      <a className="public-store-link" href={'#/tienda/'+negocio.slug} target="_blank" rel="noreferrer">Abrir tienda pública ↗</a>
      <nav className="view-nav" aria-label="Secciones del emprendimiento">{negocio.permisos.includes('productos.ver')&&<button className="button" onClick={onProductos}>Productos</button>}<button className="button" aria-current="page" onClick={()=>setSeleccionado(null)}>Pedidos</button></nav>
      {!avisosExternos&&<Avisos repository={repository} onActualizar={actualizar} onVerNuevos={limpiar}/>}
      {avisosExternos&&seleccionado===null&&<div className="orders-state-tabs" aria-label="Bandejas de pedidos">{[['activos','En curso'],['historial','Historial'],['todos','Todos']].map(([id,titulo])=><button className="orders-state-tab" aria-pressed={consulta.grupo===id} key={id} onClick={()=>{const x={estado:'',desde:'',hasta:'',grupo:id,pagina:0};setFiltros(x);setConsulta(x)}}>{titulo}</button>)}</div>}
      {seleccionado!==null ? <DetallePedido key={seleccionado} version={version} puedeRegistrarPago={negocio.permisos.includes('pedidos.registrar_pago')} puedeGestionar={negocio.permisos.includes('pedidos.actualizar_estado')} repository={repository} id={seleccionado} onVolver={()=>setSeleccionado(null)} onReintentar={actualizar} onActualizar={actualizar}/> : <>
        {!avisosExternos&&<div className="orders-state-tabs" aria-label="Filtrar pedidos por estado">{['',...ESTADOS_PEDIDO].map(estado=><button key={estado} className={'orders-state-tab '+(consulta.estado===estado?'is-active':'')} aria-pressed={consulta.estado===estado} onClick={()=>{setFiltros({...filtros,estado});setConsulta({...consulta,estado,pagina:0});setError('')}}>{estado||'Todos'}</button>)}</div>}
        <details className="orders-advanced" open={!avisosExternos||undefined}><summary>Fechas y filtros avanzados</summary><form className="panel orders-filters" onSubmit={aplicar}>
          <div className="field-group"><label htmlFor="pedido-estado">Estado</label><select id="pedido-estado" value={filtros.estado} onChange={e=>setFiltros({...filtros,estado:e.target.value})}><option value="">Todos los estados</option>{ESTADOS_PEDIDO.map(e=><option key={e}>{e}</option>)}<optgroup label="Estados de pedidos anteriores"><option value="Confirmado">Confirmado (anterior)</option><option value="Listo para entregar">Listo para entregar (anterior)</option></optgroup></select></div>
          <div className="field-group"><label htmlFor="pedido-desde">Desde</label><input id="pedido-desde" type="date" value={filtros.desde} onChange={e=>setFiltros({...filtros,desde:e.target.value})}/></div>
          <div className="field-group"><label htmlFor="pedido-hasta">Hasta</label><input id="pedido-hasta" type="date" value={filtros.hasta} onChange={e=>setFiltros({...filtros,hasta:e.target.value})}/></div>
          <button className="button button-primary" type="submit">Aplicar filtros</button><button className="button button-secondary" type="button" onClick={limpiar}>Limpiar filtros</button>
          <small>Las fechas incluyen el día completo según la hora de este dispositivo.</small>
        </form></details>
        {error&&<p role="alert" className="error-feedback">{error}</p>}
        <Lista key={JSON.stringify(consulta)} version={version} repository={repository} consulta={consulta} onAbrir={setSeleccionado} onPagina={pagina=>setConsulta({...consulta,pagina})} onReintentar={actualizar}/>
      </>}
    </div>
  </main>
}
