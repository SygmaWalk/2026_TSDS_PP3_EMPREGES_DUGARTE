import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import FrecuenciaClientes from './FrecuenciaClientes.jsx'

test('consulta filtros y abre la ficha del cliente frecuente', async () => {
  const repository = { frecuencia: vi.fn().mockResolvedValue({ clientes: [{ id: 1, nombre: 'Ana', pedidos: 3, importe: 3000, frecuente: true }], total: 1 }) }
  const onFicha = vi.fn()
  render(<FrecuenciaClientes repository={repository} onFicha={onFicha}/>)
  expect(await screen.findByText('Cliente frecuente')).toBeVisible()
  await userEvent.clear(screen.getByLabelText('Mínimo de pedidos para ser frecuente'))
  await userEvent.type(screen.getByLabelText('Mínimo de pedidos para ser frecuente'), '5')
  await userEvent.selectOptions(screen.getByLabelText('Ordenar por'), 'importe')
  await userEvent.click(screen.getByRole('button', { name: 'Consultar frecuencia' }))
  expect(repository.frecuencia).toHaveBeenLastCalledWith({ minimo: 5, desde: '', hasta: '', orden: 'importe', pagina: 0 })
  await userEvent.click(await screen.findByRole('button', { name: 'Ver ficha e historial de Ana' }))
  expect(onFicha).toHaveBeenCalledWith(1)
})

test('informa un error y permite volver a consultar', async () => {
  const repository = { frecuencia: vi.fn().mockRejectedValueOnce(Error('Sin permiso')).mockResolvedValue({ clientes: [], total: 0 }) }
  render(<FrecuenciaClientes repository={repository} onFicha={() => {}}/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso')
  await userEvent.click(screen.getByRole('button', { name: 'Consultar frecuencia' }))
  expect(await screen.findByText('No hay clientes registrados para analizar.')).toBeVisible()
})
