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

export default function Carrito({ items, onCantidad, onQuitar, onVolver, onConfirmar, productos = [], onAdicionales }) {
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
                {onAdicionales && productos.find(p=>p.id===item.id)?.adicionales?.length > 0 && <fieldset>
                  <legend>Adicionales por unidad de {item.nombre}</legend>
                  {productos.find(p=>p.id===item.id).adicionales.map(a=>{
                    const seleccion = (item.adicionales ?? []).map(extra=>extra.id)
                    return <label key={a.id}><input type="checkbox" checked={seleccion.includes(a.id)}
                      onChange={e=>onAdicionales(item.id,e.target.checked ? [...seleccion,a.id] : seleccion.filter(id=>id!==a.id))}/>
                      {a.nombre} (+{formatearCentavos(a.centavos)})</label>
                  })}
                </fieldset>}
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
        {onConfirmar ? 'El subtotal incluye solo productos. Iniciá sesión con tu cuenta de cliente para confirmar.' : 'El subtotal incluye solo productos. Para confirmar un pedido, abrí la tienda pública.'}
      </p>
      {onConfirmar && <button className="button button-primary" disabled={!items.length} onClick={onConfirmar}>Continuar con el pedido</button>}
      <button
        className="button button-secondary continue-shopping"
        type="button"
        onClick={onVolver}
      >
        Seguir eligiendo
      </button>
    </section>
  )
}
