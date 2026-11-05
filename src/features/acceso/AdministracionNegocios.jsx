import { useState } from 'react'
import { useCambiosSinGuardar } from '../../navigation.js'

const negocioNuevo = { nombre: '', slug: '', activo: true }

function FormularioNegocio({ client, negocio, onCancelar, onGuardado }) {
  const [datos, setDatos] = useState(negocio ?? negocioNuevo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const inicial = negocio ?? negocioNuevo
  useCambiosSinGuardar(datos.nombre !== inicial.nombre || datos.slug !== inicial.slug || datos.activo !== inicial.activo)

  async function guardar(event) {
    event.preventDefault()
    if (guardando) return
    const valores = { nombre: datos.nombre.trim(), slug: datos.slug.trim(), activo: datos.activo }
    if (!valores.nombre || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(valores.slug)) {
      setError('Ingresá un nombre y una dirección válida para la tienda.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const tabla = client.from('emprendimientos')
      const operacion = negocio
        ? tabla.update(valores).eq('id', negocio.id).eq('nombre', negocio.nombre)
            .eq('slug', negocio.slug).eq('activo', negocio.activo)
        : tabla.insert(valores)
      const resultado = await operacion.select('id,nombre,slug,activo').maybeSingle()
      if (resultado.error) {
        if (resultado.error.code === '23505') throw Error('Esa dirección ya pertenece a otra tienda.')
        throw Error('No se pudo guardar el emprendimiento. Revisá tu acceso e intentá nuevamente.')
      }
      if (!resultado.data) throw Error('El emprendimiento cambió o ya no tenés acceso. Volvé a abrirlo antes de editar.')
      onGuardado(resultado.data)
    } catch (fallo) {
      setError(fallo.message || 'No se pudo guardar el emprendimiento.')
    } finally {
      setGuardando(false)
    }
  }

  return <form onSubmit={guardar} className="access-state">
    <h3>{negocio ? 'Editar ' + negocio.nombre : 'Nuevo emprendimiento'}</h3>
    <fieldset disabled={guardando}>
      <label>Nombre del emprendimiento
        <input required value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})}/>
      </label>
      <label>Dirección de la tienda
        <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="ayuda-direccion" value={datos.slug}
          onChange={e => setDatos({...datos, slug: e.target.value})}/>
      </label>
      <p id="ayuda-direccion">Usá letras minúsculas, números y guiones. Cambiar la dirección cambia el enlace público de la tienda.</p>
      <label><input type="checkbox" checked={datos.activo} onChange={e => setDatos({...datos, activo: e.target.checked})}/> Tienda activa</label>
      {error && <p role="alert">{error}</p>}
      <button className="button button-primary" type="submit">{guardando ? 'Guardando…' : 'Guardar emprendimiento'}</button>
      <button className="button" type="button" onClick={onCancelar}>Cancelar</button>
    </fieldset>
  </form>
}

export default function AdministracionNegocios({ client, negocios, actualizar, abrirPanel }) {
  const [editor, setEditor] = useState(null)
  const [mensaje, setMensaje] = useState('')
  function abrir(negocio) {
    setMensaje('')
    setEditor({ negocio })
  }
  function guardado(negocio) {
    actualizar()
    setEditor(null)
    setMensaje('Se guardó el emprendimiento ' + negocio.nombre + '.')
  }
  return <section>
    <div className="section-heading"><h2>Administrar emprendimientos</h2>
      {!editor && <button className="button button-primary" onClick={() => abrir(null)}>Crear emprendimiento</button>}
    </div>
    {mensaje && <p role="status">{mensaje}</p>}
    {editor ? <FormularioNegocio client={client} negocio={editor.negocio} onCancelar={() => setEditor(null)} onGuardado={guardado}/> :
      <div className="business-grid">{negocios.map(negocio => <article className="business-card" key={negocio.id}>
        <h3>{negocio.nombre}</h3><p>{negocio.activo ? 'Activo' : 'Inactivo'}</p>
        <button className="button" onClick={() => abrir(negocio)}>Editar {negocio.nombre}</button>
        <button className="button button-primary" onClick={() => abrirPanel(negocio)}>Abrir panel de {negocio.nombre}</button>
      </article>)}</div>}
  </section>
}
