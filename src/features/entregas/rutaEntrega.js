import { puntoValido } from './entregasRepository.js'

// Usar el origen del pedido; la configuración actual puede ser distinta.
export function rutaEntrega(entrega) {
  if(entrega?.modalidad!=='envio'||!puntoValido(entrega)||!puntoValido(entrega.origen))return null
  const parametros=new URLSearchParams({
    api:'1',
    origin:entrega.origen.latitud+','+entrega.origen.longitud,
    destination:entrega.latitud+','+entrega.longitud,
  })
  return 'https://www.google.com/maps/dir/?'+parametros.toString()
}
