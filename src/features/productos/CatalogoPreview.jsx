const formateadorPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

function CatalogoPreview({ productos }) {
  return (
    <section className="panel catalog-preview" aria-labelledby="preview-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Comprobación</span>
          <h2 id="preview-title">Vista pública</h2>
          <p>Solo aparecen los productos marcados como visibles.</p>
        </div>
      </div>

      {productos.length === 0 ? (
        <p className="preview-empty">No hay productos visibles por el momento.</p>
      ) : (
        <ul className="preview-grid">
          {productos.map((producto) => (
            <li key={producto.id}>
              <strong>{producto.nombre}</strong>
              {producto.descripcion && <p>{producto.descripcion}</p>}
              <span>{formateadorPrecio.format(producto.precio)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CatalogoPreview
