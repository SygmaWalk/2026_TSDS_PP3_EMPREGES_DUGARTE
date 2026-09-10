const formateadorPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

function ProductoList({ productos, onEditar }) {
  return (
    <section className="panel products-panel" aria-labelledby="list-title">
      <div className="panel-heading">
        <div>
          <h2 id="list-title">Productos cargados</h2>
          <p>Los productos nuevos comienzan ocultos.</p>
        </div>
        <span className="product-count" aria-label={`${productos.length} productos`}>
          {productos.length}
        </span>
      </div>

      {productos.length === 0 ? (
        <div className="empty-state">
          <strong>Todavía no hay productos</strong>
          <p>Completá el formulario para crear el primero.</p>
        </div>
      ) : (
        <ul className="product-list">
          {productos.map((producto) => (
            <li className="product-item" key={producto.id}>
              <div className="product-main">
                <div className="product-title-row">
                  <h3>{producto.nombre}</h3>
                  <span className="status-badge">
                    {producto.visible ? 'Visible' : 'Oculto'}
                  </span>
                </div>
                {producto.descripcion && (
                  <p className="product-description">{producto.descripcion}</p>
                )}
                <dl className="product-meta">
                  <div>
                    <dt>Precio</dt>
                    <dd>{formateadorPrecio.format(producto.precio)}</dd>
                  </div>
                  {producto.imagenPath && (
                    <div>
                      <dt>Imagen</dt>
                      <dd>{producto.imagenPath}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <button
                className="button edit-button"
                type="button"
                onClick={() => onEditar(producto)}
                aria-label={`Editar ${producto.nombre}`}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ProductoList
