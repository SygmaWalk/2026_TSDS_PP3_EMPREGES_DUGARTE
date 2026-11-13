import {useEffect,useState} from 'react'
import MapaPunto from '../entregas/MapaPuntoLazy.jsx'
import {cargarDirecciones,guardarDireccion,eliminarDireccion} from './direccionesRepository.js'
const vacia={nombre:'',direccion:'',referencia:'',predeterminada:false}
export default function DireccionesCliente({client}) {
 const [lista,setLista]=useState([]),[cargando,setCargando]=useState(true),[error,setError]=useState(''),[mensaje,setMensaje]=useState('')
 const [datos,setDatos]=useState(null),[ocupado,setOcupado]=useState(false),[borrar,setBorrar]=useState(null),[intento,setIntento]=useState(0)
 useEffect(()=>{let activo=true;cargarDirecciones(client).then(d=>{if(activo)setLista(d)}).catch(e=>{if(activo)setError(e.message)}).finally(()=>{if(activo)setCargando(false)});return()=>{activo=false}},[client,intento])
 async function guardar(e){e.preventDefault();setError('');setMensaje('');setOcupado(true);try{await guardarDireccion(client,datos);setLista(await cargarDirecciones(client));setDatos(null);setMensaje('Dirección guardada. Podés elegirla al pedir un envío.')}catch(e){setError(e.message)}finally{setOcupado(false)}}
 async function quitar(){setError('');setMensaje('');setOcupado(true);try{await eliminarDireccion(client,borrar.id);setLista(lista.filter(d=>d.id!==borrar.id));setBorrar(null);setMensaje('Dirección eliminada. Los pedidos anteriores conservan su destino.')}catch(e){setError(e.message)}finally{setOcupado(false)}}
 return <section className="saved-addresses" aria-labelledby="direcciones-titulo"><h3 id="direcciones-titulo">Mis direcciones</h3><p>Guardá Casa, Trabajo u otros destinos y elegí uno al pedir un envío.</p>
 {cargando?<p>Cargando direcciones…</p>:<><ul className="address-list">{lista.map(d=><li key={d.id}><strong>{d.nombre}{d.predeterminada?' · Predeterminada':''}</strong><p>{d.direccion}</p>{d.referencia&&<p>{d.referencia}</p>}<button className="button button-secondary" disabled={ocupado||Boolean(datos)} onClick={()=>{setDatos({...d,latitud:Number(d.latitud),longitud:Number(d.longitud)});setBorrar(null);setMensaje('')}}>Editar {d.nombre}</button> <button className="button button-secondary" disabled={ocupado||Boolean(datos)} onClick={()=>setBorrar(d)}>Eliminar {d.nombre}</button></li>)}</ul>
 {!lista.length&&<p>Todavía no tenés direcciones guardadas.</p>}
 {!datos&&<button className="button button-secondary" disabled={ocupado} onClick={()=>{setDatos({...vacia,predeterminada:!lista.length});setBorrar(null);setMensaje('')}}>Agregar dirección</button>}</>}
 {borrar&&<div role="group" aria-label="Confirmar eliminación"><p>¿Eliminar {borrar.nombre} de tus direcciones?</p><button className="button" disabled={ocupado} onClick={quitar}>Sí, eliminar dirección</button><button className="button" disabled={ocupado} onClick={()=>setBorrar(null)}>Cancelar</button></div>}
 {datos&&<form className="product-form" onSubmit={guardar}><fieldset className="form-fields" disabled={ocupado}>
 <legend>{datos.id ? "Editar dirección" : "Nueva dirección"}</legend>
 <p className="field-help">Elegí un lugar en el mapa o usá tu ubicación actual. Revisá la calle y el número antes de guardar.</p>
 <MapaPunto punto={Number.isFinite(datos.latitud)?{latitud:datos.latitud,longitud:datos.longitud}:null} onChange={p=>setDatos(d=>({...d,...p}))} onDireccion={d=>setDatos(v=>({...v,...d}))} disabled={ocupado}/>
 <label>Nombre de la dirección<input required maxLength={60} value={datos.nombre} onChange={e=>setDatos({...datos,nombre:e.target.value})} placeholder="Casa o Trabajo"/></label>
 <label>Dirección guardada<input required minLength={5} maxLength={200} autoComplete="street-address" value={datos.direccion} onChange={e=>setDatos({...datos,direccion:e.target.value})}/></label>
 <label>Piso, departamento o referencia<input maxLength={300} value={datos.referencia} onChange={e=>setDatos({...datos,referencia:e.target.value})}/></label>
 <label><input type="checkbox" checked={datos.predeterminada} onChange={e=>setDatos({...datos,predeterminada:e.target.checked})}/> Usar como predeterminada</label>
 <button className="button button-primary" type="submit">{ocupado?'Guardando…':'Guardar dirección'}</button><button className="button button-secondary" type="button" onClick={()=>setDatos(null)}>Cancelar edición</button>
 </fieldset></form>}
 {error&&<><p role="alert">{error}</p><button type="button" className="button" disabled={ocupado} onClick={()=>{setError('');setIntento(i=>i+1)}}>Actualizar direcciones</button></>}{mensaje&&<p role="status">{mensaje}</p>}
 </section>
}
