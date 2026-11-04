import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import PlantillaTienda from '../catalogo/PlantillaTienda.jsx'
import CatalogoPreview from '../productos/CatalogoPreview.jsx'
export default function VistaPreviaTienda({client,negocio,identidad,productos}){
 const frame=useRef(null),[destino,setDestino]=useState(null),[ancho,setAncho]=useState(1100)
 useEffect(()=>{
  if(!destino)return
  const aplicar=()=>{const html=frame.current.contentDocument.documentElement;html.dataset.theme=document.documentElement.dataset.theme??'light';html.style.colorScheme=html.dataset.theme}
  aplicar();const observer=new MutationObserver(aplicar);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect()
 },[destino])
 function preparar(){
  const doc=frame.current.contentDocument
  doc.head.replaceChildren(...Array.from(document.head.querySelectorAll('style,link[rel="stylesheet"]')).map(n=>n.cloneNode(true)))
  const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1';doc.head.append(meta)
  setDestino(doc.body)
 }
 return <section className="appearance-preview" aria-label="Vista previa de la tienda">
  <div className="section-heading"><h2>Vista previa</h2><div className="form-actions"><button className="button button-secondary" aria-pressed={ancho===1100} onClick={()=>setAncho(1100)}>Computadora</button><button className="button button-secondary" aria-pressed={ancho===390} onClick={()=>setAncho(390)}>Celular</button></div></div>
  <p>Vista previa del borrador. La tienda pública cambia únicamente al publicar.</p>
  <div className="appearance-frame-scroll"><iframe ref={frame} title="Vista previa de la tienda" onLoad={preparar} srcDoc="<!doctype html><html lang='es'><head></head><body></body></html>" style={{width:ancho,height:800}}/>
   {destino&&createPortal(<div onClickCapture={e=>{if(e.target.closest('a'))e.preventDefault()}}><PlantillaTienda client={client} negocio={negocio} publicada={identidad}><div className="store-container store-content"><CatalogoPreview presentacion={identidad.presentacion} ordenProductos={identidad.ordenProductos} client={client} productos={productos} publico onAgregar={()=>{}}/></div></PlantillaTienda></div>,destino)}
  </div>
 </section>
}
