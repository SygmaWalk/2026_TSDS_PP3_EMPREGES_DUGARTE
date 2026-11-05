import { useEffect, useState } from 'react'
import { useCambiosSinGuardar } from '../../navigation.js'

const nueva = tipo => ({ tipo, nombre: '', valor: '', activo: true, productos: [], inicio: '', fin: '' })

function horaLocal(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16)
}

function Editor({ regla, productos, guardar, cancelar }) {
  const [datos, setDatos] = useState({...regla, inicio: horaLocal(regla.inicio), fin: horaLocal(regla.fin)})
  const [sucio, setSucio] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const promo = datos.tipo === 'promocion'
  useCambiosSinGuardar(sucio)
  function cambiar(campo, valor) {
    setDatos(prev => ({...prev, [campo]: valor}))
    setSucio(true)
  }
  async function enviar(e) {
    e.preventDefault()
    if (!datos.nombre.trim() || !datos.productos.length) {
      setError('Ingresá un nombre y seleccioná al menos un producto.')
      return
    }
    if (promo && datos.inicio >= datos.fin) {
      setError('El fin debe ser posterior al inicio.')
      return
    }
    setOcupado(true)
    setError('')
    try { await guardar(datos) }
    catch (fallo) { setError(fallo.message) }
    finally { setOcupado(false) }
  }
  return <form onSubmit={enviar} className="product-form"><fieldset disabled={ocupado} className="form-fields">
    <legend>{promo ? 'Promoción' : 'Adicional'}</legend>
    <label>Nombre de la regla<input required maxLength={100} value={datos.nombre} onChange={e => cambiar('nombre',e.target.value)}/></label>
    <label>{promo ? 'Descuento (%)' : 'Precio adicional ($)'}<input required type="number" step="0.01" min={promo ? '0.01' : '0'} max={promo ? '99.99' : '9999999999.99'} value={datos.valor} onChange={e => cambiar('valor',e.target.value)}/></label>
    {promo && <><label>Inicio<input required type="datetime-local" value={datos.inicio} onChange={e => cambiar('inicio',e.target.value)}/></label>
    <label>Fin<input required type="datetime-local" value={datos.fin} onChange={e => cambiar('fin',e.target.value)}/></label>
    <p>Se aplica el mayor descuento vigente al precio del producto. Los adicionales se suman después.</p></>}
    <fieldset><legend>Productos alcanzados</legend>{productos.map(p => <label key={p.id}><input type="checkbox" checked={datos.productos.includes(p.id)} onChange={e => cambiar('productos',e.target.checked ? [...datos.productos,p.id] : datos.productos.filter(id => id !== p.id))}/>{p.nombre}</label>)}</fieldset>
    <label><input type="checkbox" checked={datos.activo} onChange={e => cambiar('activo',e.target.checked)}/> Activa</label>
    {error && <p role="alert">{error}</p>}
    <div className="form-actions"><button type="submit" className="button button-primary">Guardar regla</button><button type="button" className="button" onClick={cancelar}>Cancelar</button></div>
  </fieldset></form>
}

export default function ReglasCatalogo({client, negocio, productos}) {
  const [reglas, setReglas] = useState([])
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const {data,error} = await client.rpc('reglas_negocio',{p_negocio:negocio.id})
        if (error) throw error
        if (vigente) { setReglas(data); setError('') }
      } catch { if (vigente) setError('No se pudieron cargar las reglas del catálogo.') }
    }
    cargar()
    return () => { vigente = false }
  },[client,negocio.id,revision])
  async function guardar(d) {
    const {error} = await client.rpc('guardar_regla_catalogo',{
      p_negocio:negocio.id, p_id:d.id ?? null, p_tipo:d.tipo, p_nombre:d.nombre.trim(),
      p_valor:Number(d.valor), p_activo:d.activo, p_productos:d.productos.filter(id => productos.some(p => p.id === id)),
      p_inicio:d.inicio ? new Date(d.inicio).toISOString() : null, p_fin:d.fin ? new Date(d.fin).toISOString() : null
    })
    if (error) throw Error(error.code === '42501' ? 'Ya no tenés permiso para editar este catálogo.' : 'Revisá el precio, la vigencia y los productos seleccionados.')
    setEditor(null)
    setMensaje('Regla guardada.')
    setRevision(r => r + 1)
  }
  return <section className="panel"><h2>Adicionales y promociones</h2><p>{negocio.nombre}</p>
    {mensaje && <p role="status">{mensaje}</p>}{error && <p role="alert">{error} <button type="button" onClick={() => setRevision(r=>r+1)}>Reintentar</button></p>}
    {editor ? <Editor key={editor.id ?? editor.tipo} regla={editor} productos={productos} guardar={guardar} cancelar={() => setEditor(null)}/> : <>
      <div className="form-actions"><button className="button" onClick={()=>setEditor(nueva('adicional'))}>Nuevo adicional</button><button className="button" onClick={()=>setEditor(nueva('promocion'))}>Nueva promoción</button></div>
      <ul>{reglas.map(r=><li key={r.id}><strong>{r.nombre}</strong> · {r.tipo==='adicional' ? '$'+r.valor : r.valor+'%'} · {r.activo ? 'Activa' : 'Inactiva'} <button className="button" onClick={()=>setEditor(r)}>Editar {r.nombre}</button></li>)}</ul>
    </>}
  </section>
}
