// Mismo cálculo que calcMinutajeAuto() en index.html: cada titular arranca
// con la duración completa; cada sustitución recorta los minutos del que
// sale y fija cuántos le quedan disponibles al que entra.
export function calcMinutaje(jugadores, sustituciones, duracion = 90) {
  const mins = {};
  const entradas = {};
  jugadores.filter((j) => j.titular).forEach((j) => {
    mins[j.dorsal] = duracion;
    entradas[j.dorsal] = 0;
  });

  const subsOrdenadas = [...sustituciones].sort((a, b) => a.minuto - b.minuto);
  for (const sub of subsOrdenadas) {
    const min = sub.minuto || 0;
    if (mins[sub.sale_dorsal] !== undefined) {
      mins[sub.sale_dorsal] = min - (entradas[sub.sale_dorsal] ?? 0);
    }
    entradas[sub.entra_dorsal] = min;
    mins[sub.entra_dorsal] = duracion - min;
  }

  return mins;
}
