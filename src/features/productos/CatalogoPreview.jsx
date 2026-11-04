import {ordenarProductos} from '../apariencia/distribucion.js'
import ImagenProducto from './ImagenProducto.jsx'
const formateadorPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

function CatalogoPreview({ productos, onAgregar, client, publico = false, presentacion = 'cuadricula', ordenProductos = [] }) {
  return (
    <section className={publico ? "catalog-preview catalog-store" : "panel catalog-preview"} aria-labelledby="preview-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {onAgregar ? 'Elegí tus productos' : 'Comprobación'}
          </span>
          <h2 id="preview-title">
            {onAgregar ? 'Productos disponibles' : 'Vista previa del catálogo'}
          </h2>
          <p>{publico ? "Conocé nuestra propuesta y elegí qué llevar." : "Solo aparecen los productos marcados como visibles."}</p>
        </div>
      </div>

      {productos.length === 0 ? (
        <p className="preview-empty">
          No hay productos visibles por el momento.
        </p>
      ) : (
        <ul className={presentacion === "lista" ? "preview-grid preview-list" : "preview-grid"}>
          {ordenarProductos(productos,ordenProductos).map((producto) => (
            <li key={producto.id}>
              <ImagenProducto client={client} ruta={producto.imagenPath} nombre={producto.nombre} />
              <strong>{producto.nombre}</strong>
              {producto.descripcion && <p>{producto.descripcion}</p>}
              <span>{formateadorPrecio.format(producto.precio)}</span>
              {onAgregar && (
                <button
                  className="button button-primary"
                  type="button"
                  disabled={producto.stockDisponible===0}
                  onClick={() => onAgregar(producto)}
                  aria-label={`Agregar ${producto.nombre} al carrito`}
                >
                  {producto.stockDisponible===0?'Agotado':'Agregar al carrito'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CatalogoPreview
