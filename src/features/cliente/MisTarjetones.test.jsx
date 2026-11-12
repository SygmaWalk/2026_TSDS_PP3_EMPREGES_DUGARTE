import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import MisTarjetones from './MisTarjetones.jsx'

test.each([[0,0],[9,9],[10,10],[11,1],[20,10]])('muestra diez casillas para %i compras', async (compras, visibles) => {
  const tarjeta = { id:1, nombre:'Cocina', activo:true, compras, terminos:'Un café', beneficios:[] }
  const client = { rpc:vi.fn().mockResolvedValue({data:[tarjeta]}) }
  const { container } = render(<MisTarjetones client={client}/>)
  await userEvent.click(screen.getByRole('button', {name:'Ver mis tarjetones'}))
  expect(await screen.findByText(visibles + ' de 10 sellos')).toBeVisible()
  expect(container.querySelectorAll('.stamp')).toHaveLength(10)
  expect(container.querySelectorAll('.stamp.filled')).toHaveLength(visibles)
})
