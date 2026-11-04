export const LIMITE_IMAGEN = 5 * 1024 * 1024
const extensiones = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export function validarImagen(archivo) {
  if (!archivo || !extensiones[archivo.type]) throw new Error('Elegí una imagen JPG, PNG o WebP.')
  if (!archivo.size || archivo.size > LIMITE_IMAGEN) throw new Error('La imagen debe pesar hasta 5 MB y no estar vacía.')
}
export async function subirImagen(client, negocioId, archivo) {
  validarImagen(archivo)
  const ruta = negocioId + '/' + crypto.randomUUID() + '.' + extensiones[archivo.type]
  const { error } = await client.storage.from('productos').upload(ruta, archivo, { contentType: archivo.type, upsert: false, cacheControl: '0' })
  if (error) throw new Error('No se pudo subir la imagen. Revisá el archivo, tu conexión y tus permisos.')
  return ruta
}
export async function quitarImagenSinUso(client, ruta) {
  if (!ruta) return
  // La política de Storage protege cualquier imagen que siga asociada a un producto,
  // incluso si hubo una respuesta perdida luego de guardar en la base.
  try { await client.storage.from('productos').remove([ruta]) } catch { /* Limpieza recuperable; no invalida un guardado confirmado. */ }
}
