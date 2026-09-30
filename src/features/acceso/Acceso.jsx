import { useState } from 'react'

export default function Acceso({ client, errorInicial = '' }) {
  const [registro, setRegistro] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(errorInicial)
  const [mensaje, setMensaje] = useState('')

  async function enviar(event) {
    event.preventDefault()
    if (ocupado) return
    setOcupado(true); setError(''); setMensaje('')
    try {
      const credenciales = { email: email.trim(), password }
      const resultado = registro
        ? await client.auth.signUp(credenciales)
        : await client.auth.signInWithPassword(credenciales)
      if (resultado.error) {
        setError(registro
          ? 'No se pudo crear la cuenta. Revisá los datos y usá una contraseña de al menos 8 caracteres.'
          : 'No se pudo ingresar. Revisá el correo, la contraseña y la confirmación de tu cuenta.')
      } else if (registro && !resultado.data.session) {
        setMensaje('Revisá tu correo para confirmar la cuenta antes de ingresar.')
        setPassword('')
      }
    } catch {
      setError('No se pudo conectar. Revisá tu conexión e intentá nuevamente.')
    } finally { setOcupado(false) }
  }

  return <main className="app-shell access-shell">
    <header className="app-header"><div><span className="eyebrow">EmpreGest</span><h1>{registro ? 'Crear cuenta' : 'Ingresar'}</h1><p>Administrá los productos de tu emprendimiento.</p></div></header>
    {error && <p role="alert" className="error-feedback">{error}</p>}
    {mensaje && <p role="status" className="feedback">{mensaje}</p>}
    <section className="panel form-panel">
      <form className="product-form" onSubmit={enviar}>
        <fieldset disabled={ocupado} className="form-fields">
          <div className="field-group"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field-group"><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete={registro ? 'new-password' : 'current-password'} minLength={registro ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="button button-primary" type="submit">{ocupado ? 'Conectando…' : registro ? 'Crear cuenta' : 'Ingresar'}</button>
          <button className="button button-secondary" type="button" onClick={() => { setRegistro(!registro); setError(''); setMensaje(''); setPassword('') }}>{registro ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>
        </fieldset>
      </form>
    </section>
  </main>
}
