import { useEffect, useState } from 'react'
import { Marca } from './InterfazAcceso.jsx'

export default function ResumenNegocio({ client, negocio, onVolver, onAbrir }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const puedeProductos = negocio.permisos.includes('productos.ver')
  const puedePedidos = negocio.permisos.includes('pedidos.ver')
  useEffect(() => {
    let vigente = true
    async function cargar() {
      setDatos(null); setError('')
      try {
        const contar = async (tabla, columna, valor) => {
          let q = client.from(tabla).select('id', { count: 'exact', head: true }).eq('emprendimiento_id', negocio.id)
          if (columna) q = q.eq(columna, valor)
          const r = await q
          if (r.error) throw r.error
          return r.count
        }
        const [productos, visibles, pedidos, pendientes] = await Promise.all([
          puedeProductos ? contar('productos') : null, puedeProductos ? contar('productos', 'visible', true) : null,
          puedePedidos ? contar('pedidos') : null, puedePedidos ? contar('pedidos', 'estado', 'Pendiente') : null,
        ])
        if (vigente) setDatos({ productos, visibles, pedidos, pendientes })
      } catch { if (vigente) setError('No pudimos cargar el resumen. Podés reintentar o entrar a una sección.') }
    }
    cargar()
    return () => { vigente = false }
  }, [client, negocio.id, puedeProductos, puedePedidos, intento])
  const acciones = [
    ['tienda.configurar', 'apariencia', 'Identidad de la tienda', 'Personalizar tienda'],
    ['pedidos.ver', 'pedidos', 'Pedidos', 'Consultar pedidos'],
    ['productos.ver', 'productos', 'Productos', 'Gestionar productos'],
    ['stock.ver', 'stock', 'Inventario', 'Gestionar inventario'],
    ['clientes.ver', 'clientes', 'Clientes', 'Consultar clientes'],
    ['entregas.configurar', 'entregas', 'Entregas', 'Configurar entregas'],
  ]
  return <main className="dashboard-page business-platform">
    <header className="dashboard-topbar"><a className="store-brand" href="#/"><Marca /></a><button className="button button-outline" onClick={onVolver}>Mis emprendimientos</button></header>
    <div className="business-overview"><div className="overview-breadcrumb">Mi espacio <span>/</span> {negocio.nombre}</div>
      <section className="overview-hero"><div><h1>{negocio.nombre}</h1></div><div className="overview-store-link"><span className={'business-status ' + (!negocio.activo ? 'business-inactive' : '')}>{negocio.activo ? 'Tienda activa' : 'Tienda inactiva'}</span>{negocio.activo && negocio.slug && <a className="button button-primary" href={'#/tienda/' + negocio.slug}>Ver mi tienda ↗</a>}</div></section>
      <div className="section-heading"><div><h2>Actividad</h2></div><button className="button button-outline" onClick={() => setIntento(v => v + 1)}>Actualizar resumen</button></div>
      {error ? <p role="alert" className="error-feedback">{error}</p> : !datos ? <p role="status">Cargando resumen…</p> : <dl className="overview-metrics">
        {puedeProductos && <><div><dt>Productos registrados</dt><dd>{datos.productos}</dd><small>Tu catálogo completo</small></div><div><dt>Productos publicados</dt><dd>{datos.visibles}</dd><small>{negocio.activo ? 'Visibles en tu tienda' : 'Tienda inactiva: no se muestran al público'}</small></div></>}
        {puedePedidos && <><div><dt>Pedidos recibidos</dt><dd>{datos.pedidos}</dd><small>Total de pedidos registrados</small></div><div className="metric-highlight"><dt>Pedidos pendientes</dt><dd>{datos.pendientes}</dd><small>Con estado Pendiente</small></div></>}
      </dl>}
      <div className="overview-actions">{acciones.filter(a => negocio.permisos.includes(a[0])).map((a) => <article key={a[0]}><h2>{a[2]}</h2><button className="button button-secondary" onClick={() => onAbrir(a[1])}>{a[3]} ↗</button></article>)}</div>

    </div>
  </main>
}
