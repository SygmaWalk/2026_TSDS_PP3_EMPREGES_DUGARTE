import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App.jsx'

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}))

async function crearProducto(user, nombre = 'Tequeños', precio = '1000') {
  await user.type(screen.getByLabelText(/^Nombre/), nombre)
  await user.type(screen.getByLabelText(/^Precio/), precio)
  await user.click(screen.getByRole('button', { name: 'Crear producto' }))
}

async function prepararCarrito() {
  const user = userEvent.setup()
  render(<App />)
  await crearProducto(user)
  await user.click(
    screen.getByRole('button', {
      name: 'Mostrar Tequeños en el catálogo público',
    }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Catálogo', exact: true }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Agregar Tequeños al carrito' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Carrito (1)', exact: true }),
  )
  return user
}

test('CP-UI-01: el formulario muestra errores y no crea un producto inválido', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Crear producto' }))
  expect(screen.getByText('Ingresá el nombre del producto.')).toBeVisible()
  expect(
    screen.getByText('Ingresá un precio válido con hasta dos decimales.'),
  ).toBeVisible()
  expect(screen.getByText('Todavía no hay productos')).toBeVisible()
})

test('CP-UI-02: agregar, navegar, actualizar cantidades y quitar conserva un subtotal coherente', async () => {
  const user = await prepararCarrito()
  expect(screen.getByTestId('subtotal')).toHaveTextContent('1.000,00')
  const cantidad = screen.getByLabelText('Cantidad de Tequeños')
  await user.clear(cantidad)
  await user.type(cantidad, '2')
  await user.click(
    screen.getByRole('button', { name: 'Actualizar cantidad de Tequeños' }),
  )
  expect(screen.getByTestId('subtotal')).toHaveTextContent('2.000,00')
  await user.click(screen.getByRole('button', { name: 'Seguir eligiendo' }))
  await user.click(
    screen.getByRole('button', { name: 'Agregar Tequeños al carrito' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Productos', exact: true }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Carrito (3)', exact: true }),
  )
  expect(screen.getByLabelText('Cantidad de Tequeños')).toHaveValue('3')
  expect(screen.getByTestId('subtotal')).toHaveTextContent('3.000,00')
  await user.click(screen.getByRole('button', { name: 'Quitar Tequeños' }))
  expect(screen.getByText(/Tu carrito está vacío/)).toBeVisible()
  expect(screen.getByTestId('subtotal')).toHaveTextContent('$ 0,00')
})

test('CP-UI-03: una cantidad inválida informa el error y mantiene el subtotal confirmado', async () => {
  const user = await prepararCarrito()
  const cantidad = screen.getByLabelText('Cantidad de Tequeños')
  await user.clear(cantidad)
  await user.type(cantidad, '0')
  await user.click(
    screen.getByRole('button', { name: 'Actualizar cantidad de Tequeños' }),
  )
  expect(screen.getByRole('alert')).toHaveTextContent(
    'cantidad entera mayor o igual a uno',
  )
  expect(screen.getByTestId('subtotal')).toHaveTextContent('1.000,00')
  await user.clear(cantidad)
  await user.type(cantidad, '2')
  await user.click(
    screen.getByRole('button', { name: 'Actualizar cantidad de Tequeños' }),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByTestId('subtotal')).toHaveTextContent('2.000,00')
})

test('CP-UI-04: ocultar un producto lo retira del catálogo y del carrito', async () => {
  const user = await prepararCarrito()
  await user.click(
    screen.getByRole('button', { name: 'Productos', exact: true }),
  )
  await user.click(
    screen.getByRole('button', {
      name: 'Ocultar Tequeños en el catálogo público',
    }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Catálogo', exact: true }),
  )
  expect(
    screen.queryByRole('button', { name: 'Agregar Tequeños al carrito' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Carrito (0)', exact: true }),
  )
  expect(screen.getByText(/Tu carrito está vacío/)).toBeVisible()
})

test('CP-UI-05: editar un precio actualiza el carrito sin perder la selección', async () => {
  const user = await prepararCarrito()
  await user.click(
    screen.getByRole('button', { name: 'Productos', exact: true }),
  )
  await user.click(screen.getByRole('button', { name: 'Editar Tequeños' }))
  const precio = screen.getByLabelText(/^Precio/)
  await user.clear(precio)
  await user.type(precio, '1500,50')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await user.click(
    screen.getByRole('button', { name: 'Carrito (1)', exact: true }),
  )
  expect(screen.getByTestId('subtotal')).toHaveTextContent('1.500,50')
})

test('CP-UI-06: un producto nuevo permanece oculto hasta publicarlo', async () => {
  const user = userEvent.setup()
  render(<App />)
  await crearProducto(user)
  const listado = screen.getByRole('region', { name: 'Productos cargados' })
  expect(within(listado).getByText('Oculto')).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Catálogo', exact: true }),
  )
  expect(
    screen.getByText('No hay productos visibles por el momento.'),
  ).toBeVisible()
})
