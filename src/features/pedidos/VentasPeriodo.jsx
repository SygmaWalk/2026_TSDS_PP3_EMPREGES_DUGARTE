import { useId, useState } from 'react'
import { formatearCentavos } from '../carrito/carrito.js'

const pesos = n => formatearCentavos(Math.round(n * 100))
const fechaArgentina = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })

export default function VentasPeriodo({ consultar }) {
  const hoy = fechaArgentina.format(new Date())
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoy)
  const [resultado, setResultado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [medida, setMedida] = useState('ventas')
  const titulo = useId()

  async function buscar(evento) {
    evento.preventDefault()
    setError('')
    setResultado(null)
    setOcupado(true)
    try {
      const { dias, productos, zonas } = await consultar(desde, hasta)
      setResultado({ dias, productos, zonas, desde, hasta })
    } catch {
      setError('No se pudo consultar el período. Revisá las fechas y volvé a intentar.')
    } finally {
      setOcupado(false)
    }
  }

  const dias = resultado?.dias ?? []
  const maximo = dias.reduce((max, dia) => Math.max(max, dia[medida]), 0)
  return <details className="orders-advanced sales-report">
    <summary>Ventas y pedidos por período</summary>
    <form className="panel orders-filters" onSubmit={buscar}>
      <label>Desde (informe)<input required type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} /></label>
      <label>Hasta (informe)<input required type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} /></label>
      <button className="button button-primary" disabled={ocupado}>{ocupado ? 'Consultando…' : 'Consultar período'}</button>
    </form>
    <p>Se cuentan los pedidos recibidos por fecha de creación, en horario argentino. El importe suma los pedidos pagados de esos días, con envío incluido. Los cancelados aportan $0.</p>
    {error && <p role="alert">{error}</p>}
    {resultado && <section aria-labelledby={titulo}>
      <h3 id={titulo}>Del {resultado.desde} al {resultado.hasta}</h3>
      <div className="report-totals"><strong>{dias.reduce((n, d) => n + d.pedidos, 0)} pedidos recibidos</strong><span>Ventas cobradas <strong>{pesos(dias.reduce((n, d) => n + Number(d.ventas), 0))}</strong></span></div>
      {dias.length === 0 ? <p>Sin pedidos en este período.</p> : <>
        <label>Gráfico por día <select value={medida} onChange={e => setMedida(e.target.value)}>
          <option value="ventas">Ventas cobradas</option><option value="pedidos">Pedidos recibidos</option>
        </select></label>
        <ul className="sales-period-chart" aria-label="Días con pedidos">{dias.map(d => <li key={d.dia}>
          <time dateTime={d.dia}>{d.dia.split('-').reverse().join('/')}</time>
          <span className="sales-period-bar" aria-hidden="true"><span style={{ width: (maximo ? 100 * d[medida] / maximo : 0) + '%' }} /></span>
          <strong>{medida === 'ventas' ? pesos(d.ventas) : d.pedidos}</strong>
        </li>)}</ul>
      </>}
      <h4>Productos más vendidos</h4>
      {resultado.productos.length === 0 ? <p>Sin unidades vendidas en este período.</p> : <>
        <p>Unidades de pedidos pagados. Cada combo cuenta como producto.</p>
        <ol className="sales-period-chart product-ranking" aria-label="Productos por unidades vendidas">
          {resultado.productos.map(p => <li key={p.producto_id}>
            <span>{p.nombre}</span>
            <span className="sales-period-bar" aria-hidden="true"><span style={{ width: (100 * p.unidades / resultado.productos[0].unidades) + '%' }} /></span>
            <strong>{p.unidades} {p.unidades === 1 ? 'unidad' : 'unidades'}</strong>
          </li>)}
        </ol>
      </>}
      <h4>Ventas por zona</h4>
      <p>Importes de todos los pedidos sin cancelar, incluidos los pendientes de cobro. La zona corresponde a la entrega guardada en cada pedido.</p>
      {resultado.zonas.length === 0 ? <p>Sin zonas configuradas ni pedidos en este período.</p> :
        <div className="zone-report"><table aria-label="Ventas por zona">
          <thead><tr>{['Zona', 'Pedidos', 'Productos', 'Envío', 'Total'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead>
          <tbody>{resultado.zonas.map(z => <tr key={JSON.stringify([z.tipo,z.nombre,z.limites])}>
            <th scope="row">{z.nombre}
              {z.tipo === 'radio' && z.limites?.every(n => n != null) && <small>{z.limites.join(' a ')} m</small>}
              {z.tipo === 'zona' && z.limites && resultado.zonas.some(otra => otra !== z && otra.nombre === z.nombre) &&
                <small>{z.limites.sur}, {z.limites.oeste} – {z.limites.norte}, {z.limites.este}</small>}
            </th><td>{z.pedidos}</td><td>{pesos(z.productos)}</td><td>{pesos(z.envio)}</td><td>{pesos(z.total)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>}
  </details>
}
