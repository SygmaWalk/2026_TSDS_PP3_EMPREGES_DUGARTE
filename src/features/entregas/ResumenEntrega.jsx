import { formatearCentavos } from '../carrito/carrito.js'
export default function ResumenEntrega({entrega,costo,total}) {
  return <div className="delivery-summary">
    <h3>{entrega?.modalidad==='envio'?'Envío a domicilio':entrega?.modalidad==='retiro'?'Retiro en el emprendimiento':'Entrega no registrada en este pedido'}</h3>
    {entrega?.modalidad==='envio'&&<><p><strong>{entrega.direccion}</strong>{entrega.referencia&&<><br/>{entrega.referencia}</>}</p><p className="field-help">Punto: {entrega.latitud}, {entrega.longitud}<br/>{entrega.franja} · {(Number(entrega.distancia_m)/1000).toLocaleString('es-AR',{maximumFractionDigits:3})} km en línea recta</p></>}
    {entrega?.modalidad==='retiro'&&<p>Coordiná el lugar y el horario de retiro con el emprendimiento.</p>}
    {entrega&&<div className="cart-summary"><span>Costo de envío</span><strong>{formatearCentavos(costo??0)}</strong></div>}
    <div className="cart-summary"><span>Total del pedido</span><strong>{formatearCentavos(total)}</strong></div>
  </div>
}
