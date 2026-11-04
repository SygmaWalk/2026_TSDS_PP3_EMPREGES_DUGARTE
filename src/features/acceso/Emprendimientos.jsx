import AdministracionCuentas from './AdministracionCuentas.jsx'
import PanelNegocio from './PanelNegocio.jsx'
import {useRuta,leerRuta,navegar,rutaNegocio,inicioNegocio,SECCIONES,confirmarSalida} from '../../navigation.js'
import EditorApariencia from '../apariencia/EditorApariencia.jsx'
import PanelStock from '../stock/PanelStock.jsx'
import PanelClientes from '../clientes/PanelClientes.jsx'
import PerfilCliente from '../cliente/PerfilCliente.jsx'
import ConfigEntregas from '../entregas/ConfigEntregas.jsx'
import PanelPedidos from '../pedidos/PanelPedidos.jsx'
import { useEffect, useMemo, useState } from 'react'
import ProductosPanel from '../productos/ProductosPanel.jsx'
import { crearProductosRepository } from '../productos/productosRepository.js'
import { obtenerAcceso } from './accesoRepository.js'
import { Marca, InsigniaRol } from './InterfazAcceso.jsx'

function CatalogoAdministrable({ client, negocio, onVolver }) {
  const repository = useMemo(() => crearProductosRepository(client, negocio.id), [client, negocio.id])
  const [carga, setCarga] = useState({ productos: null, error: '' })
  useEffect(() => {
    let vigente = true
    repository.listar().then(productos => {
      if (vigente) setCarga({ productos, error: '' })
    }).catch(error => {
      if (vigente) setCarga({ productos: null, error: error.message })
    })
    return () => { vigente = false }
  }, [repository])
  if (!carga.productos) return <main className="app-shell">
    {carga.error ? <p role="alert">{carga.error}</p> : <p role="status">Cargando productos…</p>}
    <button className="button" onClick={onVolver}>Volver a emprendimientos</button>
  </main>
  return <ProductosPanel client={client} repository={repository} productosIniciales={carga.productos} negocio={negocio}/>
}

export default function Emprendimientos({ client, usuario }) {
  const [acceso, setAcceso] = useState(null)
  const ruta=useRuta(),destino=leerRuta(ruta)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    let solicitud = 0
    async function cargar() {
      const actual = ++solicitud
      try {
        const resultado = await obtenerAcceso(client, usuario.id)
        if (vigente && actual === solicitud) { setAcceso(resultado); setError('') }
      } catch (fallo) {
        if (vigente && actual === solicitud) { setAcceso(null); setError(fallo.message) }
      }
    }
    cargar()
    // El servidor protege cada operación; esta actualización retira controles obsoletos.
    const intervalo = window.setInterval(cargar, 30000)
    window.addEventListener('focus', cargar)
    return () => { vigente = false; window.clearInterval(intervalo); window.removeEventListener('focus', cargar) }
  }, [client, usuario.id, intento])

  async function salir() {
    if(!confirmarSalida())return
    setOcupado(true); setError('')
    try {
      const { error: fallo } = await client.auth.signOut()
      if (fallo) setError('No se pudo cerrar la sesión. Intentá nuevamente.')
    } catch { setError('No se pudo cerrar la sesión. Intentá nuevamente.') }
    finally { setOcupado(false) }
  }

  useEffect(()=>{
    if(!acceso?.habilitada||acceso.rol!=='emprendimiento'||ruta.startsWith('#/panel/'))return
    let ultimo;try{ultimo=localStorage.getItem('empreges:negocio:'+usuario.id)}catch{/* Sin almacenamiento. */}
    const n=acceso.negocios.find(n=>String(n.id)===ultimo)??acceso.negocios[0]
    if(n)navegar(rutaNegocio(n.id,inicioNegocio(n)),{replace:true})
  },[acceso,ruta,usuario.id])
  const negocio=acceso?.habilitada&&acceso.negocios.find(n=>n.id===destino?.id)
  if(acceso?.habilitada&&acceso.rol!=='cliente'&&ruta.startsWith('#/panel/')){
    if(!negocio)return <main className="app-shell"><h1>Emprendimiento no disponible</h1><p role="alert">No tenés acceso a este emprendimiento.</p><button className="button" onClick={()=>navegar('#/cuenta')}>Volver a mi cuenta</button></main>
    const seccion=destino.seccion,permiso=SECCIONES.find(s=>s[0]===seccion)?.[2],volver=()=>navegar(rutaNegocio(negocio.id,inicioNegocio(negocio)))
    let contenido
    if(!permiso||!negocio.permisos.includes(permiso))contenido=<main className="app-shell"><h1>Sección no disponible</h1><p role="alert">No tenés acceso a esta sección.</p></main>
    else if(seccion==='productos')contenido=<CatalogoAdministrable client={client} negocio={negocio} onVolver={volver}/>
    else if(seccion==='pedidos')contenido=<PanelPedidos client={client} usuarioId={usuario.id} negocio={negocio} rol={acceso.rol} email={usuario.email} onVolver={volver} avisosExternos/>
    else if(seccion==='stock')contenido=<PanelStock client={client} negocio={negocio} usuarioId={usuario.id} onVolver={volver}/>
    else if(seccion==='clientes')contenido=<PanelClientes client={client} negocio={negocio} usuarioId={usuario.id} onVolver={volver}/>
    else if(seccion==='apariencia')contenido=<EditorApariencia client={client} negocio={negocio} onVolver={volver}/>
    else contenido=<ConfigEntregas client={client} negocio={negocio} onVolver={volver}/>
    return <PanelNegocio key={negocio.id} client={client} usuario={usuario} acceso={acceso} negocio={negocio} seccion={seccion} onSalir={salir}><div key={seccion+':'+negocio.permisos.join(',')+(seccion==='pedidos'&&ruta.includes('?nuevos=')?ruta.split('?')[1]:'')}>{error&&<p role="alert">{error}</p>}{contenido}</div></PanelNegocio>
  }
  const titulo = !acceso?.habilitada ? 'Acceso a tu cuenta' : acceso.rol === 'cliente' ? 'Mi cuenta de cliente' : acceso.rol === 'administrador' ? 'Administración del sistema' : 'Mis emprendimientos'
  const esAdmin = acceso?.rol === 'administrador'
  const esCliente = acceso?.rol === 'cliente'
  return <main className="dashboard-page business-platform">
    <header className="dashboard-topbar"><a className="store-brand" href="#/"><Marca /></a><div className="topbar-account"><span className="account-avatar" aria-hidden="true">{usuario.email?.[0]?.toUpperCase() ?? 'U'}</span><span className="account-email">{usuario.email}</span><button className="button button-outline" disabled={ocupado} onClick={salir}>Cerrar sesión</button></div></header>
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar" aria-label="Tu espacio"><p className="sidebar-label">TU ESPACIO</p><a className={ruta === "#/admin/usuarios" ? undefined : "sidebar-current"} href="#/cuenta"><span aria-hidden="true">▦</span> Resumen</a>{acceso?.habilitada && !esCliente && <a href="#/cuenta"><span aria-hidden="true">▤</span> Emprendimientos</a>}{esAdmin && acceso?.habilitada && <a href="#/admin/usuarios" className={ruta === "#/admin/usuarios" ? "sidebar-current" : undefined} aria-current={ruta === "#/admin/usuarios" ? "page" : undefined}>Usuarios y permisos</a>}<a href="#/emprendimientos"><span aria-hidden="true">↗</span> Explorar tiendas</a>{esCliente && <a href="#/cuenta"><span aria-hidden="true">◎</span> Mi perfil</a>}</aside>
      <div className="dashboard-content" id="resumen">
        {esAdmin && acceso?.habilitada && ruta === '#/admin/usuarios' ? <AdministracionCuentas client={client} negocios={acceso.negocios}/> : <>
        <section className={'welcome-panel welcome-' + (acceso?.habilitada ? acceso.rol : 'inactiva')}>
          <div><InsigniaRol rol={acceso?.rol} habilitada={acceso ? acceso.habilitada : true} /><h1>{titulo}</h1><p>{!acceso ? 'Estamos preparando tu espacio.' : !acceso.habilitada ? 'Necesitás una cuenta habilitada para continuar.' : esAdmin ? 'Una vista central de los emprendimientos, sus productos y pedidos.' : esCliente ? 'Este es tu espacio personal en EmpreGest.' : 'Elegí un emprendimiento para consultar sus productos y pedidos.'}</p></div>
          <span className="welcome-monogram" aria-hidden="true">{esAdmin ? 'A' : esCliente ? 'C' : 'E'}<span>.</span></span>
        </section>
        {error && <p role="alert" className="error-feedback">{error}</p>}
        {!acceso ? <section className="access-state">{!error && <p role="status">Comprobando acceso…</p>}<button className="button button-secondary" onClick={() => setIntento(intento + 1)}>Reintentar</button></section> :
          !acceso.habilitada ? <section className="access-state" id="mi-acceso"><span className="state-icon" aria-hidden="true">⊘</span><h2>Acceso pendiente de habilitación</h2><p role="alert">Tu cuenta no está habilitada. Contactá al administrador del sistema.</p><p>Podés cerrar sesión e ingresar con otra cuenta.</p></section> :
            esCliente ? <>
              <PerfilCliente client={client} usuario={usuario} />
            </> : <>
              {esAdmin && <dl className="dashboard-stats"><div><dt>{esAdmin ? 'Emprendimientos del sistema' : 'Emprendimientos asignados'}</dt><dd>{acceso.negocios.length.toString().padStart(2, '0')}</dd></div><div><dt>Con acceso a productos</dt><dd>{acceso.negocios.filter(n => n.permisos.includes('productos.ver')).length.toString().padStart(2, '0')}</dd></div><div><dt>Estado de tu cuenta</dt><dd className="stat-active"><span />Habilitada</dd></div></dl>}
              <section id="emprendimientos"><div className="section-heading"><div><span className="eyebrow">{esAdmin ? 'VISTA GENERAL' : 'TUS NEGOCIOS'}</span><h2>{esAdmin ? 'Emprendimientos' : 'Emprendimientos'}</h2></div><span className="section-count">{acceso.negocios.length} {acceso.negocios.length === 1 ? 'emprendimiento' : 'emprendimientos'}</span></div>
                {acceso.negocios.length === 0 ? <div className="access-state"><h3>Tu espacio está listo</h3><p>No tenés emprendimientos asignados. Contactá al administrador.</p></div> :
                  <div className="business-grid">{acceso.negocios.map(n=><article className="business-card" key={n.id}><h3>{n.nombre}</h3><p>{n.activo?'Activo':'Inactivo'}</p><button className="button button-primary" onClick={()=>navegar(rutaNegocio(n.id,inicioNegocio(n)))}>Abrir panel de {n.nombre}</button></article>)}</div>}
              </section>

            </>}
        </>}
      </div>
    </div>
  </main>
}
