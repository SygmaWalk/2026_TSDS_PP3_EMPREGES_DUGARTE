import ConfirmarPedido from '../pedidos/ConfirmarPedido.jsx'
import { claveConfirmacion, leerConfirmacion, guardarConfirmacion } from '../pedidos/pedidosRepository.js'
import { useEffect, useState } from 'react'
import PlantillaTienda from './PlantillaTienda.jsx'
import CatalogoPreview from '../productos/CatalogoPreview.jsx'
import Carrito from '../carrito/Carrito.jsx'
import { cargarTienda } from './catalogoRepository.js'
import { claveCarritoInvitado, recuperarCarrito, guardarCarrito } from '../carrito/carritoStorage.js'
import { agregarAlCarrito, cambiarCantidad, quitarDelCarrito, calcularSubtotalCentavos, formatearCentavos } from '../carrito/carrito.js'

export default function TiendaPublica({ client, pedidoClient = client, identidad = 'invitado', slug, perfil, usuario }) {
  const clave = claveConfirmacion(slug, identidad)
  const [estado, setEstado] = useState({ cargando: true, negocio: null, productos: [], items: [], error: '', aviso: '' })
  const [vista, setVista] = useState('catalogo')
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    let solicitud = 0
    async function cargar() {
      const actual = ++solicitud
      try {
        const recuperado = leerConfirmacion(clave)
        if (recuperado?.negocio) {
          let aviso = ''
          if (recuperado.estado === 'confirmado' && !recuperado.carritoVaciado) {
            aviso = guardarCarrito(claveCarritoInvitado(recuperado.negocio.id), [])
            if (!aviso) guardarConfirmacion(clave, {...recuperado,carritoVaciado:true})
          }
          setEstado({cargando:false,negocio:recuperado.negocio,productos:[],items:[],error:'',aviso})
          return
        }
        const tienda = await cargarTienda(client, slug)
        if (!vigente || actual !== solicitud) return
        if (!tienda) { setEstado({ cargando: false, negocio: null, productos: [], items: [], error: '', aviso: '' }); return }
        const guardado = recuperarCarrito(claveCarritoInvitado(tienda.negocio.id), tienda.productos)
        const aviso = guardado.aviso || guardarCarrito(claveCarritoInvitado(tienda.negocio.id), guardado.items)
        setEstado({ cargando: false, ...tienda, items: guardado.items, error: '', aviso })
      } catch (fallo) {
        if (vigente && actual === solicitud) setEstado(actual => ({ ...actual, cargando: false, error: fallo.message }))
      }
    }
    cargar()
    window.addEventListener('focus', cargar)
    return () => { vigente = false; window.removeEventListener('focus', cargar) }
  }, [client, slug, intento, clave])
  function cambiar(operacion, texto) {
    try {
      const items = operacion(estado.items)
      const aviso = guardarCarrito(claveCarritoInvitado(estado.negocio.id), items)
      setEstado({ ...estado, items, aviso }); setMensaje(texto); setErrorAccion('')
    } catch (error) { setErrorAccion(error.message); setMensaje('') }
  }
  function recordarTienda(){try{sessionStorage.setItem('empreges:retorno-compra','#/tienda/'+slug)}catch{/* El carrito sigue guardado. */}}
  const confirmando = vista === 'confirmar' || Boolean(leerConfirmacion(clave))
  const unidades = estado.items.reduce((s, i) => s + i.cantidad, 0)
  return <PlantillaTienda client={client} negocio={estado.negocio} usuario={usuario} publicada={estado.negocio?.apariencia}>
    {estado.cargando ? <div className="store-state" role="status">Cargando tienda…</div> :
      estado.error ? <section className="store-state"><h1>No pudimos cargar la tienda</h1><p role="alert">{estado.error}</p><button className="button button-primary" onClick={() => setIntento(intento + 1)}>Reintentar</button></section> :
        !estado.negocio ? <section className="store-state"><span className="eyebrow">TIENDA NO DISPONIBLE</span><h1>No encontramos esta tienda</h1><p>Revisá el enlace o consultá al emprendimiento. Puede que la tienda ya no esté activa.</p></section> :
          <>
            <div className="store-container store-content">
              <nav hidden={confirmando} className="store-navigation" aria-label="Tienda"><button className={'store-tab ' + (vista === 'catalogo' ? 'store-tab-active' : '')} aria-current={vista === 'catalogo' ? 'page' : undefined} onClick={() => setVista('catalogo')}>Catálogo</button><button className={'store-tab ' + (vista === 'carrito' ? 'store-tab-active' : '')} aria-current={vista === 'carrito' ? 'page' : undefined} onClick={() => setVista('carrito')}>Carrito ({unidades})</button><button className="store-refresh" onClick={() => setIntento(intento + 1)}>Actualizar catálogo</button></nav>
              {estado.aviso && <p role="alert" className="error-feedback">{estado.aviso}</p>}
              {errorAccion && <p role="alert" className="error-feedback">{errorAccion}</p>}
              {mensaje && <p role="status" className="feedback">{mensaje}</p>}
              {confirmando&&!usuario&&leerConfirmacion(clave)?.estado!=='confirmado'?<section className="panel checkout-panel"><h2>Ingresá para confirmar tu pedido</h2><p>Tu carrito está guardado. Iniciá sesión o creá una cuenta de cliente para continuar.</p><div className="form-actions"><a className="button button-primary" href="#/ingresar" onClick={recordarTienda}>Iniciar sesión</a><a className="button button-secondary" href="#/registro" onClick={recordarTienda}>Crear cuenta</a><button className="button button-secondary" onClick={()=>setVista('carrito')}>Volver al carrito</button></div></section>:confirmando ? <ConfirmarPedido perfil={perfil} key={clave} clave={clave} client={pedidoClient} negocio={estado.negocio} items={estado.items}
                onConfirmado={() => { const aviso = guardarCarrito(claveCarritoInvitado(estado.negocio.id), []); setEstado(actual => ({...actual,items:[],aviso})); setMensaje(''); return aviso }}
                onVolver={destino => { setVista(destino); setIntento(actual=>actual+1); setMensaje('') }} /> : vista === 'catalogo' ? <div className="store-catalog-layout"><CatalogoPreview presentacion={estado.negocio?.apariencia?.presentacion} ordenProductos={estado.negocio?.apariencia?.ordenProductos} client={client} publico productos={estado.productos} onAgregar={producto => cambiar(items => agregarAlCarrito(items, producto), 'Se agregó “' + producto.nombre + '” al carrito.')} /><aside className="store-cart-summary"><span className="eyebrow">TU SELECCIÓN</span><h2>Tu carrito</h2><p>{unidades ? unidades + ' unidades seleccionadas' : 'Todavía no agregaste productos.'}</p><strong>{formatearCentavos(calcularSubtotalCentavos(estado.items))}</strong><button className="button button-primary" onClick={() => setVista('carrito')}>Ver carrito</button><small>Tu selección se conserva en este navegador. Para confirmar el pedido necesitás una cuenta de cliente.</small></aside></div> :
                <Carrito onConfirmar={() => { setVista('confirmar'); setMensaje('') }} items={estado.items} onCantidad={(id, cantidad) => cambiar(items => cambiarCantidad(items, id, cantidad), 'Cantidad actualizada.')} onQuitar={id => cambiar(items => quitarDelCarrito(items, id), 'Producto retirado del carrito.')} onVolver={() => setVista('catalogo')} />}
            </div>
          </>}
  </PlantillaTienda>
}
