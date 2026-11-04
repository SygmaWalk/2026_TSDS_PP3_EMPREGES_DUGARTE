import {useCambiosSinGuardar} from '../../navigation.js'
import { useEffect,useState } from 'react'
import MapaPunto from './MapaPuntoLazy.jsx'
import { cargarConfiguracion,guardarConfiguracion,prepararConfiguracion } from './entregasRepository.js'

function Formulario({client,negocio,inicial}) {
  const [direccion,setDireccion]=useState(inicial?.direccion_origen??'')
  const [punto,setPunto]=useState(inicial?{latitud:Number(inicial.latitud),longitud:Number(inicial.longitud)}:null)
  const [filas,setFilas]=useState(inicial?.franjas.map(f=>({km:String(f.hasta_m/1000),precio:String(f.tarifa_centavos/100)}))??[{km:'',precio:''}])
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[guardado,setGuardado]=useState(false)
  const [original]=useState(()=>JSON.stringify({direccion,punto,filas}))
  useCambiosSinGuardar(ocupado||(!guardado&&JSON.stringify({direccion,punto,filas})!==original))
  function editar(i,campo,valor){setFilas(filas.map((f,n)=>n===i?{...f,[campo]:valor}:f))}
  async function guardar(e){
    e.preventDefault();setError('');setGuardado(false)
    try{const datos=prepararConfiguracion(negocio.id,direccion,punto,filas);setOcupado(true);await guardarConfiguracion(client,datos);setGuardado(true)}
    catch(fallo){setError(fallo.message)}finally{setOcupado(false)}
  }
  return <form className="panel delivery-settings product-form" onSubmit={guardar} onChange={()=>setGuardado(false)}>
    <fieldset className="form-fields" disabled={ocupado}>
      <h2>Origen de los envíos</h2><p>Esta dirección y el punto de origen serán visibles en la tienda. Indicá el lugar desde el que salen tus entregas.</p>
      <div className="field-group"><label htmlFor="origen-direccion">Dirección de origen</label><input id="origen-direccion" value={direccion} onChange={e=>setDireccion(e.target.value)} required minLength={5} maxLength={200}/></div>
      <MapaPunto punto={punto} onChange={p=>{setPunto(p);setGuardado(false)}} disabled={ocupado}/>
      <h2>Cobertura y tarifas</h2><p>Distancia en línea recta desde el origen; no representa el recorrido por calles ni un tiempo de entrega.</p>
      {filas.map((f,i)=><div className="delivery-band" key={i}>
        <p><strong>Franja {i+1}</strong><small>{i===0?'Desde 0 km':'Más de '+(filas[i-1].km||'…')+' km'}</small></p>
        <label>Hasta (km)<input aria-label={'Límite en km de franja '+(i+1)} inputMode="decimal" value={f.km} onChange={e=>editar(i,'km',e.target.value)} required/></label>
        <label>Tarifa ($)<input aria-label={'Tarifa de franja '+(i+1)} inputMode="decimal" value={f.precio} onChange={e=>editar(i,'precio',e.target.value)} required/></label>
        <button type="button" className="button button-secondary" disabled={filas.length===1} onClick={()=>{setFilas(filas.filter((_,n)=>n!==i));setGuardado(false)}} aria-label={'Quitar franja '+(i+1)}>Quitar</button>
      </div>)}
      <button type="button" className="button button-secondary" disabled={filas.length>=20} onClick={()=>{setFilas([...filas,{km:'',precio:''}]);setGuardado(false)}}>Agregar franja</button>
      <p className="field-help">El límite superior pertenece a esa franja. La última define la cobertura máxima (hasta 100 km). Una tarifa de $0 es válida.</p>
    </fieldset>
    <p>Los cambios se aplican a nuevos pedidos. Los pedidos registrados conservan la dirección y la tarifa originales.</p>
    {error&&<p className="error-feedback" role="alert">{error}</p>}
    {guardado&&<p role="status" className="success-feedback">Configuración de entregas guardada.</p>}
    <button className="button button-primary" disabled={ocupado} type="submit">{ocupado?'Guardando…':'Guardar entregas'}</button>
  </form>
}
export default function ConfigEntregas({client,negocio,onVolver}) {
  const [carga,setCarga]=useState({cargando:true}),[intento,setIntento]=useState(0)
  useEffect(()=>{let vigente=true;cargarConfiguracion(client,negocio.id).then(datos=>{if(vigente)setCarga({datos})}).catch(e=>{if(vigente)setCarga({error:e.message})});return()=>{vigente=false}},[client,negocio.id,intento])
  return <main className="app-shell delivery-shell"><button className="button button-secondary" onClick={onVolver}>Mis emprendimientos</button><header className="app-header"><div><span className="eyebrow">{negocio.nombre}</span><h1>Configurar entregas</h1><p>Definí desde dónde enviás, hasta dónde llegás y cuánto cuesta.</p></div></header>
    {carga.cargando?<p role="status">Cargando configuración…</p>:carga.error?<><p role="alert">{carga.error}</p><button className="button" onClick={()=>{setCarga({cargando:true});setIntento(v=>v+1)}}>Reintentar</button></>:<Formulario client={client} negocio={negocio} inicial={carga.datos}/>}
  </main>
}
