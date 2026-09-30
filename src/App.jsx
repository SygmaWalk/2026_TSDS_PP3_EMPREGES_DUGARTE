import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import Acceso from './features/acceso/Acceso.jsx'
import Emprendimientos from './features/acceso/Emprendimientos.jsx'
import './App.css'

export default function App({ client = supabase }) {
  const [acceso, setAcceso] = useState({ cargando: true, usuario: null, error: '' })
  useEffect(() => {
    if (!client) return
    let vigente = true
    let eventoRecibido = false
    const { data: { subscription } } = client.auth.onAuthStateChange((_evento, session) => {
      eventoRecibido = true
      if (vigente) setAcceso({ cargando: false, usuario: session?.user ?? null, error: '' })
    })
    client.auth.getSession().then(({ data, error }) => {
      if (!vigente || eventoRecibido) return
      setAcceso({ cargando: false, usuario: data?.session?.user ?? null,
        error: error ? 'No se pudo recuperar la sesión. Volvé a ingresar.' : '' })
    }).catch(() => {
      if (vigente && !eventoRecibido) setAcceso({ cargando: false, usuario: null, error: 'No se pudo recuperar la sesión.' })
    })
    return () => { vigente = false; subscription.unsubscribe() }
  }, [client])

  if (!client) return <main className="app-shell"><h1>EmpreGest</h1><p role="alert">Falta configurar la conexión. Consultá la guía de instalación del proyecto.</p></main>
  if (acceso.cargando) return <main className="app-shell"><p role="status">Recuperando sesión…</p></main>
  if (!acceso.usuario) return <Acceso client={client} errorInicial={acceso.error} />
  // Un cambio de usuario desmonta todos los datos y el carrito de la sesión anterior.
  return <Emprendimientos key={acceso.usuario.id} client={client} usuario={acceso.usuario} />
}
