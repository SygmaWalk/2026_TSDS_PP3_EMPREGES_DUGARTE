export function limitesEntre(a,b){return {sur:Math.min(a.latitud,b.latitud),norte:Math.max(a.latitud,b.latitud),oeste:Math.min(a.longitud,b.longitud),este:Math.max(a.longitud,b.longitud)}}
export function prepararZonas(zonas){
 if(!zonas.length||zonas.length>20)throw new Error('Definí entre 1 y 20 zonas.')
 return zonas.map((z,i)=>{
 const precio=String(z.precio).trim().replace(',','.')
 if(!z.nombre.trim()||z.nombre.trim().length>60||!/^\d+(\.\d{1,2})?$/.test(precio)||Number(precio)>9999999.99)throw new Error('Cada zona necesita un nombre y una tarifa válida con hasta 2 decimales.')
 if(!['sur','norte','oeste','este'].every(k=>Number.isFinite(z[k]))||z.sur>=z.norte||z.oeste>=z.este||z.sur< -90||z.norte>90||z.oeste< -180||z.este>180)throw new Error('Marcá dos esquinas diferentes para cada zona.')
 if(zonas.slice(0,i).some(o=>z.sur<o.norte&&z.norte>o.sur&&z.oeste<o.este&&z.este>o.oeste))throw new Error('Las zonas se superponen. Ajustá sus límites antes de guardar.')
 return {nombre:z.nombre.trim(),sur:z.sur,norte:z.norte,oeste:z.oeste,este:z.este,tarifa_centavos:Math.round(Number(precio)*100)}
 })
}
