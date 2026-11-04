import {validarColores} from '../apariencia/apariencia.js'
export const PLANTILLA_PREDETERMINADA=Object.freeze({version:1,logoUrl:null,portadaUrl:null,colorPrincipal:'#9f2144',colorFondo:'#faf8f4',presentacion:'cuadricula',ordenProductos:Object.freeze([])})
export function configuracionTienda(negocio,publicada){
 if(!publicada||!negocio||String(publicada.emprendimientoId)!==String(negocio.id))return {...PLANTILLA_PREDETERMINADA}
 const config={...PLANTILLA_PREDETERMINADA}
 try{validarColores(publicada.colorPrincipal,publicada.colorFondo);config.colorPrincipal=publicada.colorPrincipal;config.colorFondo=publicada.colorFondo}catch{/* Configuración incompleta: paleta estándar. */}
 const imagen=url=>typeof url==='string'&&url.startsWith('/')&&!url.startsWith('//')?url:null
 const ruta=p=>typeof p==='string'&&p.startsWith(negocio.id+'/')?p:null
 return {...config,logoUrl:imagen(publicada.logoUrl),portadaUrl:imagen(publicada.portadaUrl),logoPath:ruta(publicada.logoPath),portadaPath:ruta(publicada.portadaPath),logoArchivo:publicada.logoArchivo,portadaArchivo:publicada.portadaArchivo}
}
