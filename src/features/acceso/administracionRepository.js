export const CATALOGO_PERMISOS = [
 ['Productos', [['productos.ver','Consultar productos'],['productos.crear','Crear productos'],['productos.editar','Editar productos'],['productos.publicar','Mostrar u ocultar productos']]],
 ['Pedidos', [['pedidos.ver','Consultar pedidos'],['pedidos.actualizar_estado','Cambiar estado y cancelar'],['pedidos.registrar_pago','Registrar cobros']]],
 ['Clientes', [['clientes.ver','Consultar clientes'],['clientes.editar','Editar clientes']]],
 ['Inventario', [['stock.ver','Consultar inventario'],['stock.registrar','Registrar movimientos']]],
 ['Tienda y entregas', [['tienda.configurar','Configurar tienda'],['entregas.configurar','Configurar entregas']]],
]
export function cambiarPermiso(permisos, permiso, activo) {
 const nuevos=new Set(permisos), grupo=permiso.split('.')[0], consulta=grupo+'.ver'
 if(activo){nuevos.add(permiso);if(['productos','pedidos','clientes','stock'].includes(grupo))nuevos.add(consulta)}
 else{nuevos.delete(permiso);if(permiso===consulta)for(const p of nuevos)if(p.startsWith(grupo+'.'))nuevos.delete(p)}
 return [...nuevos]
}
function fallo(error){
 if(error.code==='42501')return new Error('No tenés autorización para administrar esta cuenta.')
 if(error.code==='22023')return new Error(error.message)
 return new Error('No se pudo completar la operación. Volvé a cargar la cuenta antes de intentarlo nuevamente.')
}
export async function listarCuentas(client,busqueda='',offset=0){
 const {data,error}=await client.rpc('administracion_cuentas',{p_busqueda:busqueda,p_offset:offset})
 if(error)throw fallo(error)
 return {cuentas:data.slice(0,20),hayMas:data.length>20}
}
export async function guardarCuenta(client,cuenta){
 const {error}=await client.rpc('administracion_guardar_cuenta',{
 p_usuario:cuenta.usuario_id,p_habilitada:cuenta.habilitada,p_interna:cuenta.rol==='emprendimiento',
 p_asociaciones:cuenta.asociaciones})
 if(error)throw fallo(error)
}
