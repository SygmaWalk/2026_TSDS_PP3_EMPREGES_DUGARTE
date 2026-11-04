import DesgloseCobro, { DesgloseRegistrado } from './DesgloseCobro.jsx'
import { validarDesglose } from './desglosePago.js'
import { useRef, useState } from 'react'
export function ResumenPago({pedido}) {
  const pagado=pedido.estado_pago==='Pagado'
  return <span className={'payment-summary '+(pagado?'payment-paid':'payment-pending')}>Pago {pagado?'registrado':'pendiente'} · {pedido.metodo_pago||pedido.metodo_pago_previsto||'Método sin registrar'}</span>
}
export default function PagoPedido({pedido,puedeRegistrar,repository,onActualizar}) {
  const version=pedido.version_pago??0
  const [seleccion,setSeleccion]=useState(null)
  const [desglose,setDesglose]=useState({efectivo:'',transferencia:''})
  const [confirmacion,setConfirmacion]=useState(null)
  const [guardando,setGuardando]=useState(false)
  const [error,setError]=useState('')
  const [mensaje,setMensaje]=useState('')
  const enVuelo=useRef(false)
  const metodo=seleccion?.version===version?seleccion.metodo:pedido.metodo_pago||pedido.metodo_pago_previsto||''
  const editable=puedeRegistrar&&pedido.estado_pago!=='Pagado'&&pedido.estado!=='Cancelado'
  const confirmando=confirmacion?.version===version&&confirmacion.metodo===metodo
  async function guardar(pagado) {
    if(enVuelo.current||!editable||!metodo||(pagado&&!confirmando))return
    enVuelo.current=true;setGuardando(true);setError('');setMensaje('')
    try{
      if(metodo==='Mixto'){
        if(!pagado)throw Error('Confirmá el cobro completo para guardar los importes.')
        const d=validarDesglose(desglose.efectivo,desglose.transferencia,pedido.total??pedido.subtotal)
        await repository.registrarPagoDividido(pedido.id,version,d.efectivo,d.transferencia)
      }else await repository.registrarPago(pedido.id,version,metodo,pagado)
      setMensaje(pagado?'Pago registrado.':'Método de pago guardado.')
      setConfirmacion(null);setSeleccion(null)
    }catch(e){setError(e.message);setConfirmacion(null)}
    finally{enVuelo.current=false;setGuardando(false);onActualizar()}
  }
  return <section className="order-payment" aria-label="Pago del pedido">
    <div className="payment-heading"><h3>Pago del pedido</h3><ResumenPago pedido={pedido}/></div>
    <p>Elegido por el cliente: <strong>{pedido.metodo_pago_previsto||'Sin registrar (pedido anterior)'}</strong>.</p>
    <DesgloseRegistrado pedido={pedido}/>
    {pedido.fecha_pago&&<p>Registrado el <time dateTime={pedido.fecha_pago}>{new Date(pedido.fecha_pago).toLocaleString('es-AR')}</time></p>}
    {pedido.estado==='Cancelado'&&<p>{pedido.estado_pago==='Pagado'?'El pedido fue cancelado. El pago registrado se conserva; cualquier devolución debe resolverse por separado.':'El pedido está cancelado y no admite registrar pagos.'}</p>}
    {editable&&<form onSubmit={e=>{e.preventDefault();void guardar(false)}}>
      <div className="field-group"><label htmlFor="metodo-pago">Método de pago efectivo</label><select id="metodo-pago" value={metodo} disabled={guardando} onChange={e=>{setSeleccion({version,metodo:e.target.value});setConfirmacion(null);setMensaje('');setError('')}}><option value="">Seleccionar método</option><option>Efectivo</option><option>Transferencia</option><option value="Mixto">Efectivo + transferencia</option></select></div>
      {metodo==='Mixto'&&<DesgloseCobro prefijo="pago" {...desglose} total={pedido.total??pedido.subtotal} disabled={guardando} onChange={d=>{setDesglose(d);setConfirmacion(null)}}/>}
      {confirmando?<div className="payment-confirmation"><p>¿Confirmás que recibiste el total por <strong>{metodo==='Mixto'?'efectivo y transferencia':metodo.toLowerCase()}</strong>? El registro no podrá editarse desde este panel.</p><div className="payment-actions"><button className="button button-primary" type="button" disabled={guardando} onClick={()=>guardar(true)}>{guardando?'Guardando…':'Confirmar pago recibido'}</button><button className="button button-secondary" type="button" disabled={guardando} onClick={()=>setConfirmacion(null)}>Volver sin registrar pago</button></div></div>:
      <div className="payment-actions"><button className="button button-secondary" type="submit" disabled={guardando||!metodo||metodo===pedido.metodo_pago||metodo==='Mixto'}>Guardar método</button><button className="button button-primary" type="button" disabled={guardando||!metodo} onClick={()=>{try{if(metodo==='Mixto')validarDesglose(desglose.efectivo,desglose.transferencia,pedido.total??pedido.subtotal);setConfirmacion({version,metodo});setError('');setMensaje('')}catch(e){setError(e.message)}}}>Marcar como pagado</button></div>}
    </form>}
    {!puedeRegistrar&&<p>Tu cuenta tiene acceso de consulta al pago.</p>}
    {error&&<p role="alert" className="error-feedback">{error}</p>}{mensaje&&<p role="status" className="feedback">{mensaje}</p>}
  </section>
}
