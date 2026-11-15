import {useEffect,useState} from 'react'

export default function ImagenIdentidad({src,ruta,archivo,client,nombre,tipo}) {
 const [imagen,setImagen]=useState(null),[fallida,setFallida]=useState(null)
 const origen=archivo||ruta||src
 useEffect(()=>{
  if(!archivo&&!ruta)return
  let vigente=true,url
  async function cargar(){
   try{
    const r=archivo?{data:archivo}:await client.storage.from('tiendas').download(ruta)
    if(r.error)throw r.error
    url=URL.createObjectURL(r.data)
    if(vigente)setImagen({origen,url});else URL.revokeObjectURL(url)
   }catch{if(vigente)setFallida(origen)}
  }
  cargar();return()=>{vigente=false;if(url)URL.revokeObjectURL(url)}
 },[archivo,ruta,client,origen])
 const url=archivo||ruta?(imagen?.origen===origen?imagen.url:null):src
 if(!url||fallida===origen)return tipo==='logo'
  ?<span className="shop-logo-fallback" aria-label={'Identidad de '+nombre}>{nombre.trim().slice(0,1).toUpperCase()}</span>
  :<div className="shop-cover-fallback" aria-hidden="true"><span/><span/><span/></div>
 return <img className={'shop-identity-'+tipo} src={url} alt={tipo==='logo'?'Logo de '+nombre:''} onError={()=>setFallida(origen)}/>
}
