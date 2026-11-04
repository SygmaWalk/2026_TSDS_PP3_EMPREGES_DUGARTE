import { useEffect, useState } from 'react'
import { Marca } from '../acceso/InterfazAcceso.jsx'

export default function Inicio({ client, usuario }) {
  useEffect(() => {
    if (window.location.hash === '#/emprendimientos') document.getElementById('explorar')?.scrollIntoView()
  }, [])
  const [busqueda, setBusqueda] = useState('')
  const [consulta, setConsulta] = useState('')
  const [pagina, setPagina] = useState(0)
  const [intento, setIntento] = useState(0)
  const [estado, setEstado] = useState({ tiendas: [], total: 0, cargando: true, error: '' })
  useEffect(() => {
    let vigente = true
    async function cargar() {
      setEstado(s => ({ ...s, cargando: true, error: '' }))
      try {
        if (!client) throw new Error()
        let q = client.from('emprendimientos').select('id,nombre,slug', { count: 'exact' }).eq('activo', true)
        if (consulta) q = q.ilike('nombre', '%' + consulta.replace(/[\\%_]/g, '\\$&') + '%')
        const { data, count, error } = await q.order('nombre').order('id').range(pagina * 9, pagina * 9 + 8)
        if (error) throw error
        if (vigente) setEstado({ tiendas: data, total: count, cargando: false, error: '' })
      } catch {
        if (vigente) setEstado({ tiendas: [], total: 0, cargando: false, error: 'No pudimos cargar los emprendimientos. Intentá nuevamente.' })
      }
    }
    cargar()
    return () => { vigente = false }
  }, [client, consulta, pagina, intento])
  return <main className="discovery-page">
    <header className="dashboard-topbar"><a className="store-brand" href="#/"><Marca /></a><nav className="public-links" aria-label="Navegación principal"><a href="#/emprendimientos">Explorar tiendas</a><a className="button button-primary" href={usuario ? '#/cuenta' : '#/ingresar'}>{usuario ? 'Mi cuenta' : 'Ingresar'} <span aria-hidden="true">↗</span></a></nav></header>
    <section className="discovery-hero">
      <div><span className="eyebrow">CERCA DE TUS IDEAS. CERCA DE VOS.</span><h1>Detrás de cada compra,<br />un <em>emprendimiento.</em></h1><p>Descubrí sus productos, armá tu carrito y hacé tu pedido directamente a cada tienda.</p><a className="button button-primary" href="#/emprendimientos" onClick={() => document.getElementById('explorar')?.scrollIntoView({ behavior: 'smooth' })}>Encontrar una tienda <span aria-hidden="true">↓</span></a><span className="hero-note">Explorá libremente. Iniciá sesión para confirmar tu pedido.</span></div>
      <div className="market-art" aria-hidden="true"><div className="market-orbit" /><span className="art-label">Pequeños negocios.<br />Grandes ideas.</span><div className="market-shop"><div className="market-awning" /><span className="market-sign">Hecho con ganas.</span><div className="market-window"><span>eg.</span></div><div className="market-door" /></div><span className="art-stamp">COMPRÁ<br />EMPRENDEDOR</span></div>
    </section>
    <section className="discovery-directory" id="explorar" aria-labelledby="explorar-title">
      <div className="directory-heading"><div><span className="eyebrow">ENCONTRÁ TU PRÓXIMA TIENDA</span><h2 id="explorar-title">Explorá emprendimientos</h2></div><form className="directory-search" onSubmit={e => { e.preventDefault(); setPagina(0); setConsulta(busqueda.trim()) }}><label className="sr-only" htmlFor="buscar-tiendas">Buscar emprendimientos</label><input id="buscar-tiendas" type="search" placeholder="Buscar por nombre…" maxLength={100} value={busqueda} onChange={e => setBusqueda(e.target.value)} /><button className="button button-primary" type="submit">Buscar</button></form></div>
      {estado.cargando ? <p role="status" className="directory-state">Buscando tiendas…</p> : estado.error ? <div className="directory-state"><p role="alert">{estado.error}</p><button className="button" onClick={() => setIntento(v => v + 1)}>Reintentar</button></div> : <>
        <p className="directory-count" role="status">{estado.total} {estado.total === 1 ? 'emprendimiento disponible' : 'emprendimientos disponibles'}{consulta ? ' para “' + consulta + '”' : ''}</p>
        {!estado.tiendas.length ? <div className="directory-state"><h3>{consulta ? 'No encontramos coincidencias' : 'Las próximas tiendas empiezan acá'}</h3><p>{consulta ? 'Probá con otro nombre.' : 'Cuando un emprendimiento esté activo, podrás encontrarlo en este espacio.'}</p>{consulta && <button className="button" onClick={() => { setBusqueda(''); setConsulta(''); setPagina(0) }}>Ver todas las tiendas</button>}</div> : <div className="shop-grid">{estado.tiendas.map((n) => <a className={'shop-card shop-color-' + (n.id % 3)} href={'#/tienda/' + n.slug} key={n.id}><div className="shop-cover" aria-hidden="true"><span className="shop-cover-initial">{n.nombre.slice(0, 1).toUpperCase()}</span><span className="shop-cover-line" /></div><div className="shop-card-body"><span className="eyebrow">TIENDA ONLINE</span><h3>{n.nombre}</h3><span className="shop-card-cta">Conocer sus productos <span aria-hidden="true">↗</span></span></div></a>)}</div>}
        {estado.total > 9 && <nav className="orders-pagination" aria-label="Páginas de emprendimientos"><button className="button" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina + 1} de {Math.ceil(estado.total / 9)}</span><button className="button" disabled={(pagina + 1) * 9 >= estado.total} onClick={() => setPagina(p => p + 1)}>Siguiente</button></nav>}
      </>}
    </section>
    <section className="discovery-steps"><div><span>01</span><h3>Descubrí</h3><p>Entrá a la tienda que te interese y conocé su catálogo.</p></div><div><span>02</span><h3>Elegí</h3><p>Sumá tus productos y revisá tu carrito antes de confirmar.</p></div><div><span>03</span><h3>Coordiná</h3><p>Dejá un contacto y elegí retiro o envío según la tienda.</p></div></section>
    <footer className="discovery-footer"><Marca /><p>Un espacio para conectar con quienes emprenden.</p><a href={usuario ? '#/cuenta' : '#/ingresar'}>Acceder a mi espacio ↗</a></footer>
  </main>
}
