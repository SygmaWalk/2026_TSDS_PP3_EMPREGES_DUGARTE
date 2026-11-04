export const PERMISOS_PRODUCTOS = ['productos.ver', 'productos.crear', 'productos.editar', 'productos.publicar']

export async function obtenerAcceso(client, usuarioId) {
  const cuenta = await client.from('cuentas_acceso').select('rol,habilitada').eq('usuario_id', usuarioId).maybeSingle()
  if (cuenta.error) throw new Error('No se pudieron comprobar tus permisos. Intentá nuevamente.')
  if (!cuenta.data?.habilitada) return { rol: cuenta.data?.rol, habilitada: false, negocios: [] }
  const { rol } = cuenta.data
  if (rol === 'cliente') return { rol, habilitada: true, negocios: [] }
  if (rol === 'administrador') {
    const { data, error } = await client.from('emprendimientos').select('id,nombre,slug,activo').order('id')
    if (error) throw new Error('No se pudieron cargar los emprendimientos.')
    return { rol, habilitada: true, negocios: data.map(n => ({ ...n, permisos: [...PERMISOS_PRODUCTOS, 'pedidos.ver', 'pedidos.actualizar_estado', 'pedidos.registrar_pago', 'clientes.ver', 'clientes.editar', 'entregas.configurar', 'stock.ver', 'stock.registrar', 'tienda.configurar'] })) }
  }
  if (rol !== 'emprendimiento') throw new Error('La cuenta no tiene un rol válido.')
  const { data, error } = await client.from('miembros_emprendimiento')
    .select('emprendimiento_id,emprendimientos(id,nombre,slug,activo),permisos_miembro(permiso)')
    .eq('usuario_id', usuarioId).eq('habilitada', true).order('emprendimiento_id')
  if (error) throw new Error('No se pudieron cargar tus emprendimientos.')
  return { rol, habilitada: true, negocios: data.filter(f => f.emprendimientos).map(f => ({
    ...f.emprendimientos, permisos: f.permisos_miembro.map(p => p.permiso),
  })) }
}
