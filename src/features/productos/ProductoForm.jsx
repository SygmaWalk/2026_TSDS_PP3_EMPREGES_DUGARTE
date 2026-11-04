import { useState } from 'react'
import { validarProducto } from './producto.js'

const FORMULARIO_VACIO = {
  nombre: '',
  descripcion: '',
  precio: '',
  imagenPath: '',
}

function ProductoForm({
  producto,
  productosExistentes,
  onGuardar,
  onCancelar,
}) {
  const [campos, setCampos] = useState(() =>
    producto
      ? {
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? '',
          precio: String(producto.precio).replace('.', ','),
          imagenPath: producto.imagenPath ?? '',
        }
      : FORMULARIO_VACIO,
  )
  const [errores, setErrores] = useState({})
  const estaEditando = Boolean(producto)

  function actualizarCampo(evento) {
    const { name, value } = evento.target
    setCampos((camposActuales) => ({ ...camposActuales, [name]: value }))
    setErrores((erroresActuales) => ({ ...erroresActuales, [name]: undefined }))
  }

  function enviarFormulario(evento) {
    evento.preventDefault()
    const resultado = validarProducto(
      campos,
      productosExistentes,
      producto?.id ?? null,
    )

    if (!resultado.esValido) {
      setErrores(resultado.errores)
      return
    }

    if (onGuardar(resultado.datosNormalizados) === false) return
    setCampos(FORMULARIO_VACIO)
    setErrores({})
  }

  return (
    <section className="panel form-panel" aria-labelledby="form-title">
      <div className="panel-heading">
        <h2 id="form-title">
          {estaEditando ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <p>Los campos marcados con * son obligatorios.</p>
      </div>

      <form className="product-form" noValidate onSubmit={enviarFormulario}>
        <div className="field-group">
          <label htmlFor="nombre">
            Nombre <span className="required">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            value={campos.nombre}
            onChange={actualizarCampo}
            aria-invalid={Boolean(errores.nombre)}
            aria-describedby={errores.nombre ? 'nombre-error' : undefined}
            autoComplete="off"
          />
          {errores.nombre && (
            <p id="nombre-error" className="field-error">
              {errores.nombre}
            </p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={campos.descripcion}
            onChange={actualizarCampo}
          />
        </div>

        <div className="field-group">
          <label htmlFor="precio">
            Precio <span className="required">*</span>
          </label>
          <input
            id="precio"
            name="precio"
            value={campos.precio}
            onChange={actualizarCampo}
            aria-invalid={Boolean(errores.precio)}
            aria-describedby={errores.precio ? 'precio-error' : 'precio-help'}
            inputMode="decimal"
            placeholder="Ej.: 8500 o 8500,50"
            autoComplete="off"
          />
          {errores.precio ? (
            <p id="precio-error" className="field-error">
              {errores.precio}
            </p>
          ) : (
            <p id="precio-help" className="field-help">
              Podés usar coma o punto y hasta dos decimales.
            </p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="imagenPath">Ruta de imagen</label>
          <input
            id="imagenPath"
            name="imagenPath"
            value={campos.imagenPath}
            onChange={actualizarCampo}
            placeholder="productos/nombre-del-archivo.webp"
            autoComplete="off"
          />
        </div>

        <div className="form-actions">
          <button className="button button-primary" type="submit">
            {estaEditando ? 'Guardar cambios' : 'Crear producto'}
          </button>
          {estaEditando && (
            <button
              className="button button-secondary"
              type="button"
              onClick={onCancelar}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

export default ProductoForm
