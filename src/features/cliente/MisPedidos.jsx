import { useEffect, useState } from 'react'
import { formatearCentavos } from '../carrito/carrito.js'

const importe = pesos => formatearCentavos(Math.round(Number(pesos) * 100))

function ListaPedidos({ client }) {
  const [pedidos, setPedidos] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const { data, error } = await client.rpc('mis_pedidos', {
          p_fecha: cursor?.fecha ?? null, p_id: cursor?.id ?? null,
        })
        if (error) throw error
        if (vigente) {
          const pagina = data.slice(0, 20)
          setPedidos(anteriores => cursor ? [...anteriores, ...pagina] : pagina)
          setHayMas(data.length > 20)
        }
      } catch {
        if (vigente) setError(true)
      } finally {
        if (vigente) setCargando(false)
      }
    }
    cargar()
    return () => { vigente = false }
  }, [client, cursor, intento])

  return <>
    {pedidos.map(p => <details className="order-history" key={p.id}>
      <summary>Pedido #{p.id} · {p.tienda} · {new Date(p.fecha).toLocaleDateString('es-AR')} · {p.estado} · {importe(p.total)}</summary>
      <ul className="order-lines">{p.productos.map((linea, i) => <li key={i}>
        <span>{linea.cantidad} × {linea.nombre}
          {linea.adicionales?.length > 0 && <small>{linea.adicionales.map(a => a.nombre).join(', ')}</small>}
          {linea.promocion && <small>{linea.promocion.nombre}</small>}
        </span>
        <strong>{importe(linea.precio * linea.cantidad)}</strong>
      </li>)}</ul>
      <p>Subtotal {importe(p.subtotal)} · Envío {importe(p.envio)} · Total {importe(p.total)}</p>
      <p>Pago · {p.estado_pago}</p>
    </details>)}
    {cargando ? <p role="status">Cargando pedidos…</p> : error ? <>
      <p role="alert">No se pudieron cargar tus pedidos.</p>
      <button className="button" onClick={() => { setError(false); setCargando(true); setIntento(i => i + 1) }}>Reintentar</button>
    </> : pedidos.length === 0 ? <p>Todavía no tenés pedidos asociados a tu cuenta.</p>
      : hayMas && <button className="button" onClick={() => { setCargando(true); setCursor(pedidos.at(-1)) }}>Ver pedidos anteriores</button>}
  </>
}

export default function MisPedidos({ client }) {
  const [abierto, setAbierto] = useState(false)
  return <section className="access-state">
    <h2>Mis pedidos</h2>
    <button className="button button-secondary" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
      {abierto ? 'Ocultar historial' : 'Ver mis pedidos'}
    </button>
    {abierto && <ListaPedidos client={client} />}
  </section>
}
