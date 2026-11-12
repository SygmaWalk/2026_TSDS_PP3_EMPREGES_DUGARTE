import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import MisPedidos from './MisPedidos.jsx'

test('muestra el estado vacío al abrir el historial', async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: [] }) }
  render(<MisPedidos client={client} />)
  expect(client.rpc).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Ver mis pedidos' }))
  expect(await screen.findByText(/Todavía no tenés pedidos/)).toBeVisible()
})

test('abre los productos del pedido en la misma lista', async () => {
  const pedido = { id: 7, tienda: 'Cocina', estado: 'Pendiente', fecha: '2026-11-02T13:00:00Z',
    subtotal: 20, envio: 0, total: 20, productos: [{ cantidad: 2, nombre: 'Pizza', precio: 10 }] }
  render(<MisPedidos client={{ rpc: vi.fn().mockResolvedValue({ data: [pedido] }) }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver mis pedidos' }))
  await userEvent.click(await screen.findByText(/Pedido #7/))
  expect(screen.getByText('2 × Pizza')).toBeVisible()
})
