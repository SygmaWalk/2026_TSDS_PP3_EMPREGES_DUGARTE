import { useEffect, useRef, useState, useId } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { puntoValido } from './entregasRepository.js'

export default function MapaPunto({punto,onChange,origen,radio,disabled=false,soloLectura=false}) {
  const contenedor=useRef(null),mapa=useRef(null),marcas=useRef(null),callback=useRef(onChange),bloqueado=useRef(disabled)
  const [error,setError]=useState(''),[lat,setLat]=useState(''),[lng,setLng]=useState('')
  const id=useId()
  useEffect(()=>{callback.current=onChange;bloqueado.current=disabled||soloLectura},[onChange,disabled,soloLectura])
  useEffect(()=>{
    const m=L.map(contenedor.current,{scrollWheelZoom:false}).setView([-34.6037,-58.3816],11)
    mapa.current=m
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'})
      .on('tileerror',()=>setError('El mapa no pudo cargar algunas imágenes. La ubicación seleccionada se conserva.')).addTo(m)
    marcas.current=L.layerGroup().addTo(m)
    m.on('click',e=>{if(!bloqueado.current) callback.current({latitud:Number(e.latlng.lat.toFixed(6)),longitud:Number(e.latlng.lng.toFixed(6))})})
    return()=>{m.remove();mapa.current=null}
  },[])
  useEffect(()=>{
    const m=mapa.current
    if(!m)return
    marcas.current.clearLayers()
    if(puntoValido(origen)) {
      L.circleMarker([origen.latitud,origen.longitud],{radius:7,color:'#235f58'}).bindTooltip(soloLectura?'Origen':'Origen del emprendimiento',{permanent:soloLectura,direction:'top'}).addTo(marcas.current)
      if(radio)L.circle([origen.latitud,origen.longitud],{radius:radio,color:'#235f58',weight:1,fillOpacity:0.05}).addTo(marcas.current)
    }
    if(puntoValido(punto))L.circleMarker([punto.latitud,punto.longitud],{radius:9,color:'#a93829',fillOpacity:0.8}).bindTooltip(soloLectura?'Destino':'Punto seleccionado',{permanent:soloLectura,direction:'top'}).addTo(marcas.current)
    const centro=punto??origen
    function encuadrar(){
      if(soloLectura&&puntoValido(punto)&&puntoValido(origen))m.fitBounds([[origen.latitud,origen.longitud],[punto.latitud,punto.longitud]],{padding:[45,45],maxZoom:16,animate:false})
      else if(puntoValido(centro))m.setView([centro.latitud,centro.longitud],14,{animate:false})
    }
    encuadrar()
    const observer=new ResizeObserver(()=>{m.invalidateSize();if(soloLectura)encuadrar()})
    observer.observe(contenedor.current)
    return()=>observer.disconnect()
  },[punto,origen,radio,soloLectura])
  function ubicar(){
    const nuevo={latitud:Number(lat.replace(',','.')),longitud:Number(lng.replace(',','.'))}
    if(!lat.trim()||!lng.trim()||!puntoValido(nuevo)){setError('Ingresá una latitud entre −90 y 90 y una longitud entre −180 y 180.');return}
    setError('');onChange({latitud:Number(nuevo.latitud.toFixed(6)),longitud:Number(nuevo.longitud.toFixed(6))})
  }
  return <div className="map-selector">
    {!soloLectura&&<p className="field-help">Tocá el mapa para marcar el punto exacto. La dirección escrita no se ubica automáticamente.</p>}
    <div ref={contenedor} className="delivery-map" aria-label={soloLectura?"Mapa de la entrega registrada":"Mapa para seleccionar ubicación"}/>
    {!soloLectura&&<><p className="field-help">{punto ? 'Punto seleccionado: '+punto.latitud+', '+punto.longitud : 'Todavía no seleccionaste un punto.'}</p>
    <details><summary>Indicar coordenadas manualmente</summary><div className="coordinate-fields">
      <label htmlFor={id+'lat'}>Latitud<input id={id+'lat'} inputMode="decimal" value={lat} disabled={disabled} onChange={e=>setLat(e.target.value)}/></label>
      <label htmlFor={id+'lng'}>Longitud<input id={id+'lng'} inputMode="decimal" value={lng} disabled={disabled} onChange={e=>setLng(e.target.value)}/></label>
      <button className="button button-secondary" type="button" disabled={disabled} onClick={ubicar}>Ubicar punto</button>
    </div></details></>}
    {error&&<p role="status">{error}</p>}
  </div>
}
