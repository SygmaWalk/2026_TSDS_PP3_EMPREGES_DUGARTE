import {expect,test,vi} from 'vitest'
import {crearProductosRepository} from './productosRepository.js'

test('explica por qué un producto con stock no puede convertirse en combo',async()=>{
 const client={rpc:vi.fn().mockResolvedValue({error:{code:'22023',message:'Antes de convertirlo en combo, ajustá sus existencias propias a cero.'}})}
 const repository=crearProductosRepository(client,294)
 await expect(repository.crear({nombre:'Combo',precio:1800,esCombo:true,componentes:[{componente_id:1,cantidad:1}]})).rejects.toThrow('Antes de convertirlo en combo, ajustá sus existencias propias a cero.')
})
