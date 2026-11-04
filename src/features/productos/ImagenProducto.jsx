import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function ImagenProducto({ ruta, nombre, client = supabase, archivo = null }) {
  const [imagen, setImagen] = useState(null)
  const [fallida, setFallida] = useState(null)
  const origen = archivo || ruta
  useEffect(() => {
    if (!origen) return
    let vigente = true
    let url
    async function cargar() {
      try {
        const resultado = archivo ? { data: archivo } : await client.storage.from('productos').download(ruta)
        if (resultado.error) throw resultado.error
        url = URL.createObjectURL(resultado.data)
        if (vigente) setImagen({ origen, url })
        else URL.revokeObjectURL(url)
      } catch { if (vigente) setFallida(origen) }
    }
    cargar()
    return () => { vigente = false; if (url) URL.revokeObjectURL(url) }
  }, [client, archivo, ruta, origen])
  if (!origen || fallida === origen || imagen?.origen !== origen) return <div className="product-image product-image-placeholder"><span aria-hidden="true">◇</span><span>{!origen ? 'Sin imagen' : fallida === origen ? 'Imagen no disponible' : 'Cargando imagen…'}</span></div>
  return <img className="product-image" src={imagen.url} alt={nombre} loading="lazy" onError={() => setFallida(origen)} />
}
