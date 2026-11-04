import {useEffect,useState} from 'react'
import {Marca} from '../acceso/InterfazAcceso.jsx'
import {configuracionTienda} from './plantillaTienda.js'
import './plantillaTienda.css'

function ImagenIdentidad({src,ruta,archivo,client,nombre,tipo}) {
 const [imagen,setImagen]=useState(null),[fallida,setFallida]=useState(null)
 const origen=archivo||ruta||src
 useEffect(()=>{
  if(!archivo&&!ruta)return
  let vigente=true,url
  async function cargar(){
   try{
    const r=archivo?{data:archivo}:await client.storage.from('tiendas').download(ruta)
    if(r.error)throw r.error
    url=URL.createObjectURL(r.data)
    if(vigente)setImagen({origen,url});else URL.revokeObjectURL(url)
   }catch{if(vigente)setFallida(origen)}
  }
  cargar();return()=>{vigente=false;if(url)URL.revokeObjectURL(url)}
 },[archivo,ruta,client,origen])
 const url=archivo||ruta?(imagen?.origen===origen?imagen.url:null):src
 if(!url||fallida===origen)return tipo==='logo'
  ?<span className="shop-logo-fallback" aria-label={'Identidad de '+nombre}>{nombre.trim().slice(0,1).toUpperCase()}</span>
  :<div className="shop-cover-fallback" aria-hidden="true"><span/><span/><span/></div>
 return <img className={'shop-identity-'+tipo} src={url} alt={tipo==='logo'?'Logo de '+nombre:''} onError={()=>setFallida(origen)}/>
}
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
    <div className="shop-identity-title"><span className="shop-identity-label">TIENDA ONLINE</span><h1>{negocio.nombre}</h1><p>Productos y pedidos directamente con el emprendimiento.</p></div>
    <span className="shop-guest-label">Confirmá con tu cuenta de cliente</span>
   </div>
  </section>}
  <div id="store-main-content" tabIndex={-1}>{children}</div>
  <footer className="store-footer">{negocio?.nombre??'EmpreGest'} · Con EmpreGest</footer>
 </main>
}
