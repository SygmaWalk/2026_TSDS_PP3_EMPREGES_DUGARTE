export function validarContacto(nombre, telefono) {
  const contacto = { nombre: nombre.trim(), telefono: telefono.replace(/[ ()-]/g, '') }
  if (contacto.nombre.length < 2 || contacto.nombre.length > 100 || !/^\+?[0-9]{7,15}$/.test(contacto.telefono)) {
    throw new Error('Ingresá tu nombre y un teléfono válido de 7 a 15 dígitos.')
  }
  return contacto
}
export async function confirmarPedido(client, intento) {
  try {
    const { data, error } = await client.rpc('confirmar_pedido', intento)
    if (error) {
      const definitivo = ['22023','42501','PT429'].includes(error.code)
      throw Object.assign(new Error(definitivo ? error.message : 'No pudimos comprobar el resultado. Reintentá para recuperar la confirmación sin duplicar el pedido.'), { definitivo })
    }
    if (!data?.id || !Array.isArray(data.items) || data.estado !== 'Pendiente' || !Number.isSafeInteger(data.subtotal_centavos)) {
      throw new Error('No pudimos comprobar la confirmación. Reintentá con este mismo pedido.')
    }
    return data
  } catch (error) {
    if (error.definitivo) throw error
    throw Object.assign(new Error('No pudimos comprobar el resultado. Reintentá para recuperar la confirmación sin duplicar el pedido.'), { definitivo: false })
  }
}
export function claveConfirmacion(negocio, identidad = 'invitado') {
  return 'empregest:pedido:v1:' + negocio + ':' + identidad
}
export function leerConfirmacion(clave) {
  try {
    const dato = JSON.parse(sessionStorage.getItem(clave))
    return dato?.estado === 'pendiente' && dato.intento?.p_clave || dato?.estado === 'confirmado' && dato.recibo?.id ? dato : null
  } catch { return null }
}
export function guardarConfirmacion(clave, dato) {
  try { sessionStorage.setItem(clave, JSON.stringify(dato)) }
  catch { throw new Error('No se pudo conservar este intento en el navegador. Habilitá el almacenamiento antes de confirmar.') }
}
