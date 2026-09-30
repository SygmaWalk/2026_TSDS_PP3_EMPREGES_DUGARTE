const COLUMNAS = 'id,emprendimiento_id,nombre,descripcion,precio,imagen_path,visible,fecha_creacion,fecha_modificacion'

function desdeFila(fila) {
  return {
    id: fila.id,
    emprendimientoId: fila.emprendimiento_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    precio: Number(fila.precio),
    imagenPath: fila.imagen_path,
    visible: fila.visible,
    fechaCreacion: fila.fecha_creacion,
    fechaModificacion: fila.fecha_modificacion,
  }
}

function camposEditables(datos) {
  return {
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    precio: datos.precio,
    imagen_path: datos.imagenPath,
  }
}

function comprobar(error) {
  if (!error) return
  if (error.code === '23505') throw new Error('Ya existe un producto con ese nombre.')
  if (error.code === '42501' || error.code === 'PGRST116') {
    throw new Error('No tenés permiso para guardar este producto o ya no está disponible.')
  }
  throw new Error('No se pudo completar la operación. Revisá tu conexión e intentá nuevamente.')
}

export function crearProductosRepository(client, emprendimientoId) {
  return {
    async listar() {
      // Paginar evita truncar silenciosamente catálogos mayores al límite de la API.
      const productos = []
      for (let inicio = 0; ; inicio += 500) {
        const { data, error } = await client.from('productos').select(COLUMNAS)
          .eq('emprendimiento_id', emprendimientoId).order('id').range(inicio, inicio + 499)
        comprobar(error)
        productos.push(...data.map(desdeFila))
        if (data.length < 500) return productos
      }
    },
    async crear(datos) {
      const { data, error } = await client.from('productos')
        .insert({ ...camposEditables(datos), emprendimiento_id: emprendimientoId, visible: false })
        .select(COLUMNAS).single()
      comprobar(error)
      return desdeFila(data)
    },
    async editar(id, datos) {
      const { data, error } = await client.from('productos').update(camposEditables(datos))
        .eq('id', id).eq('emprendimiento_id', emprendimientoId).select(COLUMNAS).single()
      comprobar(error)
      return desdeFila(data)
    },
    async visibilidad(id, visible) {
      const { data, error } = await client.from('productos').update({ visible })
        .eq('id', id).eq('emprendimiento_id', emprendimientoId).select(COLUMNAS).single()
      comprobar(error)
      return desdeFila(data)
    },
  }
}
