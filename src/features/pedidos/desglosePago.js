export function centavosImporte(valor) {
  const texto = String(valor ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw Error('Ingresá importes válidos con hasta dos decimales.')
  const [entero, decimal = ''] = texto.split('.')
  const centavos = Number(entero) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(centavos)) throw Error('El importe es demasiado grande.')
  return centavos
}
export function validarDesglose(efectivo, transferencia, total) {
  const e = centavosImporte(efectivo), t = centavosImporte(transferencia)
  if (e <= 0 || t <= 0) throw Error('Para dividir el cobro, ingresá un importe mayor a cero en cada método.')
  if (e + t !== Math.round(Number(total) * 100)) throw Error('Efectivo y transferencia deben sumar el total del pedido.')
  return { efectivo: e / 100, transferencia: t / 100 }
}
