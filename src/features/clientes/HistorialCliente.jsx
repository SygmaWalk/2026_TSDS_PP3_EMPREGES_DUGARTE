import { useEffect, useMemo, useState } from 'react'
import { DetallePedido } from '../pedidos/PanelPedidos.jsx'
import { formatearCentavos } from '../carrito/carrito.js'
import { claseEstado } from '../pedidos/estadosPedido.js'
import { CLIENTES_POR_PAGINA } from './clientesRepository.js'

export default function HistorialCliente({ clienteId, repository }) {
  const [pagina, setPagina] = useState(0)
  const [version, setVersion] = useState(0)
  const [seleccionado, setSeleccionado] = useState(null)
  const [resultado, setResultado] = useState({ cargando: true, pedidos: [], total: 0, error: '' })
  const detalleRepository = useMemo(() => ({ detalle: id => repository.detallePedido(id, clienteId) }), [repository, clienteId])
  useEffect(() => {
    let vigente = true
    repository.historial(clienteId, pagina).then(r => {
      if (vigente) setResultado({ ...r, cargando: false, error: '' })
    }).catch(e => {
      if (vigente) setResultado({ cargando: false, pedidos: [], total: 0, error: e.message })
    })
    return () => { vigente = false }
  }, [repository, clienteId, pagina, version])
  function actualizar() {
    setResultado({ cargando: true, pedidos: [], total: 0, error: '' })
    setVersion(v => v + 1)
  }
  function cambiarPagina(p) {
    setResultado({ cargando: true, pedidos: [], total: 0, error: '' })
    setPagina(p)
  }
  return <section className="customer-history" aria-label="Historial de pedidos del cliente">
    <div className="section-heading"><div><h3>Historial de pedidos</h3><p>Más recientes primero. Cada pedido conserva los datos informados al comprar.</p></div>
      <button className="button button-secondary" onClick={actualizar}>Actualizar historial</button></div>
    {seleccionado !== null ? <DetallePedido key={seleccionado} id={seleccionado} version={version} repository={detalleRepository}
      puedeGestionar={false} puedeRegistrarPago={false} etiquetaVolver="← Volver al historial del cliente"
      onVolver={() => { setSeleccionado(null); actualizar() }} onReintentar={actualizar} onActualizar={actualizar} /> :
      resultado.cargando ? <p role="status">Cargando historial…</p> :
      resultado.error ? <p role="alert" className="error-feedback">{resultado.error}</p> : <>
        <p>{resultado.total} {resultado.total === 1 ? 'pedido registrado' : 'pedidos registrados'}</p>
        {!resultado.pedidos.length ? <p>Este cliente todavía no tiene pedidos asociados.</p> :
          <ul className="customers-list">{resultado.pedidos.map(p => <li className="customer-order" key={p.id}>
            <div><strong>Pedido #{p.id}</strong><time dateTime={p.fecha_creacion}>{new Date(p.fecha_creacion).toLocaleString('es-AR')}</time>
              <span>{p.nombre_contacto} · {p.telefono_contacto}</span></div>
            <div><span className={'order-status status-' + claseEstado(p.estado)}>{p.estado}</span>
              <strong>{formatearCentavos(Math.round(Number(p.total ?? p.subtotal) * 100))}</strong><small>Pago: {p.estado_pago}</small></div>
            <button className="button button-secondary" onClick={() => setSeleccionado(p.id)} aria-label={'Ver pedido #' + p.id}>Ver detalle ↗</button>
          </li>)}</ul>}
        <nav className="orders-pagination" aria-label="Páginas del historial">
          <button className="button button-secondary" disabled={pagina === 0} onClick={() => cambiarPagina(pagina - 1)}>Anteriores</button>
          <span>Página {pagina + 1}</span>
          <button className="button button-secondary" disabled={(pagina + 1) * CLIENTES_POR_PAGINA >= resultado.total} onClick={() => cambiarPagina(pagina + 1)}>Más pedidos</button>
        </nav>
      </>}
  </section>
}
