import {useCambiosSinGuardar} from '../../navigation.js'
import DistribucionCatalogo from './DistribucionCatalogo.jsx'
import {useEffect,useMemo,useState,useRef} from 'react'
import {Marca} from '../acceso/InterfazAcceso.jsx'
import {crearAparienciaRepository} from './aparienciaRepository.js'
import {paraPlantilla,validarColores} from './apariencia.js'
import {validarImagen} from '../productos/imagenes.js'
import {cargarTienda} from '../catalogo/catalogoRepository.js'
import VistaPreviaTienda from './VistaPreviaTienda.jsx'
import './apariencia.css'
export default function EditorApariencia({client,negocio,onVolver}){
 const repo=useMemo(()=>crearAparienciaRepository(client,negocio.id),[client,negocio.id])
 const [registro,setRegistro]=useState(null),[form,setForm]=useState(null),[archivos,setArchivos]=useState({}),[productos,setProductos]=useState([]),[catalogo,setCatalogo]=useState([])
 const [error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false),[sucio,setSucio]=useState(false),[preview,setPreview]=useState(null),[recarga,setRecarga]=useState(0)
 useCambiosSinGuardar(sucio||ocupado)
 const trabajando=useRef(false)
 useEffect(()=>{
  let vigente=true
  Promise.all([repo.cargar(),cargarTienda(client,negocio.slug),repo.catalogo()]).then(([r,t,c])=>{if(vigente){setCatalogo(c);setRegistro(r);setForm({...r.borrador,orden_productos:(r.borrador.orden_productos??[]).filter(id=>c.some(p=>p.id===id))});setArchivos({});setProductos(t?.productos??[]);setSucio(false);setError('');setPreview(null)}}).catch(e=>{if(vigente)setError(e.message)})
  return()=>{vigente=false}
 },[repo,client,negocio.slug,recarga])
 function cambiar(c){setForm(f=>({...f,...c}));setSucio(true);setMensaje('');setPreview(null)}
 async function imagen(e,campo){
  const archivo=e.target.files?.[0];if(!archivo)return
  try{
   validarImagen(archivo)
   const bitmap=await createImageBitmap(archivo);bitmap.close()
   setArchivos(a=>({...a,[campo]:archivo}));cambiar({[campo]:null});setError('')
  }catch{setError('Elegí una imagen JPG, PNG o WebP válida, de hasta 5 MB.')}
  e.target.value=''
 }
 async function guardar(){
  if(trabajando.current)return
  trabajando.current=true;setOcupado(true);setError('');setMensaje('')
  try{
   validarColores(form.color_principal,form.color_fondo)
   const datos={...form}
   for(const campo of ['logo_path','portada_path'])if(archivos[campo])datos[campo]=await repo.subir(archivos[campo])
   const r=await repo.guardar(registro.version,datos);setRegistro(r);setForm(r.borrador);setArchivos({});setSucio(false);setPreview(null);setMensaje('Borrador guardado. La tienda pública conserva su versión anterior.')
  }catch(e){setError(e.message)}finally{trabajando.current=false;setOcupado(false)}
 }
 async function publicar(){
  if(trabajando.current||sucio)return
  trabajando.current=true;setOcupado(true);setError('');setMensaje('')
  try{const r=await repo.publicar(registro.version);setRegistro(r);setMensaje('La identidad de tu tienda quedó publicada.')}
  catch(e){setError(e.message)}finally{trabajando.current=false;setOcupado(false)}
 }
 function previsualizar(){
  try{validarColores(form.color_principal,form.color_fondo);setError('');setPreview(paraPlantilla(negocio.id,form,archivos))}
  catch(e){setError(e.message)}
 }
 return <main className="workspace-page"><header className="dashboard-topbar"><Marca/><button className="button button-outline" disabled={ocupado} onClick={onVolver}>Volver al panel</button></header><div className="app-shell">
  <header className="app-header"><div><h1>Identidad de la tienda</h1><p>{negocio.nombre}</p></div>{negocio.activo&&<a className="button button-secondary" href={'#/tienda/'+negocio.slug} target="_blank" rel="noreferrer">Ver tienda pública ↗</a>}</header>
  {error&&<p role="alert" className="error-feedback">{error}</p>}{mensaje&&<p role="status" className="feedback">{mensaje}</p>}
  {!form?<><p>Cargando configuración…</p>{error&&<button className="button" onClick={()=>setRecarga(r=>r+1)}>Reintentar</button>}</>:<>
   <section className="panel appearance-editor"><fieldset className="form-fields" disabled={ocupado}><legend>Identidad visual</legend>
    <div className="appearance-images">{[['logo_path','Logo'],['portada_path','Portada']].map(([campo,nombre])=><div className="field-group" key={campo}>
     <label htmlFor={campo}>{nombre}</label><input id={campo} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>imagen(e,campo)}/>
     <small>{archivos[campo]?.name??(form[campo]?'Imagen guardada':'Imagen predeterminada')} · JPG, PNG o WebP, hasta 5 MB.</small>
     {(form[campo]||archivos[campo])&&<button className="button button-secondary" onClick={()=>{setArchivos(a=>({...a,[campo]:null}));cambiar({[campo]:null})}}>Quitar {nombre.toLowerCase()}</button>}
    </div>)}</div>
    <div className="appearance-colors">{[['color_principal','Color principal'],['color_fondo','Color de fondo']].map(([campo,nombre])=><div className="field-group" key={campo}><label htmlFor={campo}>{nombre}</label><div className="color-input"><input type="color" id={campo} value={form[campo]} onChange={e=>cambiar({[campo]:e.target.value})}/><span>{form[campo]}</span></div></div>)}</div>
    <p className="field-help">Usá un color principal oscuro y un fondo claro. Comprobaremos la legibilidad antes de guardar.</p>
    <DistribucionCatalogo productos={catalogo} form={form} onCambiar={cambiar}/><div className="form-actions"><button className="button button-primary" onClick={guardar}>{ocupado?'Procesando…':'Guardar borrador'}</button><button className="button button-secondary" onClick={previsualizar}>Previsualizar</button><button className="button button-primary" disabled={sucio||!registro.version} onClick={publicar}>Publicar</button></div>
    {sucio&&<p>Hay cambios sin guardar. Guardá el borrador antes de publicar.</p>}
    <button className="button button-secondary" onClick={()=>{if(!sucio||window.confirm('¿Descartar los cambios sin guardar y cargar el borrador vigente?'))setRecarga(r=>r+1)}}>Recargar borrador</button>
   </fieldset></section>
   {preview&&<VistaPreviaTienda client={client} negocio={negocio} identidad={preview} productos={productos}/>}
  </>}
 </div></main>
}
