export function cantidadesDevolucion(consumos,valores){
 return consumos.map(c=>{
  const texto=String(valores[c.producto_id]??'0').trim().replace(',','.')
  if(!/^\d+(\.\d{1,3})?$/.test(texto)||Number(texto)>Number(c.cantidad))throw Error('Revisá las cantidades a devolver. No pueden superar lo descontado.')
  return {producto_id:c.producto_id,cantidad:Number(texto)}
 })
}
