let carga
export function cargarGoogleMaps(){
 if(carga)return carga
 carga=new Promise((resolve,reject)=>{
  const script=document.createElement('script')
  let terminado=false
  const terminar=(error)=>{if(terminado)return;terminado=true;clearTimeout(timer);error?reject(error):resolve(window.google.maps)}
  const timer=setTimeout(()=>terminar(new Error('Google Maps no respondió. Revisá tu conexión y recargá la página.')),20000)
  window.empregesMapsReady=()=>terminar()
  window.gm_authFailure=()=>{window.dispatchEvent(new Event('empreges-maps-error'));terminar(new Error('Google Maps rechazó la configuración de acceso.'))}
  script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key:import.meta.env.VITE_GOOGLE_MAPS_API_KEY,loading:'async',callback:'empregesMapsReady',v:'weekly',language:'es',region:'AR'})
  script.async=true;script.onerror=()=>terminar(new Error('No se pudo cargar Google Maps. Revisá tu conexión.'))
  document.head.appendChild(script)
 })
 return carga
}
