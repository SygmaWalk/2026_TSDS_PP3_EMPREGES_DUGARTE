import {expect,test,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {minimoStock} from './stockRepository.js'
import UmbralStock from './UmbralStock.jsx'
import EstadoStock from './EstadoStock.jsx'
test('mínimo admite cero, decimales y desactivación explícita',()=>{
 expect(minimoStock('0')).toBe(0);expect(minimoStock('2,125')).toBe(2.125);expect(minimoStock('')).toBeNull()
})
test.each(['-1','1.0001','NaN','Infinity','1e3','1000000000'])('mínimo inválido %s',v=>expect(()=>minimoStock(v)).toThrow())
test('configurar conserva borrador ante fallo y reintenta',async()=>{
 const u=userEvent.setup(),repo={configurarUmbral:vi.fn().mockRejectedValueOnce(Error('Sin conexión')).mockResolvedValue({})},actualizar=vi.fn()
 render(<UmbralStock producto={{producto_id:1,umbral_stock:2}} repository={repo} puedeConfigurar onActualizar={actualizar}/>)
 await u.click(screen.getByRole('button',{name:'Configurar mínimo'}))
 await u.clear(screen.getByLabelText('Avisar con esta cantidad o menos'))
 await u.type(screen.getByLabelText('Avisar con esta cantidad o menos'),'5')
 await u.click(screen.getByRole('button',{name:'Guardar mínimo'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
 expect(screen.getByLabelText('Avisar con esta cantidad o menos')).toHaveValue('5')
 await u.click(screen.getByRole('button',{name:'Guardar mínimo'}))
 expect(actualizar).toHaveBeenCalledOnce()
 expect(repo.configurarUmbral).toHaveBeenLastCalledWith(1,'5')
})
test('lector ve mínimo sin poder editar',()=>{
 render(<UmbralStock producto={{umbral_stock:2}}/>)
 expect(screen.getByText('2 unidades')).toBeVisible()
 expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
test('agotado y stock bajo se distinguen sin depender del color',()=>{
 const {rerender}=render(<EstadoStock producto={{estado_stock:'bajo'}}/>)
 expect(screen.getByText('Stock bajo')).toBeVisible()
 rerender(<EstadoStock producto={{estado_stock:'sin_stock'}}/>)
 expect(screen.getByText('Sin existencias')).toBeVisible()
 rerender(<EstadoStock producto={{estado_stock:'normal'}}/>)
 expect(screen.queryByText('Stock bajo')).not.toBeInTheDocument()
})
