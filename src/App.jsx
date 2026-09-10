import { useState } from 'react'
import './App.css'
import ProductoForm from './features/productos/ProductoForm.jsx'
import ProductoList from './features/productos/ProductoList.jsx'
import {
  actualizarProducto,
  crearProducto,
} from './features/productos/producto.js'

function App() {
  const [productos, setProductos] = useState([])
  const [productoEnEdicion, setProductoEnEdicion] = useState(null)
  const [mensaje, setMensaje] = useState('')

  function guardarProducto(datos) {
    if (productoEnEdicion) {
      const productoActualizado = actualizarProducto(productoEnEdicion, datos)

      setProductos((productosActuales) =>
        productosActuales.map((producto) =>
          producto.id === productoActualizado.id ? productoActualizado : producto,
        ),
      )
      setProductoEnEdicion(null)
      setMensaje(`Se actualizó “${productoActualizado.nombre}”.`)
      return
    }

    const productoNuevo = crearProducto(datos)
    setProductos((productosActuales) => [...productosActuales, productoNuevo])
    setMensaje(`Se creó “${productoNuevo.nombre}” como producto oculto.`)
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">EmpreGest · Administración</span>
          <h1>Productos</h1>
          <p>Creá y mantené actualizada la información básica de tu catálogo.</p>
        </div>
        <span className="demo-badge">Modo demostración</span>
      </header>

      <div className="demo-note" role="note">
        Los cambios se conservan durante esta sesión. La conexión de escritura con
        Supabase se habilitará al implementar usuarios, roles y permisos por
        emprendimiento.
      </div>

      {mensaje && (
        <p className="feedback" role="status">
          {mensaje}
        </p>
      )}

      <div className="workspace-grid">
        <ProductoForm
          key={productoEnEdicion?.id ?? 'nuevo'}
          producto={productoEnEdicion}
          productosExistentes={productos}
          onGuardar={guardarProducto}
          onCancelar={cancelarEdicion}
        />
        <ProductoList productos={productos} onEditar={comenzarEdicion} />
      </div>
    </main>
  )
}

export default App
