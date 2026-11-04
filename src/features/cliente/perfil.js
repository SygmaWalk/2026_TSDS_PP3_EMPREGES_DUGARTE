export function leerPerfil(usuario) {
  const p = usuario?.user_metadata?.perfil_cliente
  const texto = (v, max) => typeof v === 'string' ? v.slice(0, max) : ''
  return { nombre: texto(p?.nombre, 100), telefono: texto(p?.telefono, 30), direccion: texto(p?.direccion, 200) }
}

export function validarPerfil(perfil) {
  const nombre = perfil.nombre.trim(), telefono = perfil.telefono.trim(), direccion = perfil.direccion.trim()
  if (nombre.length < 2 || nombre.length > 100) throw new Error('Ingresá un nombre de entre 2 y 100 caracteres.')
  if (telefono && (!/^\+?[0-9]{7,15}$/.test(telefono.replace(/[ ()-]/g, '')) || telefono.replace(/\D/g, '').length < 7 || telefono.replace(/\D/g, '').length > 15 || telefono.length > 30)) throw new Error('Ingresá un teléfono válido, con entre 7 y 15 dígitos.')
  if (direccion.length > 200) throw new Error('La dirección no puede superar los 200 caracteres.')
  return { nombre, telefono, direccion }
}
