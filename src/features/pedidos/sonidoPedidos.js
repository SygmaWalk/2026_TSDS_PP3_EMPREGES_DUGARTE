// Se crea únicamente desde un gesto del usuario; no necesita archivos ni permisos de micrófono.
export function crearSonidoPedidos() {
  let contexto = null
  let activo = false
  function sonar() {
    if (!activo || contexto?.state !== 'running') return false
    const inicio = contexto.currentTime
    for (const [retraso, frecuencia] of [[0, 659], [0.17, 880]]) {
      const tono = contexto.createOscillator()
      const volumen = contexto.createGain()
      tono.frequency.value = frecuencia
      volumen.gain.setValueAtTime(0, inicio + retraso)
      volumen.gain.linearRampToValueAtTime(0.12, inicio + retraso + 0.025)
      volumen.gain.exponentialRampToValueAtTime(0.001, inicio + retraso + 0.25)
      tono.connect(volumen); volumen.connect(contexto.destination)
      tono.start(inicio + retraso); tono.stop(inicio + retraso + 0.27)
      tono.onended = () => { tono.disconnect(); volumen.disconnect() }
    }
    return true
  }
  return {
    async activar() {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) throw new Error('Este navegador no permite sonido. Las alertas visuales siguen disponibles.')
      if (!contexto || contexto.state === 'closed') contexto = new Audio()
      await contexto.resume()
      activo = contexto.state === 'running'
      if (!activo) throw new Error('El navegador bloqueó el sonido. Volvé a activarlo.')
      sonar()
    },
    silenciar() { activo = false },
    sonar,
    cerrar() { activo = false; if (contexto && contexto.state !== 'closed') contexto.close().catch(() => {}); contexto = null },
  }
}
