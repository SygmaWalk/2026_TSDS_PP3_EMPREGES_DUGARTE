const formateadorPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

function CatalogoPreview({ productos, onAgregar }) {
  return (
    <section className="panel catalog-preview" aria-labelledby="preview-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {onAgregar ? 'Elegí tus productos' : 'Comprobación'}
          </span>
          <h2 id="preview-title">
            {onAgregar ? 'Productos disponibles' : 'Vista pública'}
          </h2>
          <p>Solo aparecen los productos marcados como visibles.</p>
        </div>
      </div>

      {productos.length === 0 ? (
        <p className="preview-empty">
          No hay productos visibles por el momento.
        </p>
      ) : (
        <ul className="preview-grid">
          {productos.map((producto) => (
            <li key={producto.id}>
              <strong>{producto.nombre}</strong>
              {producto.descripcion && <p>{producto.descripcion}</p>}
              <span>{formateadorPrecio.format(producto.precio)}</span>
              {onAgregar && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => onAgregar(producto)}
                  aria-label={`Agregar ${producto.nombre} al carrito`}
                >
                  Agregar al carrito
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
