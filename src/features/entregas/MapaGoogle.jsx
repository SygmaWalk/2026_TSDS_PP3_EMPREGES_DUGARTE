import {useEffect,useRef,useState,useId} from 'react'
import {cargarGoogleMaps} from './googleMaps.js'
import {puntoValido} from './entregasRepository.js'
const VACIAS=[]
const coord=p=>({lat:p.latitud,lng:p.longitud})
export default function MapaGoogle({punto,onChange,onDireccion,origen,radio,zonas=VACIAS,disabled=false,soloLectura=false}){
 const contenedor=useRef(null),buscador=useRef(null),api=useRef(null),mapa=useRef(null),eventos=useRef({}),elemento=useRef(null)
 const [listo,setListo]=useState(false),[error,setError]=useState(''),[lat,setLat]=useState(''),[lng,setLng]=useState('');const id=useId()
 const buscar=Boolean(onDireccion)&&!soloLectura
 useEffect(()=>{eventos.current={onChange,onDireccion,disabled:disabled||soloLectura};if(elemento.current)elemento.current.disabled=disabled},[onChange,onDireccion,disabled,soloLectura])
 useEffect(()=>{
  let activo=true,click,observador,autocomplete,secuencia=0
  const fallo=()=>setError('Google Maps no está autorizado. Revisá la clave, las APIs habilitadas y los sitios permitidos.')
  window.addEventListener('empreges-maps-error',fallo)
  cargarGoogleMaps().then(async g=>{
   const [maps,marker]=await Promise.all([g.importLibrary('maps'),g.importLibrary('marker')]);if(!activo)return
   api.current={...maps,...marker,event:g.event}
   const m=new maps.Map(contenedor.current,{center:{lat:-34.6037,lng:-58.3816},zoom:11,mapId:import.meta.env.VITE_GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false,gestureHandling:'cooperative'})
   mapa.current=m;setListo(true)
   click=m.addListener('click',e=>{if(!eventos.current.disabled){secuencia++;eventos.current.onChange?.({latitud:Number(e.latLng.lat().toFixed(6)),longitud:Number(e.latLng.lng().toFixed(6))})}})
   observador=new ResizeObserver(()=>g.event.trigger(m,'resize'));observador.observe(contenedor.current)
   if(buscar){
    const {PlaceAutocompleteElement}=await g.importLibrary('places');if(!activo)return
    autocomplete=new PlaceAutocompleteElement();autocomplete.placeholder='Buscar dirección en Google Maps';autocomplete.disabled=eventos.current.disabled;autocomplete.setAttribute('aria-label','Buscar dirección en Google Maps');elemento.current=autocomplete;buscador.current.appendChild(autocomplete)
    autocomplete.addEventListener('gmp-error',()=>{if(activo)setError('No se pudo buscar la dirección. Podés escribirla y marcar el punto en el mapa.')})
    autocomplete.addEventListener('gmp-select',async({placePrediction})=>{
     const actual=++secuencia
     try{const lugar=placePrediction.toPlace();await lugar.fetchFields({fields:['formattedAddress','location']});if(!activo||actual!==secuencia||eventos.current.disabled)return
      if(!lugar.location)throw new Error('sin ubicación')
      eventos.current.onDireccion({direccion:lugar.formattedAddress??'',latitud:Number(lugar.location.lat().toFixed(6)),longitud:Number(lugar.location.lng().toFixed(6))});setError('')
     }catch{if(activo)setError('No se pudo obtener el punto. Elegí otro resultado o marcalo en el mapa.')}
    })
   }
  }).catch(e=>{if(activo)setError(e.message)})
  return()=>{activo=false;click?.remove();observador?.disconnect();autocomplete?.remove();elemento.current=null;if(mapa.current)window.google.maps.event.clearInstanceListeners(mapa.current);mapa.current=null;window.removeEventListener('empreges-maps-error',fallo)}
 },[buscar])
 useEffect(()=>{
  if(!listo||!mapa.current)return
  const g=api.current,m=mapa.current,figuras=[],marcas=[]
  for(const z of zonas){if([z.sur,z.norte,z.oeste,z.este].every(Number.isFinite))figuras.push(new g.Rectangle({map:m,bounds:{south:z.sur,north:z.norte,west:z.oeste,east:z.este},strokeColor:'#235f58',fillColor:'#235f58',fillOpacity:.12,strokeWeight:2,clickable:false}))}
  for(const [p,titulo] of [[origen,'Origen del emprendimiento'],[punto,'Punto seleccionado']])if(puntoValido(p))marcas.push(new g.AdvancedMarkerElement({map:m,position:coord(p),title:titulo}))
  if(puntoValido(origen)&&radio)figuras.push(new g.Circle({map:m,center:coord(origen),radius:radio,strokeColor:'#235f58',fillOpacity:.05,clickable:false}))
  if(soloLectura&&puntoValido(origen)&&puntoValido(punto)){const b=new window.google.maps.LatLngBounds();b.extend(coord(origen));b.extend(coord(punto));m.fitBounds(b,45)}
  else if(puntoValido(punto??origen)){m.setCenter(coord(punto??origen));m.setZoom(14)}
  return()=>{figuras.forEach(f=>f.setMap(null));marcas.forEach(m=>{m.map=null})}
 },[listo,punto,origen,radio,zonas,soloLectura])
 function ubicar(){const p={latitud:Number(lat.replace(',','.')),longitud:Number(lng.replace(',','.'))};if(!lat.trim()||!lng.trim()||!puntoValido(p)){setError('Ingresá coordenadas válidas.');return}onChange({latitud:Number(p.latitud.toFixed(6)),longitud:Number(p.longitud.toFixed(6))})}
 return <div className="map-selector">{buscar&&<div className="map-search" ref={buscador}/>}{!soloLectura&&<p className="field-help">Tocá el mapa para marcar el punto exacto. Revisá que coincida con la dirección escrita.</p>}<div className="delivery-map" ref={contenedor} aria-label={soloLectura?'Mapa de la entrega registrada':'Mapa para seleccionar ubicación'}/>
 {!soloLectura&&<><p>{punto?'Punto seleccionado: '+punto.latitud+', '+punto.longitud:'Todavía no seleccionaste un punto.'}</p><details><summary>Indicar coordenadas manualmente</summary><div className="coordinate-fields"><label htmlFor={id+'lat'}>Latitud<input id={id+'lat'} disabled={disabled} value={lat} onChange={e=>setLat(e.target.value)} inputMode="decimal"/></label><label htmlFor={id+'lng'}>Longitud<input id={id+'lng'} disabled={disabled} value={lng} onChange={e=>setLng(e.target.value)} inputMode="decimal"/></label><button className="button" type="button" disabled={disabled} onClick={ubicar}>Ubicar punto</button></div></details></>}{error&&<p role="alert">{error}</p>}</div>
}
