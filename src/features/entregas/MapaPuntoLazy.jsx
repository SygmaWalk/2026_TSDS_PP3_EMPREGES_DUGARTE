import { lazy,Suspense } from 'react'
const MapaPunto=lazy(()=>import('./MapaPunto.jsx'))
export default function MapaPuntoLazy(props) {
  return <Suspense fallback={<p role="status">Cargando mapa…</p>}><MapaPunto {...props}/></Suspense>
}
