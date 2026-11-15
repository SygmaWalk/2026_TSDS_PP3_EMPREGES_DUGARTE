import { useEffect, useState } from 'react'
import { formatearCentavos } from '../carrito/carrito.js'

const formatoDia = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })
const diaCorto = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
const moneda = pesos => formatearCentavos(Math.round(100 * Number(pesos)))

function ultimaSemana() {
  const hoy = new Date(formatoDia.format(Date.now()) + 'T12:00:00Z')
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(hoy)
    fecha.setUTCDate(hoy.getUTCDate() - 6 + i)
    return { dia: formatoDia.format(fecha), etiqueta: diaCorto.format(fecha) }
  })
}

export default function ResumenNegocio({ client, negocio, onAbrir }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    const actualizar = () => setIntento(i => i + 1)
    async function cargar() {
      const semana = ultimaSemana()
      const contar = estado => client.from('pedidos').select('id', {head:true,count:'exact'})
        .eq('emprendimiento_id', negocio.id).eq('estado', estado)
      try {
        const [pendientes, preparando, ventas] = await Promise.all([
          contar('Pendiente'), contar('En preparación'), client.rpc('ventas_por_periodo', {
            p_negocio: negocio.id, p_desde: semana[0].dia, p_hasta: semana[6].dia,
          }),
        ])
        if (pendientes.error || preparando.error || ventas.error) throw Error()
        const dias = semana.map(d => ({ ...d, ventas: Number(ventas.data.find(f => f.dia === d.dia)?.ventas ?? 0) }))
        if (vigente) {
          setDatos({ pendientes: pendientes.count, preparando: preparando.count, dias })
          setError(false)
        }
      } catch { if (vigente) setError(true) }
    }
    cargar()
    window.addEventListener('empreges:pedidos', actualizar)
    window.addEventListener('focus', actualizar)
    return () => { vigente = false; window.removeEventListener('empreges:pedidos', actualizar); window.removeEventListener('focus', actualizar) }
  }, [client, negocio.id, intento])
  const max = Math.max(1, ...(datos?.dias ?? []).map(d => d.ventas))
  return <main className="merchant-overview">
    <header className="merchant-heading"><div><h1>Resumen del negocio</h1>
      {datos && <p>{new Intl.DateTimeFormat('es-AR', {dateStyle:'full', timeZone:'UTC'}).format(new Date(datos.dias[6].dia + 'T12:00:00Z'))}</p>}</div>
      <button className="button button-secondary" onClick={() => setIntento(i => i + 1)}>Actualizar resumen</button>
    </header>
    {error ? <p role="alert">No se pudo cargar la actividad. Usá Actualizar resumen para reintentar.</p> :
      !datos ? <p role="status">Cargando actividad…</p> : <div className="merchant-grid">
        <section className="merchant-queue"><h2>Pedidos pendientes</h2><strong>{datos.pendientes}</strong>
          <p>{datos.preparando} en preparación</p>
          <button className="button" onClick={() => onAbrir('pedidos')}>Abrir pedidos →</button>
        </section>
        <section className="merchant-sales"><h2>Ventas de los últimos 7 días</h2>
          <strong>{moneda(datos.dias.reduce((n,d) => n + d.ventas, 0))}</strong>
          <p>Pedidos cobrados por fecha de creación</p>
          <ol className="merchant-chart">{datos.dias.map(d => <li key={d.dia}>
            <time dateTime={d.dia}>{d.etiqueta} {Number(d.dia.slice(-2))}</time>
            <span aria-hidden="true"><i style={{width: (100*d.ventas/max)+'%'}} /></span>
            <small>{moneda(d.ventas)}</small>
          </li>)}</ol>
        </section>
      </div>}
  </main>
}
