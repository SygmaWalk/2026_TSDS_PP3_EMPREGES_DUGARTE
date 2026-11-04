export function destinoTrasIngreso(){
 try{const retorno=sessionStorage.getItem('empreges:retorno-compra');sessionStorage.removeItem('empreges:retorno-compra');if(/^#\/tienda\/[a-z0-9]+(-[a-z0-9]+)*$/.test(retorno??''))return retorno}catch{/* Retorno opcional. */}
 return '#/cuenta'
}
export function errorRetornoOAuth(){
 const query=new URLSearchParams(window.location.search)
 const hash=new URLSearchParams(window.location.hash.slice(1))
 const error=query.get('error')??hash.get('error')
 if(!error)return ''
 return error==='access_denied'?'Cancelaste el acceso con Google. Podés volver a intentarlo.':'No se pudo completar el acceso con Google. Volvé a intentarlo.'
}
export async function ingresarConGoogle(client){
 try{
 const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/#/ingresar',queryParams:{prompt:'select_account'}}})
 if(error)throw error
 }catch{throw Error('No se pudo iniciar el acceso con Google. Intentá nuevamente o ingresá con tu correo.')}
}
