import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import App from './App.jsx'

function clientePrueba(session = null) {
  let notificar
  const unsubscribe = vi.fn()
  const resultado = Promise.resolve({ data: [], error: null })
  const query = { select: () => query, eq: () => query, order: () => resultado }
  const client = {
    from: () => query,
    auth: {
      onAuthStateChange: callback => { notificar = callback; return { data: { subscription: { unsubscribe } } } },
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: { message: 'Invalid login' } }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn(async () => { notificar('SIGNED_OUT', null); return { error: null } }),
    },
  }
  return { client, unsubscribe }
}

test('CP-AUTH-01: sin configuración no ofrece guardar datos en memoria', () => {
  render(<App client={null} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Falta configurar')
  expect(screen.queryByRole('button', { name: 'Crear producto' })).not.toBeInTheDocument()
})

test('CP-AUTH-02: un acceso rechazado mantiene la pantalla de ingreso y permite reintentar', async () => {
  const { client } = clientePrueba()
  const user = userEvent.setup()
  render(<App client={client} />)
  await user.type(await screen.findByLabelText('Correo electrónico'), 'qa@example.test')
  await user.type(screen.getByLabelText('Contraseña'), 'clave-de-prueba')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo ingresar')
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  expect(screen.queryByRole('heading', { name: 'Mis emprendimientos' })).not.toBeInTheDocument()
})

test('CP-AUTH-03: restaura la sesión y retira el panel al cerrar sesión', async () => {
  const { client, unsubscribe } = clientePrueba({ user: { id: 'cuenta-1', email: 'qa@example.test' } })
  const user = userEvent.setup()
  const vista = render(<App client={client} />)
  expect(await screen.findByRole('heading', { name: 'Mis emprendimientos' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeVisible()
  expect(screen.queryByText('qa@example.test')).not.toBeInTheDocument()
  vista.unmount()
  expect(unsubscribe).toHaveBeenCalledOnce()
})

test('CP-AUTH-04: un evento de cierre más reciente prevalece sobre la lectura inicial de sesión', async () => {
  let resolver
  let evento
  const { client } = clientePrueba()
  client.auth.getSession = () => new Promise(resolve => { resolver = resolve })
  client.auth.onAuthStateChange = callback => { evento = callback; return { data: { subscription: { unsubscribe() {} } } } }
  render(<App client={client} />)
  await act(async () => evento('SIGNED_OUT', null))
  await act(async () => resolver({ data: { session: { user: { id: 'anterior' } } }, error: null }))
  expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeVisible()
})
