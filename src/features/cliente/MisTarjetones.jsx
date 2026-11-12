import { useEffect, useState } from 'react'

function Tarjeton({ tarjeta, client }) {
  const [imagen, setImagen] = useState(null)
  useEffect(() => {
    if (!tarjeta.imagen) return
    let vigente = true
    let url
    async function cargar() {
      const { data, error } = await client.storage.from('tiendas').download(tarjeta.imagen)
      if (vigente && !error) {
        url = URL.createObjectURL(data)
        setImagen(url)
      }
    }
    cargar().catch(() => {})
    return () => { vigente = false; if (url) URL.revokeObjectURL(url) }
  }, [client, tarjeta.imagen])
  const sellos = tarjeta.compras ? ((tarjeta.compras - 1) % 10) + 1 : 0
  return <article className="stamp-card">
    <h3>{tarjeta.nombre}</h3>
    <p>{sellos} de 10 sellos{!tarjeta.activo && ' · Programa pausado'}</p>
    <div className="stamp-grid" aria-hidden="true">{Array.from({ length: 10 }, (_, i) =>
      <span key={i} className={i < sellos ? 'stamp filled' : 'stamp'}>
        {i < sellos ? imagen ? <img src={imagen} alt="" onError={() => setImagen(null)} /> : tarjeta.nombre.slice(0, 1) : i + 1}
      </span>)}</div>
    <p>{tarjeta.terminos}</p>
    {tarjeta.beneficios.map(b => <details key={b.codigo}>
      <summary>{b.canjeado ? 'Beneficio canjeado' : 'Beneficio disponible'}</summary>
      <p>{b.terminos}</p>
      {!b.canjeado && <p>Presentá este código en el local <code>{b.codigo}</code></p>}
    </details>)}
  </article>
}

export default function MisTarjetones({ client }) {
  const [tarjetas, setTarjetas] = useState(null)
  const [error, setError] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!abierto) return
    let vigente = true
    async function cargar() {
      try {
        const { data, error } = await client.rpc('mis_tarjetones')
        if (error) throw error
        if (vigente) setTarjetas(data)
      } catch { if (vigente) setError(true) }
    }
    cargar()
    return () => { vigente = false }
  }, [client, abierto, intento])
  return <section className="access-state"><h2>Mis beneficios</h2>
    <button className="button" aria-expanded={abierto} onClick={() => {
      setTarjetas(null); setError(false); setAbierto(!abierto)
    }}>{abierto ? 'Cerrar tarjetones' : 'Ver mis tarjetones'}</button>
    {abierto && (error ? <><p role="alert">No se pudieron cargar tus tarjetones.</p><button className="button" onClick={() => { setError(false); setIntento(i => i+1) }}>Reintentar</button></> :
      !tarjetas ? <p role="status">Cargando tarjetones…</p> : tarjetas.length === 0 ? <p>Todavía no hay tarjetones disponibles.</p> :
        tarjetas.map(t => <Tarjeton key={t.id + ':' + t.imagen} tarjeta={t} client={client} />))}
  </section>
}
