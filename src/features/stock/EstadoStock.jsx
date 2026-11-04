export default function EstadoStock({producto}) {
 const estado=producto.estado_stock??(Number(producto.disponible)===0?'sin_stock':'normal')
 if(estado==='normal')return null
 return <span className={'stock-status stock-status-'+estado}>{estado==='sin_stock'?'Sin existencias':'Stock bajo'}</span>
}
