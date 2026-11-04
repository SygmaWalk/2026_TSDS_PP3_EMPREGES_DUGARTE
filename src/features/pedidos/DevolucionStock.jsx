export default function DevolucionStock({consumos,valores,onChange,disabled}){
 return <section className="stock-return"><h4>Devolver al inventario</h4><p>Indicá cuánto puede recuperarse. Lo que no devuelvas seguirá registrado como consumido.</p>
  <button type="button" className="button button-secondary" disabled={disabled} onClick={()=>onChange(Object.fromEntries(consumos.map(c=>[c.producto_id,String(c.cantidad)])))}>Devolver todo</button>
  <div className="stock-return-list">{consumos.map(c=><div className="field-group" key={c.producto_id}><label htmlFor={'devolver-'+c.producto_id}>{c.nombre_producto} · descontado: {Number(c.cantidad).toLocaleString('es-AR')}</label><input id={'devolver-'+c.producto_id} inputMode="decimal" value={valores[c.producto_id]??'0'} disabled={disabled} onChange={e=>onChange({...valores,[c.producto_id]:e.target.value})}/></div>)}</div>
 </section>
}
