import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import PerfilCliente from './PerfilCliente.jsx'
import { leerPerfil } from './perfil.js'
const usuario = { id: 'cliente', email: 'cliente@example.test', user_metadata: { perfil_cliente: { nombre: 'Ana Pérez', telefono: '1123456789', direccion: 'Calle 123' } } }
test('guarda solo datos de contacto propios y muestra confirmación del servidor', async () => {
  const updateUser = vi.fn().mockResolvedValue({ error: null })
  render(<PerfilCliente client={{ auth: { updateUser } }} usuario={usuario} />)
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText('Nombre y apellido'))
  await user.type(screen.getByLabelText('Nombre y apellido'), '  Ana Gómez  ')
  await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect(updateUser).toHaveBeenCalledWith({ data: { perfil_cliente: { nombre: 'Ana Gómez', telefono: '1123456789', direccion: 'Calle 123' } } })
  expect(await screen.findByRole('status')).toHaveTextContent('se guardó correctamente')
})
test('un teléfono inválido no envía el perfil', async () => {
  const updateUser = vi.fn()
  render(<PerfilCliente client={{ auth: { updateUser } }} usuario={usuario} />)
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText('Teléfono'))
  await user.type(screen.getByLabelText('Teléfono'), 'abcdefg')
  await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('teléfono válido')
  expect(updateUser).not.toHaveBeenCalled()
})
test('un fallo de guardado conserva la edición y no anuncia éxito', async () => {
  const updateUser = vi.fn().mockResolvedValue({ error: { message: 'red' } })
  render(<PerfilCliente client={{ auth: { updateUser } }} usuario={usuario} />)
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText('Dirección habitual'))
  await user.type(screen.getByLabelText('Dirección habitual'), 'Otra calle 456')
  await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.getByLabelText('Dirección habitual')).toHaveValue('Otra calle 456')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
test('metadatos inesperados no se convierten en valores de formulario', () => {
  expect(leerPerfil({ user_metadata: { perfil_cliente: { nombre: {}, telefono: [], direccion: null, rol: 'administrador' } } })).toEqual({ nombre: '', telefono: '', direccion: '' })
})
