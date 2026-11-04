import { obtenerAcceso } from '../acceso/accesoRepository.js'
export const STOCK_POR_PAGINA = 25
export function cantidadStock(valor) {
 const texto=String(valor??'').trim().replace(',','.')
 if(!/^\d+(\.\d{1,3})?$/.test(texto)||Number(texto)<=0||Number(texto)>999999999.999)throw Error('Ingresá una cantidad mayor a cero con hasta tres decimales.')
 return Number(texto)
}
export function minimoStock(valor) {
 const texto=String(valor??'').trim().replace(',','.')
 if(texto==='')return null
 if(!/^\d+(\.\d{1,3})?$/.test(texto)||Number(texto)>999999999.999)throw Error('Ingresá un mínimo desde cero y con hasta tres decimales.')
 return Number(texto)
}
export function crearStockRepository(client,negocio,usuario) {
 async function autorizar(){
  const a=await obtenerAcceso(client,usuario)
  const n=a.negocios.find(n=>n.id===negocio)
  if(!a.habilitada||!n?.permisos.includes('stock.ver')||!n.permisos.includes('productos.ver'))throw Error('Ya no tenés acceso al inventario de este emprendimiento.')
 }
 function fallo(error){
  if(error.code==='PT409')return Error('El stock o el intento de registro cambió. Actualizá las existencias y revisá el movimiento antes de reintentar.')
  if(error.code==='22023')return Error('Revisá la cantidad y el motivo. Un ajuste no puede dejar el stock por debajo de cero.')
  if(error.code==='42501')return Error('Ya no tenés permiso para registrar movimientos.')
  if(error.code==='PT404')return Error('El producto ya no está disponible.')
  return Error('No se pudo completar la operación. Revisá tu conexión e intentá nuevamente.')
 }
 return {
  async listar(pagina=0,busqueda='',filtro='todos'){
   if(!Number.isInteger(pagina)||pagina<0)throw Error('Página inválida.')
   if(!['todos','bajo','sin_stock'].includes(filtro))throw Error('Filtro inválido.')
   const texto=busqueda.trim()
   if(texto.length>100||texto.includes('*'))throw Error('Usá hasta 100 caracteres, sin asteriscos.')
   await autorizar()
   let q=client.from('stock_productos').select('*',{count:'exact'}).eq('emprendimiento_id',negocio)
   if(filtro==='bajo')q=q.eq('bajo_umbral',true)
   if(filtro==='sin_stock')q=q.eq('estado_stock','sin_stock')
   if(texto)q=q.ilike('nombre','%'+texto.replace(/[\\%_]/g,'\\$&')+'%')
   const r=await q.order('nombre').order('producto_id').range(pagina*25,pagina*25+24)
   if(r.error)throw fallo(r.error)
   return {productos:r.data,total:r.count}
  },
  async obtener(producto){
   await autorizar()
   const r=await client.from('stock_productos').select('*').eq('emprendimiento_id',negocio).eq('producto_id',producto).single()
   if(r.error)throw fallo(r.error)
   return r.data
  },
  async configurarUmbral(producto,valor){
   const minimo=minimoStock(valor)
   await autorizar()
   const r=await client.rpc('configurar_umbral_stock',{p_negocio:negocio,p_producto:producto,p_minimo:minimo})
   if(r.error){
    if(r.error.code==='42501')throw Error('Ya no tenés permiso para configurar el stock mínimo.')
    if(r.error.code==='22023')throw Error('Ingresá un mínimo desde cero y con hasta tres decimales.')
    throw fallo(r.error)
   }
   return r.data
  },
  async historial(producto,pagina=0){
   if(!Number.isInteger(pagina)||pagina<0)throw Error('Página inválida.')
   await autorizar()
   const r=await client.from('movimientos_stock').select('id,tipo,cantidad,motivo,referencia,fecha',{count:'exact'}).eq('emprendimiento_id',negocio).eq('producto_id',producto).order('fecha',{ascending:false}).order('id',{ascending:false}).range(pagina*25,pagina*25+24)
   if(r.error)throw fallo(r.error)
   return {movimientos:r.data,total:r.count}
  },
  async registrar(producto,movimiento){
   await autorizar()
   const r=await client.rpc('registrar_movimiento_stock',{p_negocio:negocio,p_producto:producto.producto_id,p_clave:movimiento.clave,p_tipo:movimiento.tipo,p_cantidad:cantidadStock(movimiento.cantidad),p_motivo:movimiento.motivo,p_referencia:movimiento.referencia,p_saldo_esperado:producto.disponible})
   if(r.error)throw fallo(r.error)
   return r.data
  }
 }
}
