import DesgloseCobro from './DesgloseCobro.jsx'
import { validarDesglose } from './desglosePago.js'
import { useRef, useState } from 'react'
export default function FinalizarEntrega({pedido,puedeRegistrarPago,repository,onActualizar}) {
  const [revision,setRevision]=useState(null),[guardando,setGuardando]=useState(false),[error,setError]=useState('')
  const enVuelo=useRef(false)
  const pagado=pedido.estado_pago==='Pagado'
  const version=pedido.version_pago??0
  const vigente=revision&&revision.version===version&&revision.estado===pedido.estado
  function revisar(){setError('');setRevision({version,estado:pedido.estado,metodo:pedido.metodo_pago||pedido.metodo_pago_previsto||'',cobrado:false,efectivo:'',transferencia:''})}
  async function confirmar(e){
    e.preventDefault()
    if(enVuelo.current||!vigente)return
    enVuelo.current=true;setGuardando(true);setError('')
    try{
      if(puedeRegistrarPago&&!pagado&&revision.cobrado&&revision.metodo==='Mixto'){
        const d=validarDesglose(revision.efectivo,revision.transferencia,pedido.total??pedido.subtotal)
        await repository.finalizarEntregaDividida(pedido.id,revision.estado,revision.version,d.efectivo,d.transferencia)
      }else await repository.finalizarEntrega(pedido.id,revision.estado,revision.version,puedeRegistrarPago&&!pagado&&revision.metodo!=='Mixto'?revision.metodo:null,puedeRegistrarPago&&!pagado?revision.cobrado:false)
      setRevision(null)
    }
    catch(fallo){setError(fallo.message)}
    finally{enVuelo.current=false;setGuardando(false);onActualizar()}
  }
  return <section className="order-payment" aria-label="Finalizar entrega">
    {!revision?<button className="button button-primary" onClick={revisar}>Revisar y marcar entregado</button>:!vigente?<><p role="status">El pedido o su pago cambió. Revisá los datos nuevamente.</p><button className="button button-secondary" onClick={revisar}>Revisar de nuevo</button></>:
    <form onSubmit={confirmar}>
      <h3>Confirmar entrega</h3><p>Elegido por el cliente: <strong>{pedido.metodo_pago_previsto||'Sin registrar (pedido anterior)'}</strong>.</p>
      {pagado?<p>Pago ya registrado por {pedido.metodo_pago}. Se conservarán el método y la fecha del cobro.</p>:puedeRegistrarPago?<><div className="field-group"><label htmlFor="entrega-metodo">Método acordado al entregar</label><select id="entrega-metodo" required value={revision.metodo} disabled={guardando} onChange={e=>setRevision({...revision,metodo:e.target.value})}><option value="">Seleccionar método</option><option>Efectivo</option><option>Transferencia</option><option value="Mixto">Efectivo + transferencia</option></select></div>{revision.metodo==='Mixto'&&<DesgloseCobro prefijo="entrega" efectivo={revision.efectivo} transferencia={revision.transferencia} total={pedido.total??pedido.subtotal} disabled={guardando} onChange={d=>setRevision({...revision,...d})}/>}<label><input type="checkbox" checked={revision.cobrado} disabled={guardando} onChange={e=>setRevision({...revision,cobrado:e.target.checked})}/> Confirmo que recibí el importe completo</label><p>{revision.cobrado?'Se registrarán juntos la entrega y el cobro.':'El pedido quedará entregado y el pago seguirá pendiente.'}</p></>:<p>Podés confirmar la entrega. El pago seguirá pendiente; tu cuenta no tiene permiso para registrar cobros.</p>}
      <div className="payment-actions"><button className="button button-primary" disabled={guardando} type="submit">{guardando?'Guardando…':'Confirmar entrega'}</button><button className="button button-secondary" disabled={guardando} type="button" onClick={()=>setRevision(null)}>Volver sin entregar</button></div>
    </form>}
    {error&&<p className="error-feedback" role="alert">{error}</p>}
  </section>
}
