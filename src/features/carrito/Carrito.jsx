import { useState } from 'react'
import { calcularSubtotalCentavos, formatearCentavos } from './carrito.js'

function CantidadItem({ item, onCantidad }) {
  const [cantidad, setCantidad] = useState(String(item.cantidad))
  return (
    <form
      className="quantity-form"
      onSubmit={(evento) => {
        evento.preventDefault()
        onCantidad(item.id, cantidad)
      }}
    >
      <label htmlFor={`cantidad-${item.id}`}>Cantidad de {item.nombre}</label>
      <div className="quantity-controls">
        <input
          id={`cantidad-${item.id}`}
          inputMode="numeric"
          value={cantidad}
          onChange={(evento) => setCantidad(evento.target.value)}
          autoComplete="off"
        />
        <button
          className="button button-secondary"
          type="submit"
          aria-label={`Actualizar cantidad de ${item.nombre}`}
        >
          Actualizar
        </button>
      </div>
    </form>
  )
}

export default function Carrito({ items, onCantidad, onQuitar, onVolver }) {
  return (
    <section className="panel cart-panel" aria-labelledby="cart-title">
      <div className="panel-heading">
        <h2 id="cart-title">Tu carrito</h2>
        <p>Revisá los productos y las cantidades de tu selección.</p>
      </div>
      {items.length === 0 ? (
        <p className="preview-empty">
          Tu carrito está vacío. Agregá productos desde el catálogo.
        </p>
      ) : (
        <ul className="cart-list">
          {items.map((item) => (
            <li key={item.id} className="cart-item">
              <div>
                <h3>{item.nombre}</h3>
                <p>{formatearCentavos(item.precioCentavos)} por unidad</p>
                <CantidadItem
                  key={`${item.id}:${item.cantidad}`}
                  item={item}
                  onCantidad={onCantidad}
                />
              </div>
              <div className="cart-item-actions">
                <strong>
                  {formatearCentavos(item.precioCentavos * item.cantidad)}
                </strong>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => onQuitar(item.id)}
                  aria-label={`Quitar ${item.nombre}`}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-summary" aria-live="polite">
        <span>Subtotal</span>
        <strong data-testid="subtotal">
          {formatearCentavos(calcularSubtotalCentavos(items))}
        </strong>
      </div>
      <p className="field-help">
        El subtotal incluye solo productos. La confirmación de pedidos todavía
        no está disponible.
      </p>
      <button
        className="button button-primary continue-shopping"
        type="button"
        onClick={onVolver}
      >
        Seguir eligiendo
      </button>
    </section>
  )
}
