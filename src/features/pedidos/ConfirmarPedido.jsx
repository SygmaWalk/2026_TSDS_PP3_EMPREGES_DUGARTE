import EntregaPedido from '../entregas/EntregaPedido.jsx'
import ResumenEntrega from '../entregas/ResumenEntrega.jsx'
import { useRef, useState } from 'react'
import { calcularSubtotalCentavos, formatearCentavos } from '../carrito/carrito.js'
import { confirmarPedido, validarContacto, leerConfirmacion, guardarConfirmacion } from './pedidosRepository.js'

export default function ConfirmarPedido({ client, negocio, items, clave, perfil, onConfirmado, onVolver }) {
  const [registro, setRegistro] = useState(() => leerConfirmacion(clave))
  const [nombre, setNombre] = useState(() => registro?.intento?.p_contacto.nombre ?? perfil?.nombre ?? '')
  const [telefono, setTelefono] = useState(() => registro?.intento?.p_contacto.telefono ?? perfil?.telefono ?? '')
  const [metodoPago,setMetodoPago]=useState(()=>registro?.intento?.p_contacto.metodo_pago??'')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [entrega,setEntrega] = useState(()=>{const e=registro?.intento?.p_contacto.entrega;return {modalidad:e?.modalidad??'retiro',direccion:e?.direccion??perfil?.direccion??'',referencia:e?.referencia??'',punto:e?.modalidad==='envio'?{latitud:e.latitud,longitud:e.longitud}:null,cotizacion:null}})
  const enviando = useRef(false)
  const recibo = registro?.estado === 'confirmado' ? registro.recibo : null
  const intento = registro?.estado === 'pendiente' ? registro.intento : null
  const resumen = intento ? (registro.resumen ?? intento.p_items) : items.map(i => ({ producto_id:i.id, nombre:i.nombre, cantidad:i.cantidad, precio_centavos:i.precioCentavos }))
  async function enviar(event) {
    event.preventDefault()
    if (enviando.current || !client) return
    enviando.current = true; setOcupado(true); setError('')
    try {
      let solicitud = intento
      if (!solicitud) {
        if (!items.length) throw Object.assign(new Error('Agregá productos al carrito antes de confirmar.'), { definitivo:true })
        const contacto = validarContacto(nombre,telefono)
        if(!['Efectivo','Transferencia'].includes(metodoPago))throw Object.assign(new Error('Elegí efectivo o transferencia.'),{definitivo:true})
        contacto.metodo_pago=metodoPago
        if(entrega.modalidad==='envio' && !entrega.cotizacion) throw Object.assign(new Error('Calculá el envío y revisá el total antes de confirmar.'),{definitivo:true})
        contacto.entrega = entrega.modalidad==='retiro' ? {modalidad:'retiro'} : {modalidad:'envio',direccion:entrega.direccion.trim(),referencia:entrega.referencia.trim(),...entrega.punto,costo_centavos:entrega.cotizacion.costo_centavos,version:entrega.cotizacion.version}
        solicitud = { p_clave:crypto.randomUUID(), p_negocio:negocio.id, p_contacto:contacto,
          p_items:items.map(i => ({producto_id:i.id,cantidad:i.cantidad,precio_centavos:i.precioCentavos})) }
        const pendiente = { estado:'pendiente', intento:solicitud, negocio, resumen }
        guardarConfirmacion(clave,pendiente)
        setRegistro(pendiente)
      }
      const resultado = await confirmarPedido(client,solicitud)
      const confirmado = { estado:'confirmado', recibo:resultado, negocio }
      // Conservar el recibo antes de vaciar el carrito: una recarga no reenvía el pedido.
      try { guardarConfirmacion(clave,confirmado) }
      catch { setError('El pedido se registró, pero no se pudo conservar el comprobante en este navegador. Guardá su número.') }
      setRegistro(confirmado)
      const aviso = onConfirmado()
      if (!aviso) {
        try { guardarConfirmacion(clave, { ...confirmado, carritoVaciado:true }) }
        catch { /* El comprobante anterior permite recuperar el mismo pedido. */ }
      }
    } catch (fallo) {
      setError(fallo.message)
      if (fallo.definitivo) {
        setEntrega(v=>({...v,cotizacion:null}))
        try { sessionStorage.removeItem(clave); setRegistro(null) }
        catch { /* Se mantiene el intento para no generar una segunda solicitud. */ }
      }
    } finally { enviando.current = false; setOcupado(false) }
  }
  function volver() {
    try { sessionStorage.removeItem(clave); onVolver(recibo ? 'catalogo' : 'carrito') }
    catch { setError('No se pudo actualizar el almacenamiento del navegador.') }
  }
  if (recibo) return <section className="panel checkout-panel" aria-labelledby="pedido-registrado">
    <span className="eyebrow">PEDIDO RECIBIDO</span><h2 id="pedido-registrado" tabIndex={-1}>Tu pedido quedó registrado</h2>
    <p className="order-number">Pedido #{recibo.id}</p><span className="order-status">{recibo.estado}</span>
    <p>El emprendimiento tiene tus datos de contacto para coordinar el pedido. Todavía no fue aceptado ni pagado.</p>
    <p>Método elegido: <strong>{recibo.metodo_pago_previsto||'Sin registrar'}</strong></p>
    <p>Fecha: <time dateTime={recibo.fecha}>{new Date(recibo.fecha).toLocaleString('es-AR')}</time></p>
    <ul className="order-lines">{recibo.items.map(i => <li key={i.producto_id}><span>{i.cantidad} × {i.nombre}</span><strong>{formatearCentavos(i.precio_centavos*i.cantidad)}</strong></li>)}</ul>
    <div className="cart-summary"><span>Subtotal registrado</span><strong>{formatearCentavos(recibo.subtotal_centavos)}</strong></div>
    <ResumenEntrega entrega={recibo.entrega} costo={recibo.costo_envio_centavos} total={recibo.total_centavos??recibo.subtotal_centavos}/><p className="field-help">Guardá el número del pedido. No se realizó ningún cobro; el pago se coordina con el emprendimiento.</p>
    {error && <p role="alert" className="error-feedback">{error}</p>}
    <button className="button button-primary" onClick={volver}>Volver a la tienda</button>
  </section>
  return <section className="panel checkout-panel" aria-labelledby="checkout-title">
    <span className="eyebrow">UN ÚLTIMO PASO</span><h2 id="checkout-title">Confirmar tu pedido</h2>
    <p>Revisá tu selección y dejá un contacto para {negocio.nombre}.</p>
    <ul className="order-lines">{resumen.map(i => <li key={i.producto_id}><span>{i.cantidad} × {i.nombre ?? items.find(x => x.id===i.producto_id)?.nombre ?? 'Producto #' + i.producto_id}</span><strong>{formatearCentavos(i.precio_centavos*i.cantidad)}</strong></li>)}</ul>
    <div className="cart-summary"><span>Subtotal</span><strong>{formatearCentavos(intento ? resumen.reduce((s,i)=>s+i.precio_centavos*i.cantidad,0) : calcularSubtotalCentavos(items))}</strong></div>
    <p className="field-help">No se realiza ningún cobro. El pago se coordina con el emprendimiento.</p>
    {intento && <p role="status">Hay una confirmación pendiente de respuesta. Reintentá con estos mismos datos para conocer el resultado.</p>}
    {error && <p role="alert" className="error-feedback">{error}</p>}
    <form className="product-form" onSubmit={enviar}>
      <fieldset className="form-fields" disabled={ocupado || Boolean(intento) || !client}>
        <div className="field-group"><label htmlFor="pedido-nombre">Nombre de contacto</label><input id="pedido-nombre" value={nombre} onChange={e=>setNombre(e.target.value)} autoComplete="name" required minLength={2} maxLength={100}/></div>
        <div className="field-group"><label htmlFor="pedido-telefono">Teléfono de contacto</label><input id="pedido-telefono" value={telefono} onChange={e=>setTelefono(e.target.value)} type="tel" autoComplete="tel" required maxLength={30}/><small>Incluí el código de área. Entre 7 y 15 dígitos.</small></div>
<div className="field-group"><label htmlFor="pedido-metodo">¿Cómo pensás pagar?</label><select id="pedido-metodo" required value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}><option value="">Seleccionar método</option><option>Efectivo</option><option>Transferencia</option></select><small>Si cambiás de método, avisale al emprendimiento. Elegirlo no registra un pago.</small></div>
        {!intento && <EntregaPedido client={client} negocio={negocio} valor={entrega} onChange={setEntrega} disabled={ocupado || !client} subtotal={calcularSubtotalCentavos(items)}/>}
      </fieldset>
      {intento && <ResumenEntrega entrega={intento.p_contacto.entrega} costo={intento.p_contacto.entrega?.costo_centavos??0} total={resumen.reduce((s,i)=>s+i.precio_centavos*i.cantidad,0)+(intento.p_contacto.entrega?.costo_centavos??0)}/>}
      <button className="button button-primary" type="submit" disabled={ocupado || !client || (!intento && (!items.length || (entrega.modalidad==='envio'&&!entrega.cotizacion)))}>{ocupado ? 'Registrando pedido…' : intento ? 'Reintentar confirmación' : 'Confirmar pedido'}</button>
    </form>
    {!intento && <button className="button button-secondary" disabled={ocupado} onClick={volver}>Volver al carrito</button>}
  </section>
}
