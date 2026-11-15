import ImagenIdentidad from './ImagenIdentidad.jsx'
import {Marca} from '../acceso/InterfazAcceso.jsx'
import {configuracionTienda} from './plantillaTienda.js'
import './plantillaTienda.css'

export default function PlantillaTienda({negocio,usuario,publicada,children,client}) {
 const config=configuracionTienda(negocio,publicada)
 return <main className="store-page storefront-template" style={{'--store-accent':config.colorPrincipal,'--store-background':config.colorFondo}}>
  <button className="store-skip" onClick={event => event.currentTarget.ownerDocument.getElementById('store-main-content')?.focus()}>Ir al contenido de la tienda</button>
  <header className="dashboard-topbar">
   <a className="store-brand" href="#/" aria-label="EmpreGest, inicio"><Marca/></a>
   <nav className="public-links" aria-label="Navegación principal"><a href="#/emprendimientos">Explorar tiendas</a><a className="store-access-link" href={usuario?'#/cuenta':'#/ingresar'}>{usuario?'Mi cuenta ↗':'Ingresar ↗'}</a></nav>
  </header>
  {negocio&&<section className="shop-identity" aria-label={'Tienda '+negocio.nombre}>
   <div className="shop-identity-cover"><ImagenIdentidad key={'portada:'+config.portadaUrl} src={config.portadaUrl} ruta={config.portadaPath} archivo={config.portadaArchivo} client={client} nombre={negocio.nombre} tipo="portada"/></div>
   <div className="store-container shop-identity-heading">
    <div className="shop-identity-logo"><ImagenIdentidad key={'logo:'+config.logoUrl} src={config.logoUrl} ruta={config.logoPath} archivo={config.logoArchivo} client={client} nombre={negocio.nombre} tipo="logo"/></div>
    <div className="shop-identity-title"><h1>{negocio.nombre}</h1></div>
    
   </div>
  </section>}
  <div id="store-main-content" tabIndex={-1}>{children}</div>
  <footer className="store-footer">{negocio?.nombre??'EmpreGest'} · Con EmpreGest</footer>
 </main>
}
