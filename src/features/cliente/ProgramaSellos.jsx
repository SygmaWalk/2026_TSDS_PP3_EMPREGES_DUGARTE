import { useEffect, useState } from 'react'

export default function ProgramaSellos({ client, negocio }) {
  const [config, setConfig] = useState(null)
  const [intento, setIntento] = useState(0)
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const { data, error } = await client.from('programas_sellos').select('activo,terminos').eq('negocio', negocio.id).maybeSingle()
        if (error) throw error
        if (vigente) setConfig(data ?? { activo: false, terminos: '' })
      } catch { if (vigente) setError('No se pudo cargar el programa.') }
    }
    cargar()
    return () => { vigente = false }
  }, [client, negocio.id, intento])

  async function enviar(evento, canjear) {
    evento.preventDefault()
    setOcupado(true); setError(''); setMensaje('')
    try {
      if (canjear) {
        const { data, error } = await client.rpc('canjear_tarjeton', { p_negocio: negocio.id, p_codigo: codigo.trim() })
        if (error) throw error
        setMensaje('Canje registrado. Beneficio: ' + data); setCodigo('')
      } else {
        const { error } = await client.from('programas_sellos').upsert({ negocio: negocio.id, activo: config.activo, terminos: config.terminos.trim() })
        if (error) throw error
        setMensaje('Programa guardado.')
      }
    } catch { setError(canjear ? 'No se pudo canjear. Revisá el código y si ya fue utilizado.' : 'No se pudo guardar el programa.') }
    finally { setOcupado(false) }
  }
  return <main className="app-shell loyalty-settings"><h1>Tarjetón de fidelización</h1>
    <p>Cada compra pagada y entregada suma un sello. Al décimo, el cliente recibe el beneficio definido por tu local.</p>
    {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    {!config ? error ? <button className="button" onClick={() => { setError(''); setIntento(i => i+1) }}>Reintentar</button> : <p>Cargando…</p> :
      <><form className="panel form-fields" onSubmit={e => enviar(e, false)}>
        <label><input type="checkbox" checked={config.activo} onChange={e => setConfig({ ...config, activo: e.target.checked })} /> Programa activo</label>
        <label>Beneficio y condiciones al completar diez sellos<textarea required maxLength={2000} value={config.terminos} onChange={e => setConfig({ ...config, terminos: e.target.value })} /></label>
        <button className="button button-primary" disabled={ocupado || !config.terminos.trim()}>Guardar programa</button>
      </form>
      <form className="panel form-fields" onSubmit={e => enviar(e, true)}><h2>Registrar un canje</h2>
        <label>Código presentado por el cliente<input required value={codigo} onChange={e => setCodigo(e.target.value)} /></label>
        <button className="button" disabled={ocupado || !codigo.trim()}>Confirmar canje</button>
      </form></>}
  </main>
}
