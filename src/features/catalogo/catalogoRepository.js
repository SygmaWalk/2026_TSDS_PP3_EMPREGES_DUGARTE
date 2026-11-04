import {paraPlantilla} from '../apariencia/apariencia.js'
import { crearProductosRepository } from '../productos/productosRepository.js'

export async function cargarTienda(client, slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const { data: negocio, error } = await client.from('emprendimientos').select('id,nombre,slug,activo').eq('slug', slug).eq('activo', true).maybeSingle()
  if (error) throw new Error('No se pudo cargar la tienda. Revisá tu conexión e intentá nuevamente.')
  if (!negocio) return null
  const apariencia=await client.rpc('apariencia_publicada',{p_negocio:negocio.id})
  if(apariencia.error)throw Error('No se pudo cargar la identidad de la tienda. Intentá nuevamente.')
  negocio.apariencia=apariencia.data?paraPlantilla(negocio.id,apariencia.data):null
  const productos = await crearProductosRepository(client, negocio.id).listar({ soloVisibles: true })
  const disponibilidad=await client.rpc('catalogo_disponibilidad',{p_negocio:negocio.id})
  if(disponibilidad.error)throw Error('No se pudo comprobar la disponibilidad. Actualizá la tienda.')
  return { negocio, productos:productos.map(p=>({...p,stockDisponible:disponibilidad.data.find(d=>d.producto_id===p.id)?.disponible??0})) }
}
