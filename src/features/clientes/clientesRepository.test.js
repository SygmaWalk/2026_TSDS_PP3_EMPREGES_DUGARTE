import { expect, test } from 'vitest'
import { filtroBusqueda } from './clientesRepository.js'
test('normaliza teléfono parcial y conserva búsqueda de nombres sin comodines', () => {
 expect(filtroBusqueda(' +54 (11) 1234-56 ')).toEqual({campo:'telefono_normalizado',patron:'%5411123456%'})
 expect(filtroBusqueda(' Ana ')).toEqual({campo:'nombre',patron:'%Ana%'})
 expect(filtroBusqueda('Ana, (50%)_')).toEqual({campo:'nombre',patron:'%Ana, (50\\%)\\_%'})
 expect(filtroBusqueda('  ')).toBeNull()
 expect(()=>filtroBusqueda('*')).toThrow('sin asteriscos')
})
