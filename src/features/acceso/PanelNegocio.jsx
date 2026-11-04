import {useCallback,useEffect,useMemo,useState} from 'react'
import {Marca} from './InterfazAcceso.jsx'
import {Avisos} from '../pedidos/PanelPedidos.jsx'
import {crearPanelPedidosRepository} from '../pedidos/panelPedidosRepository.js'
import {SECCIONES,navegar,rutaNegocio,inicioNegocio} from '../../navigation.js'
import './panel.css'
export default function PanelNegocio({client,usuario,acceso,negocio,seccion,onSalir,children}){
 const [menu,setMenu]=useState(false)
 const repository=useMemo(()=>crearPanelPedidosRepository(client,negocio.id,usuario.id),[client,negocio.id,usuario.id])
 const actualizar=useCallback(()=>window.dispatchEvent(new Event('empreges:pedidos')),[])
 const nuevos=useCallback(()=>navegar(rutaNegocio(negocio.id,'pedidos')+'?nuevos='+Date.now()),[negocio.id])
 useEffect(()=>{try{localStorage.setItem('empreges:negocio:'+usuario.id,String(negocio.id))}catch{/* La navegación funciona sin almacenamiento. */}},[negocio.id,usuario.id])
 function enlace(e,ruta){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(navegar(ruta))setMenu(false)}
 return <div className="business-app">
 <header className="business-header tw:flex tw:items-center tw:justify-between tw:gap-4 tw:px-5 tw:py-3"><Marca/><button className="button button-outline mobile-menu" aria-expanded={menu} aria-controls="business-sidebar" onClick={()=>setMenu(!menu)}>Menú</button><div className="tw:flex tw:items-center tw:gap-3"><span className="business-account">{usuario.email}</span><button className="button button-outline" onClick={onSalir}>Cerrar sesión</button></div></header>
 <aside id="business-sidebar" className={'business-sidebar '+(menu?'is-open':'')} aria-label="Navegación del emprendimiento">
 <label htmlFor="negocio-actual">Emprendimiento</label><select id="negocio-actual" value={negocio.id} onChange={e=>{const n=acceso.negocios.find(n=>String(n.id)===e.target.value);if(navegar(rutaNegocio(n.id,inicioNegocio(n))))setMenu(false)}}>{acceso.negocios.map(n=><option key={n.id} value={n.id}>{n.nombre}{n.activo?'':' (inactivo)'}</option>)}</select>
 <nav className="tw:flex tw:flex-col tw:gap-2">{SECCIONES.filter(s=>negocio.permisos.includes(s[2])).map(([id,titulo])=><a key={id} href={rutaNegocio(negocio.id,id)} onClick={e=>enlace(e,rutaNegocio(negocio.id,id))} aria-current={id===seccion?'page':undefined}>{titulo}</a>)}</nav>
 <div className="sidebar-bottom">{negocio.activo&&<a href={'#/tienda/'+negocio.slug} target="_blank" rel="noreferrer">Ver tienda pública ↗</a>}{acceso.rol==='administrador'&&<a href="#/cuenta" onClick={e=>enlace(e,'#/cuenta')}>Administración</a>}</div>
 </aside>
 <div className="business-body"><div className="business-context"><strong>{negocio.nombre}</strong>{!negocio.activo&&<span>Tienda inactiva</span>}</div>
 {negocio.permisos.includes('pedidos.ver')&&<Avisos repository={repository} onActualizar={actualizar} onVerNuevos={nuevos}/>}
 <div className="business-section">{children}</div>
 </div>
 </div>
}
