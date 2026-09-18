import { useState } from 'react'
import './App.css'
import ProductoForm from './features/productos/ProductoForm.jsx'
import ProductoList from './features/productos/ProductoList.jsx'
import {
  actualizarProducto,
  cambiarVisibilidadProducto,
  crearProducto,
  obtenerProductosVisibles,
} from './features/productos/producto.js'
import CatalogoPreview from './features/productos/CatalogoPreview.jsx'
import Carrito from './features/carrito/Carrito.jsx'
import {
  agregarAlCarrito,
  cambiarCantidad,
  quitarDelCarrito,
  sincronizarCarrito,
} from './features/carrito/carrito.js'

function App() {
  const [productos, setProductos] = useState([])
  const [productoEnEdicion, setProductoEnEdicion] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [vista, setVista] = useState('productos')
  const [carrito, setCarrito] = useState([])
  const unidades = carrito.reduce((total, item) => total + item.cantidad, 0)

  function navegar(siguienteVista) {
    setVista(siguienteVista)
    setMensaje('')
    setError('')
  }

  function actualizarCatalogo(siguientes) {
    // Calculamos primero: si el nuevo precio excede el límite, no queda un cambio parcial.
    const carritoActualizado = sincronizarCarrito(carrito, siguientes)
    setProductos(siguientes)
    setCarrito(carritoActualizado)
  }

  function agregarProducto(producto) {
    try {
      setCarrito(agregarAlCarrito(carrito, producto))
      setError('')
      setMensaje(`Se agregó “${producto.nombre}” al carrito.`)
    } catch (fallo) {
      setError(fallo.message)
      setMensaje('')
    }
  }

  function actualizarCantidad(id, cantidad) {
    try {
      setCarrito(cambiarCantidad(carrito, id, cantidad))
      setError('')
      setMensaje('Se actualizó la cantidad y el subtotal.')
    } catch (fallo) {
      setError(fallo.message)
      setMensaje('')
    }
  }

  function quitarProducto(id) {
    setCarrito(quitarDelCarrito(carrito, id))
    setError('')
    setMensaje('Se quitó el producto del carrito.')
  }

  function guardarProducto(datos) {
    try {
      const producto = productoEnEdicion
        ? actualizarProducto(productoEnEdicion, datos)
        : crearProducto(datos)
      const siguientes = productoEnEdicion
        ? productos.map((actual) =>
            actual.id === producto.id ? producto : actual,
          )
        : [...productos, producto]
      actualizarCatalogo(siguientes)
      setProductoEnEdicion(null)
      setError('')
      setMensaje(
        productoEnEdicion
          ? `Se actualizó “${producto.nombre}”. Su precio también se actualiza en el carrito.`
          : `Se creó “${producto.nombre}” como producto oculto.`,
      )
    } catch (fallo) {
      setError(fallo.message)
      setMensaje('')
      return false
    }
  }

  function comenzarEdicion(producto) {
    setProductoEnEdicion(producto)
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicion() {
    setProductoEnEdicion(null)
    setMensaje('No se realizaron cambios.')
  }

  function cambiarVisibilidad(productoSeleccionado) {
    const productoActualizado = cambiarVisibilidadProducto(productoSeleccionado)

    actualizarCatalogo(
      productos.map((producto) =>
        producto.id === productoActualizado.id ? productoActualizado : producto,
      ),
    )
    setError('')
    setMensaje(
      productoActualizado.visible
        ? `“${productoActualizado.nombre}” ahora aparece en el catálogo público.`
        : `“${productoActualizado.nombre}” quedó oculto y se retiró del carrito si estaba seleccionado.`,
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">EmpreGest</span>
          <h1>
            {vista === 'productos'
              ? 'Productos'
              : vista === 'catalogo'
                ? 'Catálogo'
                : 'Carrito'}
          </h1>
          <p>Gestioná tu catálogo y probá el recorrido de compra.</p>
        </div>
        <span className="demo-badge">Modo demostración</span>
      </header>

      <div className="demo-note" role="note">
        Demostración: productos y carrito se conservan al cambiar de pantalla,
        pero se pierden al recargar. Todavía no se pueden confirmar pedidos.
      </div>

      <nav className="view-nav" aria-label="Pantallas de demostración">
        <button
          className="button"
          aria-current={vista === 'productos' ? 'page' : undefined}
          onClick={() => navegar('productos')}
        >
          Productos
        </button>
        <button
          className="button"
          aria-current={vista === 'catalogo' ? 'page' : undefined}
          onClick={() => navegar('catalogo')}
        >
          Catálogo
        </button>
        <button
          className="button"
          aria-current={vista === 'carrito' ? 'page' : undefined}
          onClick={() => navegar('carrito')}
        >
          Carrito ({unidades})
        </button>
      </nav>

      {error && (
        <p className="error-feedback" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="feedback" role="status">
          {mensaje}
        </p>
      )}

      {vista === 'catalogo' && (
        <CatalogoPreview
          productos={obtenerProductosVisibles(productos)}
          onAgregar={agregarProducto}
        />
      )}
      {vista === 'carrito' && (
        <Carrito
          items={carrito}
          onCantidad={actualizarCantidad}
          onQuitar={quitarProducto}
          onVolver={() => navegar('catalogo')}
        />
      )}
      {vista === 'productos' && (
        <div className="workspace-grid">
          <ProductoForm
            key={productoEnEdicion?.id ?? 'nuevo'}
            producto={productoEnEdicion}
            productosExistentes={productos}
            onGuardar={guardarProducto}
            onCancelar={cancelarEdicion}
          />
          <div className="right-column">
            <ProductoList
              productos={productos}
              onEditar={comenzarEdicion}
              onCambiarVisibilidad={cambiarVisibilidad}
            />
            <CatalogoPreview productos={obtenerProductosVisibles(productos)} />
          </div>
        </div>
      )}
    </main>
  )
}

export default App
