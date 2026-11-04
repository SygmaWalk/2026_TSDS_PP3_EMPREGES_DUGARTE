import { ESTADOS_FILTRO } from './estadosPedido.js'
import { obtenerAcceso } from '../acceso/accesoRepository.js'
export const TAMANO_PAGINA = 25
function errorCobro(error) {
  if(error.code==='PT409')return Error('El pedido o su pago cambió. Revisá los datos actuales antes de continuar.')
  if(error.code==='42501')return Error('No tenés permiso para registrar este cobro.')
  if(error.code==='22023')return Error('Revisá los importes, el estado del pedido y si ya tiene un cobro registrado.')
  return Error('No se pudo registrar el cobro. Actualizá el pedido antes de reintentar.')
}
export function intervaloFechas(desde, hasta) {
  function fecha(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Ingresá fechas válidas.')
    const d = new Date(valor + 'T00:00:00')
    if (!Number.isFinite(d.getTime()) || d.getFullYear() !== Number(valor.slice(0,4)) || d.getMonth()+1 !== Number(valor.slice(5,7)) || d.getDate() !== Number(valor.slice(8,10))) throw new Error('Ingresá fechas válidas.')
    return d
  }
  const inicio = desde ? fecha(desde) : null
  const fin = hasta ? fecha(hasta) : null
  if (inicio && fin && inicio > fin) throw new Error('La fecha desde no puede ser posterior a la fecha hasta.')
  if (fin) fin.setDate(fin.getDate()+1)
  return { inicio:inicio?.toISOString(), fin:fin?.toISOString() }
}
export function crearPanelPedidosRepository(client, negocioId, usuarioId) {
  async function autorizar() {
    const acceso = await obtenerAcceso(client,usuarioId)
    if (!acceso.habilitada || !acceso.negocios.some(n=>n.id===negocioId && n.permisos.includes('pedidos.ver'))) {
      throw new Error('Ya no tenés permiso para consultar los pedidos de este emprendimiento.')
    }
  }
  return {
    async listar({estado='',desde='',hasta='',pagina=0,grupo='todos'}={}) {
      const {inicio,fin}=intervaloFechas(desde,hasta)
      if (!Number.isInteger(pagina) || pagina<0 || !['',...ESTADOS_FILTRO].includes(estado)) throw new Error('Revisá los filtros del listado.')
      await autorizar()
      try {
        let q=client.from('pedidos').select('id,nombre_contacto,telefono_contacto,subtotal,entrega,costo_envio,total,estado,estado_pago,pago_efectivo,pago_transferencia,metodo_pago_previsto,metodo_pago,fecha_pago,version_pago,motivo_cancelacion,fecha_estado,fecha_creacion',{count:'exact'})
          .eq('emprendimiento_id',negocioId).order('fecha_creacion',{ascending:false}).order('id',{ascending:false})
        if(grupo==='activos')q=q.in('estado',['Pendiente','En preparación','En ruta de entrega','Listo para retirar','Confirmado','Listo para entregar'])
        if(grupo==='historial')q=q.in('estado',['Entregado','Cancelado'])
        if (estado) q=q.eq('estado',estado)
        if (inicio) q=q.gte('fecha_creacion',inicio)
        if (fin) q=q.lt('fecha_creacion',fin)
        const {data,error,count}=await q.range(pagina*TAMANO_PAGINA,(pagina+1)*TAMANO_PAGINA-1)
        if(error)throw error
        return {pedidos:data,total:count}
      } catch {throw new Error('No se pudieron cargar los pedidos. Revisá tu conexión e intentá nuevamente.')}
    },
    async detalle(id, clienteId = null) {
      await autorizar()
      try {
        let q=client.from('pedidos').select((clienteId !== null ? 'clientes_comerciales!inner(id),' : '') + 'id,nombre_contacto,telefono_contacto,subtotal,entrega,costo_envio,total,estado,estado_pago,pago_efectivo,pago_transferencia,metodo_pago_previsto,metodo_pago,fecha_pago,version_pago,motivo_cancelacion,fecha_estado,fecha_creacion,stock_descontado,consumos_stock_pedido(producto_id,nombre_producto,cantidad,cantidad_devuelta),detalles_pedido(producto_id,nombre_producto,precio_unitario,cantidad),historial_estados_pedido(id,estado_anterior,estado_nuevo,fecha)')
          .eq('emprendimiento_id',negocioId).eq('id',id)
        if (clienteId !== null) q=q.eq('cliente_comercial_id',clienteId)
        const {data,error}=await q.maybeSingle()
        if(error)throw error
        return data
      }catch{throw new Error('No se pudo cargar el detalle del pedido. Intentá nuevamente.')}
    },

    async cambiarEstado(id, anterior, estado) {
      await autorizar()
      const {data,error}=await client.rpc('cambiar_estado_pedido',{p_pedido:id,p_negocio:negocioId,p_anterior:anterior,p_estado:estado})
      if(error) {
        if(error.code==='PT409') throw new Error('Otra persona ya actualizó este pedido. Revisá su estado actual antes de continuar.')
        if(error.code==='42501') throw new Error('Ya no tenés permiso para cambiar el estado de este pedido.')
        if(error.code==='22023') throw new Error('Ese cambio de estado no está permitido.')
        throw new Error('No se pudo confirmar el cambio. Actualizá el pedido antes de reintentar.')
      }
      return data
    },
    async cancelar(id, anterior, motivo, devoluciones = null) {
      await autorizar()
      const {data,error}=await client.rpc(devoluciones===null?'cancelar_pedido':'cancelar_pedido_stock',{p_pedido:id,p_negocio:negocioId,p_anterior:anterior,p_motivo:motivo,...(devoluciones===null?{}:{p_devoluciones:devoluciones})})
      if(error) {
        if(error.code==='PT409') throw new Error('Otra persona ya actualizó este pedido. Revisá su estado actual antes de continuar.')
        if(error.code==='42501') throw new Error('Ya no tenés permiso para cancelar este pedido.')
        if(error.code==='22023') throw new Error('Revisá el motivo y el estado del pedido. No se pueden cancelar pedidos entregados o cancelados.')
        throw new Error('No se pudo confirmar la cancelación. Actualizá el pedido antes de reintentar.')
      }
      return data
    },
    async finalizarEntrega(id,anterior,version,metodo,cobrado) {
      await autorizar()
      const {data,error}=await client.rpc('finalizar_entrega_pedido',{p_pedido:id,p_negocio:negocioId,p_anterior:anterior,p_version_pago:version,p_metodo:metodo,p_cobrado:cobrado})
      if(error){
        if(error.code==='PT409')throw new Error('El pedido o su pago cambió. Revisá los datos actuales antes de continuar.')
        if(error.code==='42501')throw new Error('No tenés permiso para realizar esta operación.')
        throw new Error('No se pudo confirmar la entrega. Revisá el estado y el pago antes de reintentar.')
      }
      return data
    },
    async registrarPagoDividido(id,version,efectivo,transferencia) {
      await autorizar()
      const {data,error}=await client.rpc('registrar_pago_dividido',{p_pedido:id,p_negocio:negocioId,p_version:version,p_efectivo:efectivo,p_transferencia:transferencia})
      if(error)throw errorCobro(error)
      return data
    },
    async finalizarEntregaDividida(id,anterior,version,efectivo,transferencia) {
      await autorizar()
      const {data,error}=await client.rpc('finalizar_entrega_dividida',{p_pedido:id,p_negocio:negocioId,p_anterior:anterior,p_version_pago:version,p_efectivo:efectivo,p_transferencia:transferencia})
      if(error)throw errorCobro(error)
      return data
    },
    async registrarPago(id, version, metodo, pagado) {
      await autorizar()
      const {data,error}=await client.rpc('registrar_pago_pedido',{p_pedido:id,p_negocio:negocioId,p_version:version,p_metodo:metodo,p_pagado:pagado})
      if(error){
        if(error.code==='PT409')throw new Error('Otra persona actualizó el pago. Revisá los datos actuales antes de continuar.')
        if(error.code==='42501')throw new Error('Ya no tenés permiso para registrar pagos.')
        if(error.code==='22023')throw new Error('No se pudo registrar: revisá el método y si el pedido ya está pagado o cancelado.')
        throw new Error('No se pudo confirmar el registro del pago. Actualizá el pedido antes de reintentar.')
      }
      return data
    },
    suscribir(onCambio,onConexion) {
      let cerrado=false, canal=null
      const emitir=async payload=>{
        try {
          await autorizar()
          if(!cerrado) onCambio(payload)
        } catch { if(!cerrado){onConexion('SIN_ACCESO');onCambio({tipo:'SYNC'});cerrar()} }
      }
      function cerrar() { cerrado=true; if(canal)void client.removeChannel(canal).catch(()=>{}) }
      autorizar().then(()=>{
        if(cerrado)return
        canal=client.channel('pedidos-'+negocioId+'-'+crypto.randomUUID())
          .on('postgres_changes',{event:'*',schema:'public',table:'pedidos',filter:'emprendimiento_id=eq.'+negocioId},payload=>{
            if(['INSERT','UPDATE'].includes(payload.eventType) && String(payload.new.emprendimiento_id)===String(negocioId))
              void emitir({tipo:payload.eventType,id:payload.new.id})
          }).subscribe(estado=>{
            if(cerrado)return
            onConexion(estado)
            // Reconciliar al conectar/reconectar: Postgres Changes no reproduce eventos perdidos.
            if(estado==='SUBSCRIBED')void emitir({tipo:'SYNC'})
          })
      }).catch(()=>{if(!cerrado)onConexion('SIN_ACCESO')})
      return cerrar
    },
  }
}
