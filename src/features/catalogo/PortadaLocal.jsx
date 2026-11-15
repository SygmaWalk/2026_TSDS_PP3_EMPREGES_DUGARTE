import {useEffect,useState} from 'react'
import ImagenIdentidad from './ImagenIdentidad.jsx'

export default function PortadaLocal({ client, negocio }) {
  const [portada, setPortada] = useState(null)
  useEffect(() => {
    // Una portada fallida conserva el enlace a la tienda y su inicial de respaldo.
    let vigente = true
    async function cargar() {
      try {
        const {data, error} = await client.rpc('apariencia_publicada', {p_negocio: negocio.id})
        if (vigente && !error && data?.portada_path) setPortada({id: negocio.id, ruta: data.portada_path})
      } catch { /* La tarjeta sigue disponible sin portada. */ }
    }
    cargar()
    return () => { vigente = false }
  }, [client, negocio.id])
  return <div className="shop-cover local-cover" aria-hidden="true">
    <span className="shop-cover-initial">{negocio.nombre.slice(0,1).toUpperCase()}</span>
    {portada?.id === negocio.id && <ImagenIdentidad client={client} ruta={portada.ruta} nombre={negocio.nombre} tipo="portada"/>}
  </div>
}
