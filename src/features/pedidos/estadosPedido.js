export const flujoPedido = entrega => ['Pendiente','En preparación',entrega?.modalidad==='envio'?'En ruta de entrega':'Listo para retirar','Entregado']
export const ESTADOS_PEDIDO = ['Pendiente','En preparación','En ruta de entrega','Listo para retirar','Entregado','Cancelado']
export const ESTADOS_FILTRO = [...ESTADOS_PEDIDO,'Confirmado','Listo para entregar']
export function siguienteEstado(estado,entrega) {
 if(estado==='Confirmado')return 'En preparación'
 if(estado==='Listo para entregar')return entrega?.modalidad==='envio'?'En ruta de entrega':'Entregado'
 const flujo=flujoPedido(entrega),indice=flujo.indexOf(estado)
 return indice>=0?flujo[indice+1]??null:null
}
export const puedeCancelar = estado => ESTADOS_FILTRO.includes(estado)&&!['Entregado','Cancelado'].includes(estado)
export const claseEstado = estado => ({Pendiente:'pendiente',Confirmado:'confirmado','En preparación':'preparacion','Listo para entregar':'listo','Listo para retirar':'listo','En ruta de entrega':'listo',Entregado:'entregado',Cancelado:'cancelado'}[estado]??'pendiente')
