export const IDENTIDAD_INICIAL=Object.freeze({logo_path:null,portada_path:null,color_principal:'#9f2144',color_fondo:'#faf8f4'})
function luminancia(hex){
 if(!/^#[0-9a-f]{6}$/i.test(hex??''))return NaN
 const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
 return c[0]*.2126+c[1]*.7152+c[2]*.0722
}
export function validarColores(principal,fondo){
 const p=luminancia(principal),f=luminancia(fondo)
 if(!Number.isFinite(p)||!Number.isFinite(f)||1.05/(p+.05)<4.5||(f+.05)/(p+.05)<4.5||(f+.05)/(luminancia('#74675e')+.05)<4.5)throw Error('Elegí un color principal oscuro y un fondo claro que mantengan el texto legible.')
}
export function paraPlantilla(negocio,identidad,archivos={}){
 return {presentacion:identidad.presentacion??'cuadricula',ordenProductos:identidad.orden_productos??[],emprendimientoId:negocio,logoPath:identidad.logo_path,portadaPath:identidad.portada_path,colorPrincipal:identidad.color_principal,colorFondo:identidad.color_fondo,logoArchivo:archivos.logo_path,portadaArchivo:archivos.portada_path}
}
