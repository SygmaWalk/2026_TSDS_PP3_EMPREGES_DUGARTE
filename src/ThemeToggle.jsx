import {useEffect,useLayoutEffect,useState} from 'react'
import './theme.css'
const clave='empreges:tema'
function preferencia(){
 try{const valor=localStorage.getItem(clave);if(valor==='dark'||valor==='light')return valor}catch{/* Preferencia opcional. */}
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'
}
export default function ThemeToggle(){
 const [tema,setTema]=useState(preferencia)
 useLayoutEffect(()=>{document.documentElement.dataset.theme=tema;document.documentElement.style.colorScheme=tema},[tema])
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-color-scheme: dark)')
  const sistema=()=>{try{if(localStorage.getItem(clave))return}catch{/* Sin persistencia. */}setTema(media.matches?'dark':'light')}
  const compartir=e=>{if(e.key===clave||e.key===null)setTema(preferencia())}
  media?.addEventListener('change',sistema);window.addEventListener('storage',compartir)
  return()=>{media?.removeEventListener('change',sistema);window.removeEventListener('storage',compartir)}
 },[])
 function alternar(){const siguiente=tema==='dark'?'light':'dark';setTema(siguiente);try{localStorage.setItem(clave,siguiente)}catch{/* Funciona durante esta sesión. */}}
 return <button className="theme-toggle" type="button" aria-label={tema==='dark'?'Activar tema claro':'Activar tema oscuro'} aria-pressed={tema==='dark'} onClick={alternar}><span aria-hidden="true">{tema==='dark'?'☀':'☾'}</span><span>{tema==='dark'?'Tema claro':'Tema oscuro'}</span></button>
}
