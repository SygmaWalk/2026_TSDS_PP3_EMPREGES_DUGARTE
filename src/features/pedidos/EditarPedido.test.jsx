import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import EditarPedido from './EditarPedido.jsx'

test('cambiar la devolución durante la preparación exige revisar otra vez antes de guardar', async () => {
  const user = userEvent.setup()
  const producto = { id: 1, nombre: 'Pizza', precio_centavos: 1000 }
  const pedido = {
    id: 2, revision: 'vigente', estado: 'En preparación',
    detalles_pedido: [{ producto_id: 1, cantidad: 2 }],
  }
  const repository = {
    catalogoEdicion: vi.fn().mockResolvedValue([producto]),
    modificar: vi.fn().mockResolvedValue({
      anterior: { total_centavos: 2000 },
      nuevo: { items: [], subtotal_centavos: 1000, costo_envio_centavos: 0, total_centavos: 1000 },
      huella: 'cotizado', stock: [],
    }),
  }
  const guardado = vi.fn()
  render(<EditarPedido pedido={pedido} repository={repository} onGuardado={guardado} onCerrar={vi.fn()} />)
  const devolver = await screen.findByRole('checkbox', { name: /Devolver al stock/ })
  expect(devolver).not.toBeChecked()
  const cantidad = screen.getByLabelText('Cantidad de línea 1')
  await user.clear(cantidad)
  await user.type(cantidad, '1')
  await user.type(screen.getByLabelText('Motivo de modificación'), 'El cliente pidió una unidad')
  const revisar = screen.getByRole('button', { name: 'Revisar cambios' })
  await user.click(revisar)
  expect(repository.modificar).toHaveBeenCalledWith(expect.objectContaining({ p_devolver: false }))
  await user.click(devolver)
  expect(screen.queryByRole('button', { name: 'Confirmar modificación' })).toBeNull()
  await user.click(revisar)
  const [revision] = repository.modificar.mock.lastCall
  await user.click(await screen.findByRole('button', { name: 'Confirmar modificación' }))
  expect(repository.modificar).toHaveBeenLastCalledWith({ ...revision, p_devolver: true, p_huella: 'cotizado' }, true)
  expect(guardado).toHaveBeenCalledOnce()
})
