export function puntoValido(p) {
  return p && Number.isFinite(p.latitud) && Number.isFinite(p.longitud) && Math.abs(p.latitud)<=90 && Math.abs(p.longitud)<=180
}
export function prepararConfiguracion(negocioId,direccion,punto,filas) {
  if(direccion.trim().length<5 || direccion.trim().length>200 || !puntoValido(punto)) throw new Error('Completá la dirección de origen y seleccioná un punto válido.')
  if(!filas.length || filas.length>20) throw new Error('Definí entre 1 y 20 franjas.')
  let anterior=0
  const franjas=filas.map(f=>{
    const km=String(f.km).trim().replace(',','.'), precio=String(f.precio).trim().replace(',','.')
    if(!/^\d+(\.\d{1,3})?$/.test(km) || !/^\d+(\.\d{1,2})?$/.test(precio)) throw new Error('Usá kilómetros con hasta 3 decimales y tarifas con hasta 2 decimales.')
    const hasta_m=Math.round(Number(km)*1000),tarifa_centavos=Math.round(Number(precio)*100)
    if(hasta_m<=anterior || hasta_m>100000 || tarifa_centavos>999999999) throw new Error('Los límites deben crecer, hasta 100 km, y las tarifas deben ser válidas.')
    anterior=hasta_m
    return {hasta_m,tarifa_centavos}
  })
  return {emprendimiento_id:negocioId,direccion_origen:direccion.trim(),...punto,franjas}
}
export async function cargarConfiguracion(client,id) {
  const {data,error}=await client.from('configuracion_entregas').select('direccion_origen,latitud,longitud,franjas,version').eq('emprendimiento_id',id).maybeSingle()
  if(error)throw new Error('No se pudo cargar la configuración de entregas. Intentá nuevamente.')
  return data
}
export async function guardarConfiguracion(client,datos) {
  const {data,error}=await client.from('configuracion_entregas').upsert(datos).select().single()
  if(error)throw new Error('No se pudo guardar. Comprobá tu conexión y tu permiso para configurar entregas.')
  return data
}
export async function cotizarEntrega(client,id,punto) {
  if(!puntoValido(punto))throw new Error('Seleccioná un punto válido en el mapa.')
  const {data,error}=await client.rpc('cotizar_entrega',{p_negocio:id,p_lat:punto.latitud,p_lng:punto.longitud})
  if(error)throw new Error(error.code==='22023'?error.message:'No se pudo calcular el envío. Intentá nuevamente.')
  return data
}
