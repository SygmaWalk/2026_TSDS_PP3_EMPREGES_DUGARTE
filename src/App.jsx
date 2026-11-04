import {destinoTrasIngreso,errorRetornoOAuth} from './features/acceso/oauth.js'
import ThemeToggle from './ThemeToggle.jsx'
import {useRuta} from './navigation.js'
import Inicio from './features/catalogo/Inicio.jsx'
import { leerPerfil } from './features/cliente/perfil.js'
import TiendaPublica from './features/catalogo/TiendaPublica.jsx'
import { useEffect, useState } from 'react'
import { supabase, supabasePublic } from './lib/supabase.js'
import Acceso from './features/acceso/Acceso.jsx'
import Emprendimientos from './features/acceso/Emprendimientos.jsx'
import './App.css'
import './features/catalogo/experiencia.css'

function AppContent({ client = supabase, publicClient = supabasePublic }) {
  const ruta=useRuta()
  const [acceso, setAcceso] = useState({ cargando: true, usuario: null, error: '' })
  useEffect(() => {
    if (!client) return
    const errorOAuth=errorRetornoOAuth()
    const teniaCodigo=new URLSearchParams(window.location.search).has('code')
    let vigente = true
    let eventoRecibido = false
    const { data: { subscription } } = client.auth.onAuthStateChange((_evento, session) => {
      eventoRecibido = true
      if (['SIGNED_IN','INITIAL_SESSION'].includes(_evento) && session?.user && ['#/ingresar', '#/registro'].includes(window.location.hash)) window.location.hash=destinoTrasIngreso()
      if (_evento === 'SIGNED_OUT' && !window.location.hash.startsWith('#/tienda/') && !['', '#/', '#/emprendimientos'].includes(window.location.hash)) window.location.hash = '#/ingresar'
      if (vigente) setAcceso({ cargando: false, usuario: session?.user ?? null, error: session?.user?'':errorOAuth||(teniaCodigo?'No se pudo completar el acceso con Google. Volvé a intentarlo.':'') })
    })
    client.auth.getSession().then(({ data, error }) => {
      if(!vigente)return
      if(errorOAuth||teniaCodigo){
        const url=new URL(window.location.href)
        for(const campo of ['code','error','error_code','error_description'])url.searchParams.delete(campo)
        if(errorOAuth)url.hash='#/ingresar'
        window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
      if (!vigente || eventoRecibido) return
      if(data?.session?.user&&['#/ingresar','#/registro'].includes(window.location.hash))window.location.hash=destinoTrasIngreso()
      setAcceso({ cargando: false, usuario: data?.session?.user ?? null,
        error: errorOAuth || (error || (teniaCodigo&&!data?.session) ? 'No se pudo completar el acceso. Volvé a ingresar.' : '') })
    }).catch(() => {
      if (vigente && !eventoRecibido) setAcceso({ cargando: false, usuario: null, error: 'No se pudo recuperar la sesión.' })
    })
    return () => { vigente = false; subscription.unsubscribe() }
  }, [client])

  if (!client) return <main className="app-shell"><h1>EmpreGest</h1><p role="alert">Falta configurar la conexión. Consultá la guía de instalación del proyecto.</p></main>
  if (ruta.startsWith('#/tienda/')) return <TiendaPublica key={ruta + (acceso.usuario?.id ?? 'invitado')} client={publicClient} pedidoClient={acceso.cargando ? null : acceso.usuario ? client : publicClient} perfil={leerPerfil(acceso.usuario)} usuario={acceso.usuario} identidad={acceso.usuario?.id ?? 'invitado'} slug={ruta.slice(9)} />
  if (acceso.cargando) return <main className="app-shell"><p role="status">Recuperando sesión…</p></main>
  if (['', '#/', '#/emprendimientos'].includes(ruta)) return <Inicio key={ruta} client={publicClient} usuario={acceso.usuario} />
  if (!acceso.usuario) return <Acceso key={ruta} registro={ruta === '#/registro'} client={client} errorInicial={acceso.error} />
  // Un cambio de usuario desmonta todos los datos y el carrito de la sesión anterior.
  return <Emprendimientos key={acceso.usuario.id} client={client} usuario={acceso.usuario} />
}

export default function App(props){return <><AppContent {...props}/><ThemeToggle/></>}
