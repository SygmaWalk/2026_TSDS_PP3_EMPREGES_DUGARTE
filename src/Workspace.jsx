import { useState } from 'react'
import { claveCarrito, recuperarCarrito, guardarCarrito } from './features/carrito/carritoStorage.js'
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

function Workspace({ repository = null, productosIniciales = [], negocio = null, usuarioId = null, onVolver }) {
  const [productos, setProductos] = useState(productosIniciales)
  const [guardando, setGuardando] = useState(false)
  const [productoEnEdicion, setProductoEnEdicion] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [vista, setVista] = useState('productos')
  const clave = claveCarrito(usuarioId, negocio?.id)
  const [restaurado] = useState(() => recuperarCarrito(clave, negocio?.activo === false ? [] : productosIniciales))
  const [carrito, setCarrito] = useState(restaurado.items)
  const [avisoCarrito, setAvisoCarrito] = useState(restaurado.aviso)
  const unidades = carrito.reduce((total, item) => total + item.cantidad, 0)
  const productosVisibles = negocio?.activo === false ? [] : obtenerProductosVisibles(productos)

  function actualizarCarrito(items) {
    setCarrito(items)
    setAvisoCarrito(guardarCarrito(clave, items))
  }
  function navegar(siguienteVista) {
    setVista(siguienteVista)
    setMensaje('')
    setError('')
  }

  function actualizarCatalogo(siguientes) {
    // Calculamos primero: si el nuevo precio excede el límite, no queda un cambio parcial.
    let carritoActualizado
    try {
      carritoActualizado = sincronizarCarrito(carrito, siguientes)
    } catch {
      // Una actualización ya confirmada en el servidor no se debe presentar como fallida.
      carritoActualizado = []
    }
    setProductos(siguientes)
    actualizarCarrito(carritoActualizado)
  }

  function agregarProducto(producto) {
    try {
      actualizarCarrito(agregarAlCarrito(carrito, producto))
      setError('')
      setMensaje(`Se agregó “${producto.nombre}” al carrito.`)
    } catch (fallo) {
      setError(fallo.message)
      setMensaje('')
    }
  }

  function actualizarCantidad(id, cantidad) {
    try {
      actualizarCarrito(cambiarCantidad(carrito, id, cantidad))
      setError('')
      setMensaje('Se actualizó la cantidad y el subtotal.')
    } catch (fallo) {
      setError(fallo.message)
      setMensaje('')
    }
  }

  function quitarProducto(id) {
    actualizarCarrito(quitarDelCarrito(carrito, id))
    setError('')
    setMensaje('Se quitó el producto del carrito.')
  }

  async function guardarProducto(datos) {
    if (guardando) return false
    setGuardando(true)
    try {
      const producto = repository
        ? productoEnEdicion
          ? await repository.editar(productoEnEdicion.id, datos)
          : await repository.crear(datos)
        : productoEnEdicion
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
    } finally {
      setGuardando(false)
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

  async function cambiarVisibilidad(productoSeleccionado) {
    if (guardando) return
    setGuardando(true)
    try {
      const productoActualizado = repository
        ? await repository.visibilidad(productoSeleccionado.id, !productoSeleccionado.visible)
        : cambiarVisibilidadProducto(productoSeleccionado)

      actualizarCatalogo(
        productos.map((producto) =>
          producto.id === productoActualizado.id ? productoActualizado : producto,
        ),
      )
      setError('')
      setMensaje(
        productoActualizado.visible
          ? `“${productoActualizado.nombre}” ahora aparece en la vista previa del catálogo.`
          : `“${productoActualizado.nombre}” quedó oculto y se retiró del carrito si estaba seleccionado.`,
      )
    } catch (fallo) {
      setError(fallo.message)
      setMensaje('')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">EmpreGest · Administración</span>
          <h1>
            {vista === 'productos'
              ? 'Productos'
              : vista === 'catalogo'
                ? 'Catálogo'
                : 'Carrito'}
          </h1>
          <p>{negocio ? negocio.nombre : 'Gestioná tu catálogo y probá el recorrido de compra.'}</p>
        </div>
        {repository ? <button className="button" disabled={guardando} onClick={onVolver}>Mis emprendimientos</button> : <span className="demo-badge">Modo demostración</span>}
      </header>

      <dl className="workspace-summary" aria-label="Resumen del emprendimiento">
        <div><dt>Productos cargados</dt><dd>{productos.length}</dd></div>
        <div><dt>Visibles en el catálogo</dt><dd>{productosVisibles.length}</dd></div>
        <div><dt>Unidades en el carrito</dt><dd>{unidades}</dd></div>
      </dl>

      <div className="demo-note" role="note">
        {repository
          ? 'Los productos se guardan en tu emprendimiento. El carrito se conserva en este navegador al recargar y al volver al mismo emprendimiento. Todavía no se pueden confirmar pedidos.'
          : 'Demostración: productos y carrito se conservan al cambiar de pantalla, pero se pierden al recargar. Todavía no se pueden confirmar pedidos.'}
      </div>

      <nav className="view-nav" aria-label="Pantallas del emprendimiento">
        <button
          className="button"
          aria-current={vista === 'productos' ? 'page' : undefined}
          disabled={guardando}
          onClick={() => navegar('productos')}
        >
          Productos
        </button>
        <button
          className="button"
          aria-current={vista === 'catalogo' ? 'page' : undefined}
          disabled={guardando}
          onClick={() => navegar('catalogo')}
        >
          Catálogo
        </button>
        <button
          className="button"
          aria-current={vista === 'carrito' ? 'page' : undefined}
          disabled={guardando}
          onClick={() => navegar('carrito')}
        >
          Carrito ({unidades})
        </button>
      </nav>

      <div className="view-introduction">
        <span className="eyebrow">{vista === 'productos' ? 'Gestión de productos' : 'Vista previa de compra'}</span>
        <p>{vista === 'productos'
          ? 'Creá o editá productos. Pulsá Mostrar cuando quieras incluirlos en el catálogo.'
          : vista === 'catalogo'
            ? 'Probá cómo se eligen los productos. Esta vista todavía está dentro del panel; el acceso público sigue pendiente.'
            : 'Revisá cantidades y subtotal. La confirmación del pedido estará disponible más adelante.'}</p>
      </div>

      {avisoCarrito && <p className="error-feedback" role="alert">{avisoCarrito}</p>}
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
          productos={productosVisibles}
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
            guardando={guardando}
            productosExistentes={productos}
            onGuardar={guardarProducto}
            onCancelar={cancelarEdicion}
          />
          <div className="right-column">
            <ProductoList
              productos={productos}
              guardando={guardando}
              onEditar={comenzarEdicion}
              onCambiarVisibilidad={cambiarVisibilidad}
            />
            <CatalogoPreview productos={productosVisibles} />
          </div>
        </div>
      )}
    </main>
  )
}

export default Workspace
