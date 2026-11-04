import {ordenarProductos,moverProducto} from './distribucion.js'
export default function DistribucionCatalogo({productos,form,onCambiar}){
 const ordenados=ordenarProductos(productos,form.orden_productos)
 return <section className="catalog-settings" aria-labelledby="catalog-settings-title">
  <h2 id="catalog-settings-title">Presentación del catálogo</h2>
  <label htmlFor="presentacion">Vista de los productos</label>
  <select id="presentacion" value={form.presentacion??'cuadricula'} onChange={e=>onCambiar({presentacion:e.target.value})}><option value="cuadricula">Cuadrícula</option><option value="lista">Lista</option></select>
  <h3>Orden de los productos</h3>
  {!ordenados.length?<p>Todavía no hay productos para ordenar.</p>:<ol className="catalog-order">{ordenados.map((p,i)=><li key={p.id}><div><strong>{p.nombre}</strong>{!p.visible&&<small>Oculto</small>}</div><div className="catalog-order-actions"><button className="button button-outline" type="button" aria-label={'Subir '+p.nombre} disabled={i===0} onClick={()=>onCambiar({orden_productos:moverProducto(productos,form.orden_productos,p.id,-1)})}>↑ Subir</button><button className="button button-outline" type="button" aria-label={'Bajar '+p.nombre} disabled={i===ordenados.length-1} onClick={()=>onCambiar({orden_productos:moverProducto(productos,form.orden_productos,p.id,1)})}>↓ Bajar</button></div></li>)}</ol>}
  <p className="field-help">Los productos nuevos aparecen al final. Los ocultos conservan su posición y no se muestran en la tienda.</p>
 </section>
}
