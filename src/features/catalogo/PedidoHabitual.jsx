import { useEffect, useRef, useState } from 'react'
import { formatearCentavos } from '../carrito/carrito.js'

export default function PedidoHabitual({ client, negocioId, onAgregar, cargarProductos }) {
  const [resultado, setResultado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const activo=useRef(true),enProceso=useRef(false),acciones=useRef({onAgregar,cargarProductos})
  useEffect(()=>{acciones.current={onAgregar,cargarProductos}},[onAgregar,cargarProductos])
  useEffect(()=>{activo.current=true;return()=>{activo.current=false}},[])
  async function consultar(agregar = false) {
    if(enProceso.current)return
    enProceso.current=true
    setOcupado(true); setError('')
    try {
      const r = await client.rpc('mi_pedido_habitual', { p_negocio: negocioId })
      if (r.error) throw Error(r.error.code === '42501' ? 'Esta recomendación requiere una cuenta Cliente habilitada.' : 'No pudimos consultar tus compras. Intentá nuevamente.')
      if(!activo.current)return
      setResultado(r.data)
      if (agregar) {
        if (!r.data.items.some(i => i.disponible)) throw Error('No hay productos habituales disponibles. Podés elegir otros del catálogo.')
        const productos=acciones.current.cargarProductos?await acciones.current.cargarProductos():undefined
        if(!activo.current)return
        if(productos)await acciones.current.onAgregar(r.data.items,productos)
        else await acciones.current.onAgregar(r.data.items)
      }
    } catch (e) { if(activo.current)setError(e.message) }
    finally { enProceso.current=false;if(activo.current)setOcupado(false) }
  }
  return <section className="panel" aria-label="Recomendación personal">
    <h2>¿Repetimos tus favoritos?</h2>
    <p>Podemos sugerirte productos según tus últimas compras en esta tienda.</p>
    <button className="button" disabled={ocupado} onClick={() => consultar()}>{ocupado ? 'Consultando…' : 'Ver mi pedido habitual'}</button>
    {error && <p role="alert">{error}</p>}
    {resultado && <>
      {resultado.pedidos < resultado.minimo ? <p>Necesitamos al menos {resultado.minimo} pedidos no cancelados de tu cuenta en esta tienda. Por ahora tenés {resultado.pedidos}.</p> : !resultado.items.length ? <p>Tus compras todavía no muestran productos habituales. Explorá el catálogo para elegir.</p> : <>
        <p>Productos presentes en más de la mitad de tus últimos {resultado.pedidos} pedidos válidos (hasta 20). Usamos la cantidad más repetida; en un empate, la más reciente.</p>
        <ul>{resultado.items.map(i => <li key={i.id}><strong>{i.nombre}</strong> · {i.cantidad} unidades · elegido en {i.veces} pedidos. {i.disponible ? formatearCentavos(i.precioCentavos) + ' por unidad hoy' : 'No disponible en la cantidad sugerida; no se agregará.'}</li>)}</ul>
        <p>Los precios son actuales. Revisá los adicionales en el carrito: no repetimos automáticamente los de compras anteriores.</p>
        <button className="button button-primary" disabled={ocupado || !resultado.items.some(i => i.disponible)} onClick={() => consultar(true)}>Agregar sugerencia al carrito</button>
      </>}
      <button className="button button-secondary" disabled={ocupado} onClick={() => setResultado(null)}>Ignorar sugerencia</button>
    </>}
  </section>
}
