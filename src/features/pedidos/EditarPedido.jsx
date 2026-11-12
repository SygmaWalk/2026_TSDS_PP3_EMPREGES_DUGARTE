import {useEffect,useState} from 'react'
import {formatearCentavos as importe} from '../carrito/carrito.js'
import MapaPunto from '../entregas/MapaPuntoLazy.jsx'

function Lineas({items}) {
 return <ul className="order-lines">{items.map(i=><li key={i.producto_id}><span>{i.cantidad} × {i.nombre}{i.adicionales?.length>0&&<small>{i.adicionales.map(a=>a.nombre).join(', ')}</small>}{i.promocion&&<small>{i.promocion.nombre}</small>}</span><strong>{importe(i.cantidad*i.precio_centavos)}</strong></li>)}</ul>
}
function Resumen({datos}) {
 return <><Lineas items={datos.items}/><p>Subtotal: {importe(datos.subtotal_centavos)} · Envío: {importe(datos.costo_envio_centavos)} · <strong>Total: {importe(datos.total_centavos)}</strong></p><p>{datos.entrega?.modalidad==='envio'?'Entrega en '+datos.entrega.direccion+(datos.entrega.referencia?' · '+datos.entrega.referencia:'')+(datos.entrega.franja?' · '+datos.entrega.franja:''):'Retiro en el emprendimiento'}</p></>
}
function ImpactoStock({movimientos}) {
 return movimientos.length?<ul>{movimientos.map(m=><li key={m.producto_id}>{m.nombre}: {m.sin_reintegrar>0?m.sin_reintegrar+' sin devolver al stock':m.cantidad<0?'descontar '+(-m.cantidad):'devolver '+m.cantidad}</li>)}</ul>:<p>Sin cambios en las existencias.</p>
}
export function HistorialModificaciones({repository,id,version}) {
 const [abierto,setAbierto]=useState(false),[estado,setEstado]=useState({}),[intento,setIntento]=useState(0)
 useEffect(()=>{if(!abierto)return;let activo=true;repository.modificaciones(id).then(lista=>{if(activo)setEstado({lista})}).catch(e=>{if(activo)setEstado({error:e.message})});return()=>{activo=false}},[abierto,id,repository,version,intento])
 return <details className="order-history" onToggle={e=>setAbierto(e.currentTarget.open)}><summary>Modificaciones del pedido</summary>{abierto&&(estado.error?<><p role="alert">{estado.error}</p><button className="button" onClick={()=>setIntento(n=>n+1)}>Reintentar historial</button></>:!estado.lista?<p>Cargando modificaciones…</p>:!estado.lista.length?<p>Este pedido no tiene modificaciones.</p>:<ol>{estado.lista.map(h=><li key={h.id}><strong>{new Date(h.fecha).toLocaleString('es-AR')} · {h.motivo}</strong><p>Cuenta interna: {h.usuario_id??'Cuenta eliminada'}</p><details><summary>Ver versión anterior y nueva</summary><h4>Antes</h4><Resumen datos={h.anterior}/><h4>Después</h4><Resumen datos={h.nuevo}/><h4>Stock</h4><ImpactoStock movimientos={h.respuesta.stock}/></details></li>)}</ol>)}</details>
}
export default function EditarPedido({pedido,repository,onCerrar,onGuardado}) {
 const [base]=useState(()=>pedido)
 const [catalogo,setCatalogo]=useState(null),[intento,setIntento]=useState(0),[falloCarga,setFalloCarga]=useState('')
 const [lineas,setLineas]=useState(()=>base.detalles_pedido.map(d=>({producto_id:d.producto_id,cantidad:String(d.cantidad),adicionales:(d.adicionales??[]).map(a=>a.id)})))
 const [entrega,setEntrega]=useState(()=>({...base.entrega,modalidad:base.entrega?.modalidad??'retiro'})),[motivo,setMotivo]=useState(''),[devolver,setDevolver]=useState(false)
 const [ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(null),[incierto,setIncierto]=useState(false)
 const obsoleto=base.revision!==pedido.revision
 useEffect(()=>{let activo=true;repository.catalogoEdicion().then(d=>{if(activo){setCatalogo(d);setFalloCarga('')}}).catch(e=>{if(activo)setFalloCarga(e.message)});return()=>{activo=false}},[repository,intento])
 function invalidar(){setRevision(null);setError('')}
 function editar(i,d){invalidar();setLineas(f=>f.map((x,n)=>n===i?{...x,...d}:x))}
 function destino(d){invalidar();setEntrega(v=>({...v,...d}))}
 async function revisar(e){e.preventDefault();if(ocupado||obsoleto)return;setError('');setRevision(null);setOcupado(true)
  try{const datos={p_pedido:base.id,p_revision:base.revision,p_clave:crypto.randomUUID(),p_items:lineas.map(l=>({...l,cantidad:Number(l.cantidad)})),p_entrega:entrega.modalidad==='envio'?{modalidad:'envio',direccion:entrega.direccion,referencia:entrega.referencia??'',latitud:entrega.latitud,longitud:entrega.longitud}:{modalidad:'retiro'},p_motivo:motivo.trim(),p_devolver:devolver,p_huella:null};const resumen=await repository.modificar(datos);setRevision({datos:{...datos,p_huella:resumen.huella},resumen})}
  catch(e){setError(e.message)}finally{setOcupado(false)}
 }
 async function guardar(){if(!revision||ocupado)return;setOcupado(true);setError('');try{await repository.modificar(revision.datos,true);onGuardado()}catch(e){setError(e.message);if(e.definitivo){setRevision(null);setIncierto(false)}else setIncierto(true)}finally{setOcupado(false)}}
 return <section className="order-edit" aria-label={'Editar pedido #'+base.id}><h3>Modificar pedido #{base.id}</h3><p>Revisá los productos, la entrega y el motivo del cambio. La revisión usa los precios y tarifas vigentes.</p>
 {obsoleto&&!incierto&&<p role="alert">Este pedido cambió desde que abriste la edición. Cerrá y volvé a abrir para revisar su versión actual.</p>}
 {falloCarga?<><p role="alert">{falloCarga}</p><button className="button" onClick={()=>setIntento(i=>i+1)}>Reintentar catálogo</button></>:!catalogo?<p role="status">Cargando catálogo vigente…</p>:<form onSubmit={revisar}><fieldset className="form-fields" disabled={ocupado||obsoleto||incierto}>
 {lineas.map((l,i)=>{const producto=catalogo.find(c=>c.id===l.producto_id),anterior=base.detalles_pedido.find(d=>d.producto_id===l.producto_id);return <fieldset key={i} className="edit-line"><legend>Producto {i+1}</legend><label>Producto de línea {i+1}<select aria-label={'Producto de línea '+(i+1)} value={l.producto_id||''} required onChange={e=>editar(i,{producto_id:Number(e.target.value),adicionales:[]})}><option value="">Elegí un producto</option>{l.producto_id&&!producto?<option value={l.producto_id}>{anterior?.nombre_producto??'Producto'} (no disponible)</option>:null}{catalogo.filter(c=>c.id===l.producto_id||!lineas.some(x=>x.producto_id===c.id)).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
 <label>Cantidad de línea {i+1}<input type="number" min="1" max="999" step="1" required value={l.cantidad} onChange={e=>editar(i,{cantidad:e.target.value})}/></label>
 {producto&&<small>Precio vigente sin adicionales: {importe(producto.precio_centavos)}</small>}
 {Array.from(new Set([...(producto?.adicionales??[]).map(a=>a.id),...l.adicionales])).map(id=>{const extra=producto?.adicionales?.find(a=>a.id===id);return <label className="edit-check" key={id}><input type="checkbox" checked={l.adicionales.includes(id)} onChange={e=>editar(i,{adicionales:e.target.checked?[...l.adicionales,id]:l.adicionales.filter(x=>x!==id)})}/>{extra?extra.nombre+' (+'+importe(extra.centavos)+')':(anterior?.adicionales?.find(a=>a.id===id)?.nombre??'Adicional')+' (ya no disponible)'}</label>})}
 <button type="button" className="button button-secondary" onClick={()=>{invalidar();setLineas(lineas.filter((_,n)=>n!==i))}}>Quitar línea {i+1}</button></fieldset>})}
 <button type="button" className="button button-secondary" disabled={lineas.length>=100} onClick={()=>{invalidar();setLineas([...lineas,{producto_id:0,cantidad:'1',adicionales:[]}])}}>Agregar producto al pedido</button>
 <label>Modalidad de entrega<select aria-label="Modalidad de entrega del pedido editado" value={entrega.modalidad} onChange={e=>destino({modalidad:e.target.value})}><option value="retiro">Retiro</option><option value="envio">Envío a domicilio</option></select></label>
 {entrega.modalidad==='envio'&&<><label>Dirección de entrega<input required minLength={5} maxLength={200} value={entrega.direccion??''} onChange={e=>destino({direccion:e.target.value})}/></label><label>Referencia<input maxLength={300} value={entrega.referencia??''} onChange={e=>destino({referencia:e.target.value})}/></label><MapaPunto punto={Number.isFinite(entrega.latitud)?{latitud:entrega.latitud,longitud:entrega.longitud}:null} onChange={destino} onDireccion={destino} permitirUbicacion={false} disabled={ocupado||obsoleto||incierto}/></>}
 {base.estado==='En preparación'?<label className="edit-check"><input type="checkbox" checked={devolver} onChange={e=>{invalidar();setDevolver(e.target.checked)}}/>Devolver al stock las unidades retiradas que se puedan reutilizar. Si no marcás esta opción, quedan fuera del stock.</label>:<p>En un pedido pendiente, las unidades retiradas se devuelven al stock.</p>}
 <label>Motivo de modificación<textarea required maxLength={500} value={motivo} onChange={e=>{invalidar();setMotivo(e.target.value)}}/></label><button className="button button-secondary" type="submit" disabled={!lineas.length||!motivo.trim()}>Revisar cambios</button></fieldset></form>}
 {revision&&<section className="edit-preview" aria-label="Resumen de la modificación"><h4>Revisión antes de guardar</h4><p>Total anterior: {importe(revision.resumen.anterior.total_centavos)}</p><Resumen datos={revision.resumen.nuevo}/><h4>Impacto en el stock</h4><ImpactoStock movimientos={revision.resumen.stock}/><button className="button button-primary" disabled={ocupado||(!incierto&&obsoleto)} onClick={guardar}>{incierto?'Reintentar el mismo guardado':'Confirmar modificación'}</button></section>}
 {error&&<p role="alert">{error}</p>}<button className="button button-secondary" disabled={ocupado} onClick={onCerrar}>Cerrar edición</button></section>
}
