import {validarImagen} from '../productos/imagenes.js'
import {IDENTIDAD_INICIAL,validarColores} from './apariencia.js'
function fallo(e){
 if(e.code==='PT409')return Error('La configuración cambió o el intento ya se guardó. Recargá el borrador para revisar la versión vigente.')
 if(e.code==='42501')return Error('No tenés permiso para configurar esta tienda.')
 if(e.code==='22023')return Error(e.message)
 return Error('No se pudo completar la operación. Revisá tu conexión; tus cambios permanecen en el formulario.')
}
export function crearAparienciaRepository(client,negocio){
 return {
  async cargar(){
   const r=await client.from('apariencias_tienda').select('*').eq('emprendimiento_id',negocio).maybeSingle()
   if(r.error)throw fallo(r.error)
   return r.data??{emprendimiento_id:negocio,borrador:{...IDENTIDAD_INICIAL},publicada:null,version:null}
  },
  async catalogo(){const r=await client.rpc('catalogo_configurable',{p_negocio:negocio});if(r.error)throw fallo(r.error);return r.data},
  async subir(archivo){
   validarImagen(archivo)
   const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[archivo.type]
   const ruta=negocio+'/'+crypto.randomUUID()+'.'+extension
   const r=await client.storage.from('tiendas').upload(ruta,archivo,{contentType:archivo.type,cacheControl:'0',upsert:false})
   if(r.error)throw Error('No se pudo subir la imagen. Revisá tu conexión y permisos.')
   return ruta
  },
  async guardar(version,identidad){
   validarColores(identidad.color_principal,identidad.color_fondo)
   const r=await client.rpc('guardar_configuracion_tienda',{p_negocio:negocio,p_version:version,p_identidad:{logo_path:identidad.logo_path,portada_path:identidad.portada_path,color_principal:identidad.color_principal,color_fondo:identidad.color_fondo},p_distribucion:{presentacion:identidad.presentacion??'cuadricula',orden_productos:identidad.orden_productos??[]}})
   if(r.error)throw fallo(r.error)
   return r.data
  },
  async publicar(version){
   const r=await client.rpc('publicar_apariencia',{p_negocio:negocio,p_version:version})
   if(r.error)throw fallo(r.error)
   return r.data
  }
 }
}
