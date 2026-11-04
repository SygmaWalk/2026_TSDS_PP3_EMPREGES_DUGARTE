import {useState} from 'react'
export default function UmbralStock({producto,repository,puedeConfigurar,onActualizar}) {
 const [editando,setEditando]=useState(false),[valor,setValor]=useState(''),[guardando,setGuardando]=useState(false),[error,setError]=useState('')
 const minimo=producto.umbral_stock
 async function guardar(e){
  e.preventDefault();if(guardando)return
  setGuardando(true);setError('')
  try{await repository.configurarUmbral(producto.producto_id,valor);setEditando(false);onActualizar()}
  catch(e){setError(e.message)}
  finally{setGuardando(false)}
 }
 return <section className="stock-threshold" aria-label="Aviso de stock bajo">
  <div><h3>Stock mínimo</h3><p>{minimo==null?'Sin mínimo configurado':Number(minimo).toLocaleString('es-AR',{maximumFractionDigits:3})+' unidades'}</p></div>
  {puedeConfigurar&&!editando&&<button className="button button-secondary" onClick={()=>{setValor(minimo==null?'':String(minimo).replace('.',','));setError('');setEditando(true)}}>Configurar mínimo</button>}
  {editando&&<form onSubmit={guardar}><fieldset className="form-fields" disabled={guardando}>
   <div className="field-group"><label htmlFor="umbral-stock">Avisar con esta cantidad o menos</label><input id="umbral-stock" inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)} aria-describedby="umbral-ayuda"/><small id="umbral-ayuda">Dejá el campo vacío para desactivar el mínimo.</small></div>
   {error&&<p role="alert" className="error-feedback">{error}</p>}
   <div className="form-actions"><button className="button button-primary" type="submit">{guardando?'Guardando…':'Guardar mínimo'}</button><button className="button button-secondary" type="button" onClick={()=>setEditando(false)}>Cancelar</button></div>
  </fieldset></form>}
 </section>
}
