import { puntoValido } from '../entregas/entregasRepository.js'
export async function cargarDirecciones(client) {
 const {data,error}=await client.from('direcciones_cliente').select('id,nombre,direccion,referencia,latitud,longitud,predeterminada').order('predeterminada',{ascending:false}).order('nombre')
 if(error)throw new Error('No se pudieron cargar tus direcciones. Intentá nuevamente.')
 return data??[]
}
export async function guardarDireccion(client,datos) {
 if(!datos.nombre.trim()||datos.nombre.trim().length>60||datos.direccion.trim().length<5||datos.direccion.trim().length>200||datos.referencia.length>300||!puntoValido(datos))throw new Error('Completá el nombre, la dirección y un punto válido en el mapa.')
 const {data,error}=await client.rpc('guardar_direccion_cliente',{p_datos:datos})
 if(error)throw new Error('No se pudo guardar la dirección. Revisá tu conexión y volvé a intentar.')
 return data
}
export async function eliminarDireccion(client,id) {
 const {data,error}=await client.from('direcciones_cliente').delete().eq('id',id).select('id')
 if(error||!data?.length)throw new Error('No se pudo eliminar la dirección. Actualizá la lista e intentá nuevamente.')
}
