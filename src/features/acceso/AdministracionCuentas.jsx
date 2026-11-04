import {useEffect,useRef,useState} from 'react'
import {navegar,useCambiosSinGuardar} from '../../navigation.js'
import {CATALOGO_PERMISOS,cambiarPermiso,listarCuentas,guardarCuenta} from './administracionRepository.js'
import './administracion.css'

function EditorCuenta({client,cuenta,negocios,onGuardado,onCancelar}){
 const [form,setForm]=useState(()=>structuredClone(cuenta))
 const [ocupado,setOcupado]=useState(false),[error,setError]=useState('')
 const bloqueo=useRef(false),dialogo=useRef(null)
 const sucio=JSON.stringify(form)!==JSON.stringify(cuenta)
 useCambiosSinGuardar(sucio)
 const admin=cuenta.rol==='administrador'
 function asociacion(id,cambio){setForm(f=>({...f,asociaciones:f.asociaciones.map(a=>a.emprendimiento_id===id?{...a,...cambio}:a)}))}
 async function guardar(){
  if(bloqueo.current)return
  bloqueo.current=true;setOcupado(true);setError('')
  try{await guardarCuenta(client,form);dialogo.current.close();onGuardado()}
  catch(e){dialogo.current.close();setError(e.message)}
  finally{bloqueo.current=false;setOcupado(false)}
 }
 return <section className="admin-editor" aria-label="Editar cuenta">
 <div className="admin-heading"><div><h2>{cuenta.email}</h2><p>{admin?'Administrador del sistema':'Configuración de acceso'}</p></div><button className="button button-outline" disabled={ocupado} onClick={()=>{if(!sucio||window.confirm('¿Descartar los cambios sin guardar?'))onCancelar()}}>Volver a usuarios</button></div>
 {error&&<p role="alert">{error}</p>}
 {admin?<p>Esta cuenta se administra mediante el procedimiento de aprovisionamiento del sistema.</p>:<form onSubmit={e=>{e.preventDefault();dialogo.current.showModal()}}>
 <fieldset disabled={ocupado}><legend>Cuenta</legend>
 <label className="admin-check"><input type="checkbox" checked={form.habilitada} onChange={e=>setForm({...form,habilitada:e.target.checked})}/>Cuenta habilitada</label>
 <label className="admin-check"><input type="checkbox" checked={form.rol==='emprendimiento'} onChange={e=>setForm({...form,rol:e.target.checked?'emprendimiento':'cliente',asociaciones:e.target.checked?form.asociaciones:[]})}/>Acceso interno a emprendimientos</label>
 {!form.habilitada&&<p>La cuenta no podrá realizar operaciones protegidas.</p>}
 {form.rol==='emprendimiento'&&<>
 <label className="admin-add">Agregar emprendimiento<select value="" onChange={e=>{const id=Number(e.target.value);if(id)setForm({...form,asociaciones:[...form.asociaciones,{emprendimiento_id:id,habilitada:true,permisos:[]}]})}}>
 <option value="">Seleccionar emprendimiento</option>{negocios.filter(n=>!form.asociaciones.some(a=>a.emprendimiento_id===n.id)).map(n=><option key={n.id} value={n.id}>{n.nombre}</option>)}</select></label>
 {!form.asociaciones.length&&<p>Sin emprendimientos asociados.</p>}
 {form.asociaciones.map(a=><section className="admin-association" key={a.emprendimiento_id}>
 <div className="admin-heading"><h3>{negocios.find(n=>n.id===a.emprendimiento_id)?.nombre??'Emprendimiento '+a.emprendimiento_id}</h3>
 <button type="button" className="button button-outline" onClick={()=>setForm({...form,asociaciones:form.asociaciones.filter(x=>x!==a)})}>Quitar asociación</button></div>
 <label className="admin-check"><input type="checkbox" checked={a.habilitada} onChange={e=>asociacion(a.emprendimiento_id,{habilitada:e.target.checked})}/>Acceso habilitado a este emprendimiento</label>
 <div className="admin-permissions">{CATALOGO_PERMISOS.map(([grupo,permisos])=><fieldset key={grupo}><legend>{grupo}</legend>{permisos.map(([p,texto])=><label className="admin-check" key={p}><input type="checkbox" checked={a.permisos.includes(p)} onChange={e=>asociacion(a.emprendimiento_id,{permisos:cambiarPermiso(a.permisos,p,e.target.checked)})}/>{texto}</label>)}</fieldset>)}</div>
 </section>)}
 </>}
 </fieldset>
 <div className="admin-actions"><button className="button button-primary" disabled={!sucio||ocupado}>Revisar cambios</button></div>
 </form>}
 <dialog ref={dialogo} className="admin-dialog" onCancel={e=>{if(ocupado)e.preventDefault()}}>
 <h2>Confirmar cambios de acceso</h2><p>{form.email}</p>
 <p>Cuenta {form.habilitada?'habilitada':'deshabilitada'} · {form.rol==='emprendimiento'?'Acceso interno':'Cliente'}</p>
 <ul>{form.asociaciones.map(a=><li key={a.emprendimiento_id}>{negocios.find(n=>n.id===a.emprendimiento_id)?.nombre}: {a.habilitada?a.permisos.length+' permisos':'acceso suspendido'}</li>)}</ul>
 <p>Los permisos anteriores se reemplazarán. Los cambios se aplican a las siguientes operaciones del usuario.</p>
 <div className="admin-actions"><button className="button button-outline" disabled={ocupado} onClick={()=>dialogo.current.close()}>Seguir editando</button><button className="button button-primary" disabled={ocupado} onClick={guardar}>{ocupado?'Guardando…':'Confirmar y guardar'}</button></div>
 </dialog>
 </section>
}

export default function AdministracionCuentas({client,negocios}){
 const [texto,setTexto]=useState(''),[busqueda,setBusqueda]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0)
 const [carga,setCarga]=useState({cargando:true,cuentas:[],error:'',hayMas:false})
 const [cuenta,setCuenta]=useState(null),[mensaje,setMensaje]=useState('')
 useEffect(()=>{
 let vigente=true
 listarCuentas(client,busqueda,offset).then(r=>{if(vigente)setCarga({...r,cargando:false,error:''})}).catch(e=>{if(vigente)setCarga({cargando:false,cuentas:[],hayMas:false,error:e.message})})
 return()=>{vigente=false}
 },[client,busqueda,offset,revision])
 function recargar(){setCarga({cargando:true,cuentas:[],error:'',hayMas:false});setRevision(r=>r+1)}
 return <section className="admin-accounts">
 <div className="admin-heading"><h1>Usuarios y permisos</h1><button className="button button-outline" onClick={()=>navegar('#/cuenta')}>Ver emprendimientos</button></div>
 {mensaje&&<p role="status">{mensaje}</p>}
 {cuenta?<EditorCuenta key={cuenta.usuario_id} client={client} cuenta={cuenta} negocios={negocios} onCancelar={()=>setCuenta(null)} onGuardado={()=>{setCuenta(null);setMensaje('Cuenta y permisos actualizados.');recargar()}}/>:<>
 <form className="admin-search" onSubmit={e=>{e.preventDefault();setBusqueda(texto.trim());setOffset(0);recargar();setMensaje('')}}><label>Buscar por correo<input type="search" maxLength={200} value={texto} onChange={e=>setTexto(e.target.value)}/></label><button className="button button-primary">Buscar</button></form>
 {carga.error&&<div role="alert">{carga.error} <button className="button" onClick={recargar}>Reintentar</button></div>}
 {carga.cargando?<p role="status">Cargando usuarios…</p>:<>
 {!carga.error&&!carga.cuentas.length&&<p>No se encontraron cuentas.</p>}
 <div className="admin-users">{carga.cuentas.map(c=><article key={c.usuario_id}><div><h2>{c.email}</h2><p>{c.rol==='emprendimiento'?'Emprendimiento':c.rol==='administrador'?'Administrador':'Cliente'} · {c.habilitada?'Habilitada':'Deshabilitada'}</p><p>{c.asociaciones.filter(a=>a.habilitada).length} emprendimientos habilitados</p></div><button className="button button-outline" onClick={()=>{setCuenta(c);setMensaje('')}}>{c.rol==='administrador'?'Consultar':'Administrar'}<span className="sr-only"> {c.email}</span></button></article>)}</div>
 <div className="admin-actions"><button className="button button-outline" disabled={offset===0} onClick={()=>{setOffset(o=>Math.max(0,o-20));recargar()}}>Anterior</button><span>Página {offset/20+1}</span><button className="button button-outline" disabled={!carga.hayMas} onClick={()=>{setOffset(o=>o+20);recargar()}}>Siguiente</button></div>
 </>}
 </>}
 </section>
}
