import {useEffect,useSyncExternalStore} from 'react'
const listeners=new Set(),guards=new Set()
let accepted=window.location.hash,index=history.state?.empregesIndex??0,restoring=false
export function confirmarSalida(){return [...guards].every(g=>g())}
function emitir(){listeners.forEach(l=>l())}
function marcar(ruta){history.replaceState({...history.state,empregesIndex:index},'',location.pathname+location.search+ruta)}
function cambio(){
 if(restoring){restoring=false;accepted=window.location.hash;return}
 const target=history.state?.empregesIndex
 if(window.location.hash!==accepted&&!confirmarSalida()){
  if(Number.isInteger(target)&&target!==index){restoring=true;history.go(index-target)}
  else marcar(accepted)
  return
 }
 if(Number.isInteger(target)&&target!==index)index=target
 else{index++;marcar(window.location.hash)}
 accepted=window.location.hash;emitir()
}
function subscribe(listener){
 if(!listeners.size){accepted=window.location.hash;index=history.state?.empregesIndex??0;marcar(accepted);window.addEventListener('hashchange',cambio)}
 listeners.add(listener)
 return()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener('hashchange',cambio)}
}
export function useRuta(){return useSyncExternalStore(subscribe,()=>window.location.hash)}
export function navegar(ruta,{replace=false}={}){
 if(ruta===window.location.hash)return true
 if(!confirmarSalida())return false
 accepted=ruta
 if(replace)marcar(ruta)
 else{index++;history.pushState({empregesIndex:index},'',location.pathname+location.search+ruta)}
 emitir();return true
}
export function useCambiosSinGuardar(sucio){
 useEffect(()=>{
  if(!sucio)return
  const confirmar=()=>window.confirm('Hay cambios sin guardar. ¿Querés salir y descartarlos?')
  const antes=e=>{e.preventDefault();e.returnValue=''}
  guards.add(confirmar);window.addEventListener('beforeunload',antes)
  return()=>{guards.delete(confirmar);window.removeEventListener('beforeunload',antes)}
 },[sucio])
}
export const SECCIONES=[['pedidos','Pedidos','pedidos.ver'],['productos','Productos','productos.ver'],['stock','Inventario','stock.ver'],['clientes','Clientes','clientes.ver'],['apariencia','Tienda','tienda.configurar'],['entregas','Entregas','entregas.configurar']]
export const inicioNegocio=n=>SECCIONES.find(s=>n.permisos.includes(s[2]))?.[0]??'sin-acceso'
export const rutaNegocio=(id,seccion,detalle='')=>'#/panel/'+id+'/'+seccion+(detalle?'/'+detalle:'')
export function leerRuta(hash){const m=/^#\/panel\/(\d+)\/([a-z-]+)(?:\/(\d+))?(?:\?.*)?$/.exec(hash);return m?{id:Number(m[1]),seccion:m[2],detalle:m[3]?Number(m[3]):null}:null}
