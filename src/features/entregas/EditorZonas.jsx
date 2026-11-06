import {useState} from 'react'
import MapaPunto from './MapaPuntoLazy.jsx'
import {limitesEntre} from './zonas.js'
export default function EditorZonas({zonas,onChange,origen,disabled}){
 const [esquina,setEsquina]=useState(null),[dibujando,setDibujando]=useState(false)
 function marcar(p){if(!dibujando)return;if(!esquina){setEsquina(p);return}onChange([...zonas,{nombre:'Zona '+(zonas.length+1),precio:'0',...limitesEntre(esquina,p)}]);setEsquina(null);setDibujando(false)}
 function editar(i,campo,valor){onChange(zonas.map((z,n)=>n===i?{...z,[campo]:valor}:z))}
 return <section aria-label="Zonas de envío"><p>Marcá dos esquinas opuestas para dibujar cada rectángulo. Podés ajustar sus límites en las coordenadas. Las zonas pueden ser contiguas, pero no superponerse.</p>
 <button className="button button-secondary" type="button" disabled={disabled||zonas.length>=20} onClick={()=>{setEsquina(null);setDibujando(!dibujando)}}>{dibujando?'Cancelar dibujo':'Dibujar zona'}</button>
 {dibujando&&<p role="status">{esquina?'Marcá la segunda esquina del rectángulo.':'Marcá la primera esquina del rectángulo.'}</p>}
 <MapaPunto permitirUbicacion={false} punto={esquina} origen={origen} zonas={zonas} onChange={marcar} disabled={disabled||!dibujando}/>
 {zonas.map((z,i)=><fieldset className="zone-card" key={i} disabled={disabled}><legend>Zona {i+1}</legend><label>Nombre de zona {i+1}<input required maxLength={60} value={z.nombre} onChange={e=>editar(i,'nombre',e.target.value)}/></label><label>Tarifa de zona {i+1} ($)<input required inputMode="decimal" value={z.precio} onChange={e=>editar(i,'precio',e.target.value)}/></label><details><summary>Ajustar límites de zona {i+1}</summary><div className="coordinate-fields">{['sur','norte','oeste','este'].map(k=><label key={k}>{k}<input aria-label={k+' de zona '+(i+1)} type="number" step="0.000001" value={z[k]} onChange={e=>editar(i,k,e.target.value===''?'':Number(e.target.value))}/></label>)}</div></details><button className="button button-secondary" type="button" onClick={()=>onChange(zonas.filter((_,n)=>n!==i))}>Quitar zona {i+1}</button></fieldset>)}
 <p className="field-help">En un límite compartido se asigna la zona que comienza en ese borde: se incluyen sur y oeste; se excluyen norte y este.</p></section>
}
