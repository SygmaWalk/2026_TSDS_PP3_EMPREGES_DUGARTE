import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {test,expect,vi,beforeEach} from 'vitest'
import Acceso from './Acceso.jsx'
import {destinoTrasIngreso,errorRetornoOAuth,ingresarConGoogle} from './oauth.js'
beforeEach(()=>{sessionStorage.clear();window.history.replaceState(null,'','/#/ingresar')})
test('Google permanece oculto mientras el proveedor está deshabilitado',()=>{
 render(<Acceso client={{}} googleDisponible={false}/>)
 expect(screen.queryByRole('button',{name:'Continuar con Google'})).not.toBeInTheDocument()
})
test('solicita Google con retorno al mismo origen y permite reintentar un error',async()=>{
 const client={auth:{signInWithOAuth:vi.fn().mockResolvedValue({error:{message:'secreto técnico'}})}}
 render(<Acceso client={client} googleDisponible/>)
 await userEvent.click(screen.getByRole('button',{name:'Continuar con Google'}))
 expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({provider:'google',options:{redirectTo:location.origin+'/#/ingresar',queryParams:{prompt:'select_account'}}})
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar')
 expect(screen.getByRole('alert')).not.toHaveTextContent('secreto técnico')
 expect(screen.getByRole('button',{name:'Continuar con Google'})).toBeEnabled()
})
test('un error de red tampoco deja bloqueado el ingreso',async()=>{
 const client={auth:{signInWithOAuth:vi.fn().mockRejectedValue(Error('sin red'))}}
 await expect(ingresarConGoogle(client)).rejects.toThrow()
})
test('solo permite volver a una tienda local válida y consume el retorno',()=>{
 sessionStorage.setItem('empreges:retorno-compra','https://otro.example')
 expect(destinoTrasIngreso()).toBe('#/cuenta')
 sessionStorage.setItem('empreges:retorno-compra','#/tienda/mi-tienda')
 expect(destinoTrasIngreso()).toBe('#/tienda/mi-tienda')
 expect(destinoTrasIngreso()).toBe('#/cuenta')
})
test('informa cancelación sin mostrar el mensaje arbitrario del proveedor',()=>{
 history.replaceState(null,'','/?error=access_denied&error_description=texto-externo#/ingresar')
 expect(errorRetornoOAuth()).toContain('Cancelaste')
 expect(errorRetornoOAuth()).not.toContain('texto-externo')
})
