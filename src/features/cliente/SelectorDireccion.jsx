import {useEffect,useState,useRef} from 'react'
import {cargarDirecciones} from './direccionesRepository.js'
export default function SelectorDireccion({client,seleccion,onSeleccion,disabled,usarPredeterminada}) {
 const callback=useRef(onSeleccion),inicial=useRef(usarPredeterminada)
 useEffect(()=>{callback.current=onSeleccion;if(!usarPredeterminada)inicial.current=false},[onSeleccion,usarPredeterminada])
 const [estado,setEstado]=useState({cargando:true}),[intento,setIntento]=useState(0)
 useEffect(()=>{let activo=true;cargarDirecciones(client).then(lista=>{if(activo){setEstado({lista});if(inicial.current){inicial.current=false;const d=lista.find(d=>d.predeterminada);if(d)callback.current(d)}}}).catch(e=>{if(activo)setEstado({error:e.message})});return()=>{activo=false}},[client,intento])
 if(estado.cargando)return <p>Cargando tus direcciones…</p>
 if(estado.error)return <div><p role="alert">{estado.error}</p><button className="button" type="button" onClick={()=>setIntento(i=>i+1)}>Reintentar direcciones</button></div>
 return <div className="field-group"><label htmlFor="direccion-guardada">Mis direcciones guardadas</label><select id="direccion-guardada" disabled={disabled} value={seleccion??''} onChange={e=>onSeleccion(estado.lista.find(d=>d.id===e.target.value)??null)}><option value="">Indicar otra dirección para este pedido</option>{estado.lista.map(d=><option value={d.id} key={d.id}>{d.nombre}{d.predeterminada?' (predeterminada)':''} — {d.direccion}</option>)}</select><small>Podés guardar y editar tus destinos en Mi perfil. La dirección elegida se copia al pedido.</small></div>
}
