import {lazy,Suspense,useEffect,useRef,useState} from 'react'
const MapaPunto=lazy(()=>import('./MapaPunto.jsx'))
const MapaGoogle=lazy(()=>import('./MapaGoogle.jsx'))
export default function MapaPuntoLazy(props) {
 const [error,setError]=useState(''),[buscando,setBuscando]=useState(false),activo=useRef(true),bloqueado=useRef(props.disabled),callback=useRef(props.onChange)
 useEffect(()=>{bloqueado.current=props.disabled;callback.current=props.onChange},[props.disabled,props.onChange])
 useEffect(()=>{activo.current=true;return()=>{activo.current=false}},[])
 function ubicar(){
  if(!navigator.geolocation){setError('Este navegador no permite consultar tu ubicación. Marcá el punto en el mapa.');return}
  setBuscando(true);setError('')
  navigator.geolocation.getCurrentPosition(p=>{if(!activo.current)return;setBuscando(false);if(!bloqueado.current)callback.current({latitud:Number(p.coords.latitude.toFixed(6)),longitud:Number(p.coords.longitude.toFixed(6))})},()=>{if(activo.current){setBuscando(false);setError('No pudimos obtener tu ubicación. Permití el acceso o marcá el punto en el mapa.')}},{enableHighAccuracy:true,timeout:10000,maximumAge:0})
 }
 const Componente=import.meta.env.VITE_GOOGLE_MAPS_ENABLED==='true'&&import.meta.env.VITE_GOOGLE_MAPS_API_KEY?MapaGoogle:MapaPunto
 return <div>{!props.soloLectura&&props.permitirUbicacion!==false&&<><button className="button button-secondary" type="button" disabled={props.disabled||buscando} onClick={ubicar}>{buscando?'Buscando ubicación…':'Usar mi ubicación actual'}</button><p className="field-help">Revisá el punto antes de guardarlo; la ubicación del dispositivo puede ser aproximada.</p></>}{error&&<p role="alert">{error}</p>}<Suspense fallback={<p role="status">Cargando mapa…</p>}><Componente {...props}/></Suspense></div>
}
