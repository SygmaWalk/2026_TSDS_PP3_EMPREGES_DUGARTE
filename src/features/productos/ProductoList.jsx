import ImagenProducto from './ImagenProducto.jsx'
const formateadorPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

function ProductoList({ productos, onEditar, onCambiarVisibilidad, guardando = false, puedeEditar = true, puedePublicar = true, onRetirar, onRestaurar, archivados = false, client }) {
  return (
    <section className="panel products-panel" aria-labelledby="list-title">
      <div className="panel-heading">
        <div>
          <h2 id="list-title">{archivados?'Productos archivados':'Productos cargados'}</h2>
          <p>{archivados?'Conservan su historial. Al restaurarlos quedan ocultos.':'Los productos nuevos comienzan ocultos.'}</p>
        </div>
        <span className="product-count" aria-label={`${productos.length} productos`}>
          {productos.length}
        </span>
      </div>

      {productos.length === 0 ? (
        <div className="empty-state">
          <strong>{archivados?'No hay productos archivados':'Todavía no hay productos'}</strong>
          {!archivados&&<p>Agregá productos para comenzar a armar tu catálogo.</p>}
        </div>
      ) : (
        <ul className="product-list">
          {productos.map((producto) => (
            <li className="product-item" key={producto.id}>
              <div className="product-main">
                <ImagenProducto client={client} ruta={producto.imagenPath} nombre={producto.nombre} />
                <div className="product-title-row">
                  <h3>{producto.nombre}</h3>
                  <span className={producto.visible ? 'status-badge status-visible' : 'status-badge'}>
                    {archivados?'Archivado':producto.visible ? 'Visible' : 'Oculto'}
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
                </dl>
              </div>
              <div className="product-actions">
                {!archivados && puedePublicar && <button
                  className="button visibility-button"
                  disabled={guardando}
                  type="button"
                  onClick={() => onCambiarVisibilidad(producto)}
                  aria-pressed={producto.visible}
                  aria-label={`${producto.visible ? 'Ocultar' : 'Mostrar'} ${producto.nombre} en el catálogo público`}
                >
                  {producto.visible ? 'Ocultar' : 'Mostrar'}
                </button>}
                {!archivados && puedeEditar && <button
                  className="button edit-button"
                  disabled={guardando}
                  type="button"
                  onClick={() => onEditar(producto)}
                  aria-label={`Editar ${producto.nombre}`}
                >
                  Editar
                </button>}
                {onRetirar&&!archivados&&<button className="button button-secondary" disabled={guardando} onClick={()=>onRetirar(producto)} aria-label={'Eliminar '+producto.nombre}>Eliminar</button>}
                {onRestaurar&&archivados&&<button className="button button-secondary" disabled={guardando} onClick={()=>onRestaurar(producto)} aria-label={'Restaurar '+producto.nombre}>Restaurar</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ProductoList
