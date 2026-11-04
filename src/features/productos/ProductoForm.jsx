import {useCambiosSinGuardar} from '../../navigation.js'
import ImagenProducto from './ImagenProducto.jsx'
import { validarImagen } from './imagenes.js'
import { useRef, useState } from 'react'
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
  guardando = false,
  client,
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
  const [esCombo,setEsCombo]=useState(producto?.esCombo??false)
  const [componentes,setComponentes]=useState(producto?.componentes??[])
  const [archivoImagen, setArchivoImagen] = useState(null)
  const [inicial]=useState(()=>JSON.stringify({campos,esCombo,componentes}))
  useCambiosSinGuardar(!!archivoImagen||JSON.stringify({campos,esCombo,componentes})!==inicial)
  const archivoInput = useRef(null)
  function seleccionarImagen(evento) {
    const archivo = evento.target.files?.[0]
    if (!archivo) return
    try { validarImagen(archivo); setArchivoImagen(archivo); setErrores(actual => ({ ...actual, imagen: undefined })) }
    catch (error) { setErrores(actual => ({ ...actual, imagen: error.message })); evento.target.value = '' }
  }
  const [errores, setErrores] = useState({})
  const estaEditando = Boolean(producto)

  function actualizarCampo(evento) {
    const { name, value } = evento.target
    setCampos((camposActuales) => ({ ...camposActuales, [name]: value }))
    setErrores((erroresActuales) => ({ ...erroresActuales, [name]: undefined }))
  }

  async function enviarFormulario(evento) {
    evento.preventDefault()
    if (guardando || errores.imagen) return
    const resultado = validarProducto(
      campos,
      productosExistentes,
      producto?.id ?? null,
    )

    if (!resultado.esValido) {
      setErrores(resultado.errores)
      return
    }

    if ((esCombo&&!componentes.length)||componentes.some(c=>!c.componente_id||!Number.isInteger(Number(c.cantidad))||Number(c.cantidad)<1||Number(c.cantidad)>999)||new Set(componentes.map(c=>String(c.componente_id))).size!==componentes.length) {setErrores({...errores,componentes:'Seleccioná componentes distintos y cantidades enteras de 1 a 999. Un combo requiere al menos uno.'});return}
    const composicion=(esCombo||componentes.length||producto?.componentes)?{esCombo,componentes:componentes.map(c=>({componente_id:Number(c.componente_id),cantidad:Number(c.cantidad)}))}:{}
    if (await onGuardar(archivoImagen ? { ...resultado.datosNormalizados, ...composicion, archivoImagen } : {...resultado.datosNormalizados,...composicion}) === false) return
    setArchivoImagen(null)
    if (archivoInput.current) archivoInput.current.value = ''
    setCampos(FORMULARIO_VACIO)
    setEsCombo(false);setComponentes([])
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
        <fieldset className="form-fields" disabled={guardando}>
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

        <div className="field-group image-field">
          <label htmlFor="imagenArchivo">Imagen del producto</label>
          <ImagenProducto client={client} ruta={campos.imagenPath} archivo={archivoImagen} nombre={campos.nombre || 'Vista previa del producto'} />
          <input ref={archivoInput} id="imagenArchivo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="imagen-help" aria-invalid={Boolean(errores.imagen)} onChange={seleccionarImagen} />
          <p className="field-help" id="imagen-help">Opcional. JPG, PNG o WebP, hasta 5 MB. La imagen se guarda junto con el producto.</p>
          {errores.imagen && <p className="field-error" role="alert">{errores.imagen}</p>}
          {(archivoImagen || campos.imagenPath || errores.imagen) && <button className="button button-secondary" type="button" onClick={() => { setArchivoImagen(null); setCampos(actual => ({ ...actual, imagenPath: '' })); setErrores(actual => ({ ...actual, imagen: undefined })); if (archivoInput.current) archivoInput.current.value = '' }}>Quitar imagen</button>}
        </div>

<section className="product-composition" aria-label="Composición del producto">
          <h3>Componentes obligatorios</h3>
          <label className="combo-toggle"><input type="checkbox" checked={esCombo} onChange={e=>setEsCombo(e.target.checked)}/> Es un combo: utiliza únicamente el stock de sus componentes</label>
          <p>{esCombo?'El combo tiene su propio precio. No se cargan existencias del combo.':'Este producto usa sus propias existencias y las de los componentes que agregues.'} Los componentes no suman precio al carrito.</p>
          {componentes.map((c,i)=><div className="composition-row" key={i}>
           <div className="field-group"><label htmlFor={'componente-'+i}>Componente {i+1}</label><select id={'componente-'+i} value={c.componente_id} onChange={e=>setComponentes(cs=>cs.map((x,j)=>j===i?{...x,componente_id:e.target.value}:x))}><option value="">Seleccionar producto</option>{productosExistentes.filter(p=>p.id!==producto?.id).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
           <div className="field-group"><label htmlFor={'componente-cantidad-'+i}>Cantidad del componente {i+1}</label><input id={'componente-cantidad-'+i} type="number" min="1" max="999" step="1" value={c.cantidad} onChange={e=>setComponentes(cs=>cs.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}/></div>
           <button className="button button-secondary" type="button" aria-label={'Quitar componente '+(i+1)} onClick={()=>setComponentes(cs=>cs.filter((_,j)=>j!==i))}>Quitar</button>
          </div>)}
          <button className="button button-secondary" type="button" disabled={componentes.length>=50} onClick={()=>setComponentes(cs=>[...cs,{componente_id:'',cantidad:1}])}>Agregar componente</button>
          {errores.componentes&&<p role="alert" className="field-error">{errores.componentes}</p>}
        </section>
        <div className="form-actions">
          <button className="button button-primary" type="submit">
            {guardando ? 'Guardando…' : estaEditando ? 'Guardar cambios' : 'Crear producto'}
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
        </fieldset>
      </form>
    </section>
  )
}

export default ProductoForm
