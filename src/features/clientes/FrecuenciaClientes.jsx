import { useEffect, useState } from 'react'
import { formatearCentavos } from '../carrito/carrito.js'

export default function FrecuenciaClientes({ repository, onFicha }) {
  const [filtros, setFiltros] = useState({ minimo: 3, desde: '', hasta: '', orden: 'pedidos' })
  const [consulta, setConsulta] = useState({ ...filtros, pagina: 0 })
  const [resultado, setResultado] = useState({ cargando: true, clientes: [], total: 0 })
  const [error, setError] = useState('')
  useEffect(() => {
    let vigente = true
    repository.frecuencia(consulta).then(r => {
      if (vigente) setResultado({ ...r, cargando: false })
    }).catch(e => {
      if (vigente) setResultado({ cargando: false, clientes: [], total: 0, error: e.message })
    })
    return () => { vigente = false }
  }, [repository, consulta])
  function consultar(nueva) {
    setResultado({ cargando: true, clientes: [], total: 0 })
    setConsulta(nueva)
  }
  function aplicar(e) {
    e.preventDefault()
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError('La fecha de inicio debe ser anterior o igual a la fecha final.')
      return
    }
    setError('')
    consultar({ ...filtros, minimo: Number(filtros.minimo), pagina: 0 })
  }
  return <section className="panel">
    <h2>Clientes frecuentes y gasto acumulado</h2>
    <p>Contamos todos los pedidos no cancelados. El importe incluye el envío y no equivale a dinero cobrado. Las fechas se interpretan en horario de Argentina.</p>
    <form className="product-form" onSubmit={aplicar}>
      <label>Mínimo de pedidos para ser frecuente<input type="number" min="1" max="100000" required value={filtros.minimo} onChange={e => setFiltros({ ...filtros, minimo: e.target.value })}/></label>
      <label>Desde<input type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })}/></label>
      <label>Hasta<input type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })}/></label>
      <label>Ordenar por<select value={filtros.orden} onChange={e => setFiltros({ ...filtros, orden: e.target.value })}><option value="pedidos">Cantidad de pedidos</option><option value="importe">Importe acumulado</option></select></label>
      <button className="button button-primary">Consultar frecuencia</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {resultado.cargando ? <p role="status">Consultando frecuencia…</p> : resultado.error ? <p role="alert">{resultado.error}</p> : <>
      <p>Frecuente: desde {consulta.minimo} pedidos en el período consultado.</p>
      {!resultado.clientes.length ? <p>No hay clientes registrados para analizar.</p> : <ul className="customers-list">{resultado.clientes.map(c => <li className="customer-card" key={c.id}>
        <h3>{c.nombre}</h3>{c.frecuente && <strong>Cliente frecuente</strong>}
        <p>{c.pedidos} pedidos · {formatearCentavos(Math.round(Number(c.importe) * 100))} acumulados</p>
        <button className="button" onClick={() => onFicha(c.id)}>Ver ficha e historial de {c.nombre}</button>
      </li>)}</ul>}
      <nav aria-label="Páginas de frecuencia"><button className="button" disabled={consulta.pagina === 0} onClick={() => consultar({ ...consulta, pagina: consulta.pagina - 1 })}>Anterior</button><span>Página {consulta.pagina + 1}</span><button className="button" disabled={(consulta.pagina + 1) * 25 >= resultado.total} onClick={() => consultar({ ...consulta, pagina: consulta.pagina + 1 })}>Siguiente</button></nav>
    </>}
  </section>
}
