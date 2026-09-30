import { useEffect, useMemo, useState } from 'react'
import Workspace from '../../Workspace.jsx'
import { crearProductosRepository } from '../productos/productosRepository.js'

function CatalogoAdministrable({ client, negocio, usuarioId, onVolver }) {
  const repository = useMemo(() => crearProductosRepository(client, negocio.id), [client, negocio.id])
  const [carga, setCarga] = useState({ productos: null, error: '' })
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    repository.listar().then(productos => {
      if (vigente) setCarga({ productos, error: '' })
    }).catch(error => {
      if (vigente) setCarga({ productos: null, error: error.message })
    })
    return () => { vigente = false }
  }, [repository, intento])
  if (!carga.productos) return <main className="app-shell">
    {carga.error ? <><p role="alert" className="error-feedback">{carga.error}</p><button className="button" onClick={() => setIntento(intento + 1)}>Reintentar</button></> : <p role="status">Cargando productos…</p>}
    <button className="button" onClick={onVolver}>Volver a emprendimientos</button>
  </main>
  return <Workspace usuarioId={usuarioId} repository={repository} productosIniciales={carga.productos} negocio={negocio} onVolver={onVolver} />
}

export default function Emprendimientos({ client, usuario }) {
  const [negocios, setNegocios] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    // Filtrar por membresía evita confundir negocios públicos con administrables.
    client.from('miembros_emprendimiento')
      .select('emprendimiento_id,emprendimientos(id,nombre,slug,activo)')
      .eq('usuario_id', usuario.id).order('emprendimiento_id')
      .then(({ data, error: fallo }) => {
        if (!vigente) return
        if (fallo) { setError('No se pudieron cargar tus emprendimientos.'); return }
        setNegocios(data.map(fila => fila.emprendimientos).filter(Boolean)); setError('')
      }).catch(() => { if (vigente) setError('No se pudieron cargar tus emprendimientos.') })
    return () => { vigente = false }
  }, [client, usuario.id, intento])

  async function crear(event) {
    event.preventDefault()
    if (ocupado) return
    if (!nombre.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug.trim())) {
      setError('Ingresá un nombre y un identificador con minúsculas, números y guiones.'); return
    }
    setOcupado(true); setError('')
    try {
      const { data, error: fallo } = await client.rpc('crear_emprendimiento_inicial', { p_nombre: nombre.trim(), p_slug: slug.trim() })
      if (fallo) { setError(fallo.code === '23505' ? 'Ese identificador ya está en uso.' : 'No se pudo crear el emprendimiento. Intentá nuevamente.'); return }
      setNegocios(actuales => [...actuales, { id: data, nombre: nombre.trim(), slug: slug.trim(), activo: true }])
      setNombre(''); setSlug('')
    } catch { setError('No se pudo conectar para crear el emprendimiento.') }
    finally { setOcupado(false) }
  }

  async function salir() {
    setOcupado(true); setError('')
    try {
      const { error: fallo } = await client.auth.signOut()
      if (fallo) setError('No se pudo cerrar la sesión. Intentá nuevamente.')
    } catch { setError('No se pudo cerrar la sesión. Intentá nuevamente.') }
    finally { setOcupado(false) }
  }

  if (seleccionado) return <CatalogoAdministrable usuarioId={usuario.id} key={seleccionado.id} client={client} negocio={seleccionado} onVolver={() => setSeleccionado(null)} />
  return <main className="app-shell access-shell">
    <header className="app-header"><div><span className="eyebrow">EmpreGest</span><h1>Mis emprendimientos</h1><p>{usuario.email}</p></div><button className="button" disabled={ocupado} onClick={salir}>Cerrar sesión</button></header>
    {error && <p role="alert" className="error-feedback">{error}</p>}
    {negocios === null ? <><p role="status">Cargando emprendimientos…</p>{error && <button className="button" onClick={() => setIntento(intento + 1)}>Reintentar</button>}</> : <>
      <div className="business-list">{negocios.map(negocio => <button className="button button-secondary" disabled={ocupado} key={negocio.id} onClick={() => setSeleccionado(negocio)}>{negocio.nombre}{!negocio.activo && ' (inactivo)'}</button>)}</div>
      <section className="panel form-panel"><h2>Crear emprendimiento</h2><p>Creá tu negocio para comenzar a cargar productos.</p>
        <form className="product-form" onSubmit={crear}><fieldset className="form-fields" disabled={ocupado}>
          <div className="field-group"><label htmlFor="negocio-nombre">Nombre del emprendimiento</label><input id="negocio-nombre" value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
          <div className="field-group"><label htmlFor="negocio-slug">Identificador del emprendimiento</label><input id="negocio-slug" value={slug} onChange={e => setSlug(e.target.value)} placeholder="tequenos-gavidia" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /><p className="field-help">Usá minúsculas, números y guiones. Debe ser único.</p></div>
          <button className="button button-primary" type="submit">{ocupado ? 'Esperá un momento…' : 'Crear emprendimiento'}</button>
        </fieldset></form>
      </section>
    </>}
  </main>
}
