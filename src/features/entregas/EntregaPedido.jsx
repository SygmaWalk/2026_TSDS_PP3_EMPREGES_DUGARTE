import SelectorDireccion from '../cliente/SelectorDireccion.jsx'
import { useEffect,useRef,useState } from 'react'
import MapaPunto from './MapaPuntoLazy.jsx'
import { cargarConfiguracion,cotizarEntrega } from './entregasRepository.js'
import { formatearCentavos } from '../carrito/carrito.js'

function Envio({client,negocio,valor,onChange,disabled}) {
  const [carga,setCarga]=useState({cargando:true}),[reintento,setReintento]=useState(0)
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState('')
  const secuencia=useRef(0),activo=useRef(true)
  useEffect(()=>{activo.current=true;return()=>{activo.current=false}},[])
  useEffect(()=>{let vigente=true;cargarConfiguracion(client,negocio.id).then(config=>{if(vigente)setCarga({config})}).catch(e=>{if(vigente)setCarga({error:e.message})});return()=>{vigente=false}},[client,negocio.id,reintento])
  function cambiar(cambios){secuencia.current++;setOcupado(false);setError('');onChange({...valor,...cambios,cotizacion:null})}
  async function calcular(destino=valor){
    const actual=++secuencia.current;setOcupado(true);setError('')
    try{const cotizacion=await cotizarEntrega(client,negocio.id,destino.punto);if(activo.current&&actual===secuencia.current)onChange(v=>({...v,cotizacion}))}
    catch(e){if(activo.current&&actual===secuencia.current){setError(e.message);onChange(v=>({...v,cotizacion:null}))}}
    finally{if(activo.current&&actual===secuencia.current)setOcupado(false)}
  }
  function elegirDestino(cambios) {
    const destino = {...valor, ...cambios, cotizacion:null}
    cambiar(cambios)
    void calcular(destino)
  }
  function elegirGuardada(d) {
    if (!d) {
      cambiar({direccionId:'',direccion:'',referencia:'',punto:null})
      return
    }
    elegirDestino({direccionId:d.id,direccion:d.direccion,referencia:d.referencia,
      punto:{latitud:Number(d.latitud),longitud:Number(d.longitud)}})
  }
  const c=carga.config,origen=c?{latitud:Number(c.latitud),longitud:Number(c.longitud)}:null
  return <div className="delivery-form">
    <SelectorDireccion usarPredeterminada={!valor.punto&&valor.direccionId===undefined} client={client} seleccion={valor.direccionId} disabled={disabled} onSeleccion={elegirGuardada}/>
    <div className="field-group"><label htmlFor="envio-direccion">Dirección de entrega</label><input id="envio-direccion" value={valor.direccion} readOnly={Boolean(valor.direccionId)} onChange={e=>cambiar({direccion:e.target.value,direccionId:''})} required minLength={5} maxLength={200} autoComplete="street-address"/></div>
    <div className="field-group"><label htmlFor="envio-referencia">Referencia (opcional)</label><input id="envio-referencia" value={valor.referencia} onChange={e=>{const referencia=e.target.value;onChange(v=>({...v,referencia}))}} maxLength={300}/></div>
    {carga.cargando?<p role="status">Consultando cobertura…</p>:carga.error?<><p role="alert">{carga.error}</p><button className="button" type="button" onClick={()=>{setCarga({cargando:true});setReintento(v=>v+1)}}>Reintentar cobertura</button></>:!c?<p role="alert">El emprendimiento todavía no configuró sus entregas. Elegí retiro o consultá al negocio.</p>:<>
      <p className="field-help">Envíos desde {c.direccion_origen}. {c.modalidad==='zonas'?'Tarifa según la zona del destino.':'Cobertura hasta '+c.franjas.at(-1).hasta_m/1000+' km en línea recta.'}</p>
      {!valor.direccionId && <MapaPunto punto={valor.punto} onChange={punto=>cambiar({punto,direccionId:''})} origen={origen} radio={c.modalidad==='zonas'?null:c.franjas.at(-1).hasta_m} zonas={c.modalidad==='zonas'?c.zonas:[]} onDireccion={d=>elegirDestino({direccion:d.direccion,punto:{latitud:d.latitud,longitud:d.longitud},direccionId:''})} disabled={disabled}/>}
      {(!valor.direccionId || error || !valor.cotizacion) && <button className="button button-secondary" type="button" disabled={disabled||ocupado||!valor.punto||valor.direccion.trim().length<5} onClick={()=>calcular()}>{ocupado?'Calculando…':'Calcular envío'}</button>}
    </>}
    {error&&<p role="alert" className="error-feedback">{error}</p>}
    {valor.cotizacion&&<p role="status">Dentro de cobertura · {valor.cotizacion.franja} · {(valor.cotizacion.distancia_m/1000).toLocaleString('es-AR',{maximumFractionDigits:3})} km · Envío {formatearCentavos(valor.cotizacion.costo_centavos)}</p>}
  </div>
}
export default function EntregaPedido({client,negocio,valor,onChange,disabled,subtotal}) {
  return <section className="checkout-delivery"><h3>¿Cómo querés recibirlo?</h3>
    <div className="field-group"><label htmlFor="modalidad-entrega">Modalidad de entrega</label><select id="modalidad-entrega" value={valor.modalidad} onChange={e=>onChange({...valor,modalidad:e.target.value,cotizacion:null})}>
      <option value="retiro">Retiro en el emprendimiento</option><option value="envio">Envío a domicilio</option>
    </select></div>
    {valor.modalidad==='envio'?<Envio client={client} negocio={negocio} valor={valor} onChange={onChange} disabled={disabled}/>:<p>Sin costo de envío. Coordiná el lugar y el horario de retiro con el emprendimiento.</p>}
    <div className="cart-summary"><span>Envío</span><strong>{valor.modalidad==='retiro'?formatearCentavos(0):valor.cotizacion?formatearCentavos(valor.cotizacion.costo_centavos):'Pendiente de calcular'}</strong></div>
    {(valor.modalidad==='retiro'||valor.cotizacion)&&<div className="cart-summary"><span>Total a confirmar</span><strong>{formatearCentavos(subtotal+(valor.modalidad==='envio'?valor.cotizacion.costo_centavos:0))}</strong></div>}
  </section>
}
