import { useState } from 'react'
import { leerPerfil, validarPerfil } from './perfil.js'

export default function PerfilCliente({ client, usuario }) {
  const [perfil, setPerfil] = useState(() => leerPerfil(usuario))
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  async function guardar(e) {
    e.preventDefault()
    if (guardando) return
    setGuardando(true); setError(''); setMensaje('')
    try {
      const datos = validarPerfil(perfil)
      // Datos de contacto editables. Nunca se utilizan para roles ni permisos.
      const { error: fallo } = await client.auth.updateUser({ data: { perfil_cliente: datos } })
      if (fallo) throw new Error('No se pudo guardar tu perfil. Revisá tu conexión e intentá nuevamente.')
      setPerfil(datos); setMensaje('Tu perfil se guardó correctamente.')
    } catch (fallo) { setError(fallo.message) }
    finally { setGuardando(false) }
  }
  return <section className="profile-layout" id="mi-perfil">
    <div className="profile-intro"><span className="profile-monogram" aria-hidden="true">{(perfil.nombre || usuario.email || 'C').slice(0, 1).toUpperCase()}</span><span className="eyebrow">TU ESPACIO PERSONAL</span><h2>Mi perfil</h2><p>Menos datos para escribir.<br />Más tiempo para elegir.</p><a className="button button-primary" href="#/emprendimientos">Explorar tiendas ↗</a><div className="profile-privacy"><strong>Tus datos, en tu cuenta</strong><p>Tu perfil no aparece en el catálogo público. Al confirmar un pedido, la tienda recibe los datos de contacto y entrega que revisaste.</p></div></div>
    <div className="profile-form panel"><h3>Datos personales</h3><p>Usaremos estos datos para completar tus próximos pedidos. Podés modificarlos antes de confirmar.</p>
      <form className="product-form" onSubmit={guardar}><fieldset disabled={guardando} className="form-fields">
        <div className="field-group"><label htmlFor="perfil-nombre">Nombre y apellido</label><input id="perfil-nombre" autoComplete="name" required minLength={2} maxLength={100} value={perfil.nombre} onChange={e => { setPerfil({ ...perfil, nombre: e.target.value }); setMensaje('') }} /></div>
        <div className="field-group"><label htmlFor="perfil-email">Correo de la cuenta</label><input id="perfil-email" type="email" value={usuario.email ?? ''} readOnly /><small>Es el correo con el que ingresás.</small></div>
        <div className="field-group"><label htmlFor="perfil-telefono">Teléfono</label><input id="perfil-telefono" type="tel" autoComplete="tel" maxLength={30} value={perfil.telefono} onChange={e => { setPerfil({ ...perfil, telefono: e.target.value }); setMensaje('') }} /><small>Opcional. Incluí el código de área.</small></div>
        <div className="field-group"><label htmlFor="perfil-direccion">Dirección habitual</label><input id="perfil-direccion" autoComplete="street-address" maxLength={200} value={perfil.direccion} onChange={e => { setPerfil({ ...perfil, direccion: e.target.value }); setMensaje('') }} /><small>Opcional. En cada envío deberás revisar la dirección y marcar el punto en el mapa.</small></div>
        {error && <p role="alert" className="error-feedback">{error}</p>}{mensaje && <p role="status" className="feedback">{mensaje}</p>}
        <button className="button button-primary" type="submit">{guardando ? 'Guardando…' : 'Guardar perfil'}</button>
      </fieldset></form>
      <div className="session-explanation"><strong>Acerca de tu sesión</strong><p>Tu cuenta sigue abierta en este navegador aunque cierres la ventana o apagues el equipo. Usá “Cerrar sesión” cuando termines en un dispositivo compartido.</p></div>
    </div>
  </section>
}
