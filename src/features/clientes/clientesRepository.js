import { obtenerAcceso } from '../acceso/accesoRepository.js'
import { crearPanelPedidosRepository } from '../pedidos/panelPedidosRepository.js'

export const CLIENTES_POR_PAGINA = 25
export function filtroBusqueda(valor = '') {
  const texto = valor.trim()
  if (texto.length > 100 || texto.includes('*')) throw Error('Usá hasta 100 caracteres, sin asteriscos, para buscar.')
  if (!texto) return null
  const telefono = /^[+\d\s()-]+$/.test(texto) && /\d/.test(texto)
  return { campo: telefono ? 'telefono_normalizado' : 'nombre', patron: '%' + (telefono ? texto.replace(/\D/g, '') : texto.replace(/[\\%_]/g, '\\$&')) + '%' }
}
export function crearClientesRepository(client, negocio, usuario) {
  const pedidos = crearPanelPedidosRepository(client, negocio, usuario)
  async function autorizar(verPedidos = false) {
    const a = await obtenerAcceso(client, usuario)
    const n = a.negocios.find(n => n.id === negocio)
    if (!a.habilitada || !n?.permisos.includes('clientes.ver')) throw Error('Ya no tenés acceso a los clientes de este emprendimiento.')
    if (verPedidos && !n.permisos.includes('pedidos.ver')) throw Error('No tenés permiso para consultar el historial de pedidos.')
  }
  function validarPagina(pagina) {
    if (!Number.isInteger(pagina) || pagina < 0) throw Error('Página inválida.')
  }
  function fallo(error) {
    if (error?.code === 'PT409') return Error('Otra persona actualizó la ficha. Volvé a consultarla antes de guardar.')
    if (error?.code === 'PT422') return Error('Ese teléfono ya pertenece a otra ficha de este emprendimiento.')
    if (error?.code === '42501') return Error('Ya no tenés permiso para realizar esta operación.')
    if (error?.code === '22023') return Error('Revisá el nombre, el teléfono y la dirección.')
    return Error('No se pudo completar la operación. Revisá tu conexión e intentá nuevamente.')
  }
  return {
    async listar(pagina = 0, busqueda = '') {
      validarPagina(pagina)
      const filtro = filtroBusqueda(busqueda)
      await autorizar()
      let q = client.from('clientes_comerciales').select('*', { count: 'exact' }).eq('emprendimiento_id', negocio)
      if (filtro) q = q.ilike(filtro.campo, filtro.patron)
      const r = await q.order('nombre').order('id').range(pagina * CLIENTES_POR_PAGINA, (pagina + 1) * CLIENTES_POR_PAGINA - 1)
      if (r.error) throw fallo(r.error)
      return { clientes: r.data, total: r.count }
    },
    async detalle(id) {
      await autorizar()
      const r = await client.from('clientes_comerciales').select('*').eq('emprendimiento_id', negocio).eq('id', id).maybeSingle()
      if (r.error) throw fallo(r.error)
      return r.data
    },
    async historial(id, pagina = 0) {
      validarPagina(pagina)
      await autorizar(true)
      const r = await client.from('pedidos')
        .select('id,fecha_creacion,nombre_contacto,telefono_contacto,estado,total,subtotal,estado_pago,clientes_comerciales!inner(id)', { count: 'exact' })
        .eq('emprendimiento_id', negocio).eq('cliente_comercial_id', id)
        .order('fecha_creacion', { ascending: false }).order('id', { ascending: false })
        .range(pagina * CLIENTES_POR_PAGINA, (pagina + 1) * CLIENTES_POR_PAGINA - 1)
      if (r.error) throw fallo(r.error)
      return { pedidos: r.data, total: r.count }
    },
    async detallePedido(id, clienteId) {
      await autorizar(true)
      return pedidos.detalle(id, clienteId)
    },
    async guardar(c) {
      await autorizar()
      const r = await client.rpc('editar_cliente_comercial', { p_cliente: c.id, p_negocio: negocio, p_version: c.version, p_nombre: c.nombre, p_telefono: c.telefono, p_direccion: c.direccion, p_referencia: c.referencia })
      if (r.error) throw fallo(r.error)
      return r.data
    },
  }
}
