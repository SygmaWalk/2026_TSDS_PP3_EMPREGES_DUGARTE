import { useState } from 'react'
import {ingresarConGoogle} from './oauth.js'
import { Marca } from './InterfazAcceso.jsx'

export default function Acceso({ client, errorInicial = '', registro = false, googleDisponible = import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true' }) {
  const [mensaje, setMensaje] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(errorInicial)
  async function google(){
    if(ocupado)return
    setOcupado(true);setError('');setMensaje('')
    try{await ingresarConGoogle(client)}
    catch(e){setError(e.message);setOcupado(false)}
  }
  async function enviar(event) {
    event.preventDefault()
    if (ocupado) return
    setOcupado(true); setError(''); setMensaje('')
    try {
      if (registro) {
        const { data, error: fallo } = await client.auth.signUp({ email: email.trim(), password })
        if (fallo) setError('No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.')
        else if (!data?.session) setMensaje('Revisá tu correo para confirmar la cuenta. Si ya tenés una, podés ingresar.')
      } else {
        const { error: fallo } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (fallo) setError('No se pudo ingresar. Revisá el correo, la contraseña y la confirmación de tu cuenta.')
      }
    } catch { setError('No se pudo conectar. Revisá tu conexión e intentá nuevamente.') }
    finally { setOcupado(false) }
  }
  return <main className="login-page">
    <section className="login-story" aria-label="EmpreGest">
      <Marca />
      <div className="login-message"><span className="login-kicker">MÁS CLARIDAD PARA TU DÍA A DÍA</span><h2>Tu negocio,<br />en orden.</h2><p>Un espacio para tus productos.<br />Un acceso propio para cada persona.</p>
        <div className="login-illustration" aria-hidden="true"><div className="illustration-shop"><span className="shop-awning" /><span className="shop-window" /><span className="shop-door" /></div><span className="illustration-label">Cada cosa en su lugar.</span><span className="illustration-seal">eg.</span></div>
      </div>
      <p className="login-footnote">Hecho para acompañar a los emprendimientos.</p>
    </section>
    <section className="login-form-side" aria-labelledby="login-title">
      <div className="login-form-wrap"><a className="login-home-link" href="#/">← Volver al inicio</a><span className="eyebrow">BIENVENIDO A TU ESPACIO</span><h1 id="login-title">{registro ? 'Crear cuenta de cliente' : 'Ingresar'}</h1><p className="login-description">{registro ? 'Guardá tus datos para hacer tus próximos pedidos.' : 'Usá tu cuenta personal para continuar.'}</p>
        {error && <p role="alert" className="error-feedback">{error}</p>}
        {mensaje && <p role="status" className="feedback">{mensaje}</p>}
        {googleDisponible&&<div className="google-access"><button className="button button-secondary login-submit" type="button" disabled={ocupado} onClick={google}>Continuar con Google</button><p className="field-help">O ingresá con tu correo y contraseña.</p></div>}
        <form className="product-form" onSubmit={enviar}>
          <fieldset disabled={ocupado} className="form-fields">
            <div className="field-group"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="email" placeholder="nombre@correo.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="field-group"><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete={registro ? "new-password" : "current-password"} minLength={registro ? 8 : undefined} placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <button className="button button-primary login-submit" type="submit">{ocupado ? 'Conectando…' : registro ? 'Crear cuenta' : 'Ingresar'}<span aria-hidden="true">↗</span></button>
          </fieldset>
        </form>
        <p className="signup-switch">{registro ? '¿Ya tenés cuenta?' : '¿Es tu primera compra con cuenta?'} <a href={registro ? '#/ingresar' : '#/registro'}>{registro ? 'Ingresar' : 'Crear cuenta de cliente'}</a></p><p className="field-help">{registro ? 'Usá una contraseña de al menos 8 caracteres.' : 'La sesión se conserva en este navegador hasta que cierres sesión.'}</p>
        <div className="access-help"><span className="access-help-icon" aria-hidden="true">i</span><div><strong>¿Trabajás en un emprendimiento?</strong><p>El administrador del sistema habilita tu cuenta y te asigna los permisos que necesitás.</p></div></div>
        <p className="login-caption">Tu acceso se adapta a tu función.</p>
        <div className="login-roles"><span>Administrador</span><span>Emprendimiento</span><span>Cliente</span></div>
      </div>
    </section>
  </main>
}
