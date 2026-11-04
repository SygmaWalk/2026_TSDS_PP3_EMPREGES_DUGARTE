import {subirImagen,quitarImagenSinUso} from './imagenes.js'
const COLUMNAS='id,emprendimiento_id,nombre,descripcion,precio,imagen_path,visible,archivado,es_combo,fecha_creacion,fecha_modificacion'
function desdeFila(f){
 return {id:f.id,emprendimientoId:f.emprendimiento_id,nombre:f.nombre,descripcion:f.descripcion,precio:Number(f.precio),imagenPath:f.imagen_path,visible:f.visible,archivado:f.archivado??false,fechaCreacion:f.fecha_creacion,fechaModificacion:f.fecha_modificacion,esCombo:f.es_combo??false,componentes:f.componentes_producto??[]}
}
function comprobar(e){
 if(!e)return
 if(e.code==='23505')throw Error('Ya existe un producto con ese nombre o repetiste un componente.')
 if(['42501','PGRST116','PT404'].includes(e.code))throw Error('No tenés permiso para guardar este producto o ya no está disponible.')
 if(e.code==='PT409')throw Error(e.message)
 if(e.code==='22023')throw Error(e.message)
 if(e.code==='23514')throw Error('Revisá los datos y la imagen del producto antes de guardar.')
 throw Error('No se pudo completar la operación. Revisá tu conexión e intentá nuevamente.')
}
export function crearProductosRepository(client,emprendimientoId){
 async function guardar(datos,id=null){
  let anterior=null,nueva=null
  if(id!==null){const r=await client.from('productos').select('imagen_path').eq('id',id).eq('emprendimiento_id',emprendimientoId).single();comprobar(r.error);anterior=r.data.imagen_path}
  try{
   if(datos.archivoImagen)nueva=await subirImagen(client,emprendimientoId,datos.archivoImagen)
   const {data,error}=await client.rpc('guardar_producto_compuesto',{p_negocio:emprendimientoId,p_producto:id,p_nombre:datos.nombre,p_descripcion:datos.descripcion??null,p_precio:datos.precio,p_imagen:nueva||datos.imagenPath||null,p_combo:datos.esCombo??false,p_componentes:datos.componentes??[]})
   comprobar(error)
   if(anterior&&anterior!==data.imagen_path)await quitarImagenSinUso(client,anterior)
   return desdeFila(data)
  }catch(e){if(nueva)await quitarImagenSinUso(client,nueva);throw e}
 }
 return {
  async listar({soloVisibles=false,archivados=false}={}){
   const productos=[]
   for(let inicio=0;;inicio+=500){
    let q=client.from('productos').select(soloVisibles?COLUMNAS:COLUMNAS+',componentes_producto!componentes_padre_fk(componente_id,cantidad)').eq('emprendimiento_id',emprendimientoId)
    q=q.eq('archivado',soloVisibles?false:archivados)
    if(soloVisibles)q=q.eq('visible',true)
    const {data,error}=await q.order('id').range(inicio,inicio+499)
    comprobar(error);productos.push(...data.map(desdeFila))
    if(data.length<500)return productos
   }
  },
  async retirar(id,accion='consultar'){const r=await client.rpc('retirar_producto',{p_negocio:emprendimientoId,p_producto:id,p_accion:accion});comprobar(r.error);return r.data},
  crear:datos=>guardar(datos),
  editar:(id,datos)=>guardar(datos,id),
  async visibilidad(id,visible){const {data,error}=await client.from('productos').update({visible}).eq('id',id).eq('emprendimiento_id',emprendimientoId).select(COLUMNAS+',componentes_producto!componentes_padre_fk(componente_id,cantidad)').single();comprobar(error);return desdeFila(data)}
 }
}
