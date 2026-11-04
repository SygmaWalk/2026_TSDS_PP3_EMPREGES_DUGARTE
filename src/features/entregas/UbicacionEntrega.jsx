import { rutaEntrega } from './rutaEntrega.js'
import MapaPunto from './MapaPuntoLazy.jsx'
import { puntoValido } from './entregasRepository.js'

export default function UbicacionEntrega({entrega}) {
  if(entrega?.modalidad!=='envio')return null
  const destinoValido=puntoValido(entrega)
  const origen=puntoValido(entrega.origen)?entrega.origen:null
  const ruta=rutaEntrega(entrega)
  return <section className="order-location" aria-label="Ubicación de entrega del pedido">
    <h3>Ubicación de entrega</h3>
    {destinoValido?<>
      <p>El punto y el origen corresponden a los guardados al confirmar este pedido.</p>
      <MapaPunto punto={entrega} origen={origen} soloLectura/>
      <dl className="delivery-map-legend">
        {origen&&<div><dt><span className="origin-dot" aria-hidden="true"/>Origen del envío</dt><dd>{origen.direccion||'Origen guardado'}<small>{origen.latitud}, {origen.longitud}</small></dd></div>}
        <div><dt><span className="destination-dot" aria-hidden="true"/>Destino del cliente</dt><dd>{entrega.direccion}<small>{entrega.latitud}, {entrega.longitud}</small></dd></div>
      </dl>
      {ruta?<><a className="button button-secondary" href={ruta} target="_blank" rel="noopener noreferrer">Ver ruta en Google Maps ↗</a><p className="field-help">Se abre en otra pestaña con el origen y el destino. Elegí allí el medio de transporte para consultar el recorrido por calles. El costo del pedido conserva la tarifa por distancia en línea recta.</p></>:<p className="field-help">Este pedido no tiene un origen válido guardado para consultar la ruta.</p>}
    </>:<p>Este pedido no tiene un punto de entrega válido guardado.</p>}
  </section>
}
