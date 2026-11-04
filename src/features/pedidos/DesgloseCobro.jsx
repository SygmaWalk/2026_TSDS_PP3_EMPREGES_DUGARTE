import { formatearCentavos } from '../carrito/carrito.js'
import { centavosImporte } from './desglosePago.js'
export default function DesgloseCobro({prefijo,efectivo,transferencia,total,disabled,onChange}) {
 let suma
 try{suma=centavosImporte(efectivo||'0')+centavosImporte(transferencia||'0')}catch{suma=null}
 const totalCentavos=Math.round(Number(total)*100)
 return <div className="split-payment">
  <div className="split-payment-fields">
   <div className="field-group"><label htmlFor={prefijo+'-efectivo'}>Importe en efectivo</label><input id={prefijo+'-efectivo'} inputMode="decimal" placeholder="0,00" value={efectivo} disabled={disabled} onChange={e=>onChange({efectivo:e.target.value,transferencia})}/></div>
   <div className="field-group"><label htmlFor={prefijo+'-transferencia'}>Importe por transferencia</label><input id={prefijo+'-transferencia'} inputMode="decimal" placeholder="0,00" value={transferencia} disabled={disabled} onChange={e=>onChange({efectivo,transferencia:e.target.value})}/></div>
  </div>
  <p><strong>Total a cobrar: {formatearCentavos(totalCentavos)}</strong>{suma!==null&&<span> · {suma===totalCentavos?'Importes completos':suma<totalCentavos?'Faltan '+formatearCentavos(totalCentavos-suma):'Excede por '+formatearCentavos(suma-totalCentavos)}</span>}</p>
 </div>
}
export function DesgloseRegistrado({pedido}) {
 if(pedido.estado_pago!=='Pagado'||pedido.pago_efectivo===undefined)return null
 return <dl className="payment-breakdown">{[['Efectivo',pedido.pago_efectivo],['Transferencia',pedido.pago_transferencia]].filter(([,v])=>Number(v)>0).map(([nombre,valor])=><div key={nombre}><dt>{nombre}</dt><dd>{formatearCentavos(Math.round(Number(valor)*100))}</dd></div>)}</dl>
}
