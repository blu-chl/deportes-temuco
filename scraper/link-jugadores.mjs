// Vincula el plantel propio (tabla "jugadores", cargada a mano en Admin)
// con su fila correspondiente en liga_jugadores (scrapeada de ANFP), vía
// la columna jugadores.liga_jugador_id — así dejan de "coincidir" solo por
// texto libre y queda trazable. Reutiliza el mismo matcher por similitud de
// tokens que ya usa scrapeU21.mjs (nameMatch.mjs), con el mismo umbral
// conservador: mejor dejar un jugador sin vincular que vincularlo mal.
//
// Idempotente: los que ya tienen liga_jugador_id se saltan. Pensado para
// correr después de cada scrapeo (ver .github/workflows/scrape-liga.yml).

import { get, patch } from './lib/db.mjs';
import { encontrarJugador } from './lib/nameMatch.mjs';

async function main() {
  const equipos = await get('liga_equipos', '?select=id,nombre&nombre=eq.Deportes%20Temuco');
  const temuco = Array.isArray(equipos) && equipos[0];
  if (!temuco) {
    console.error('No se encontró "Deportes Temuco" en liga_equipos — ¿se corrió el scraper de partidos al menos una vez?');
    process.exitCode = 1;
    return;
  }

  const [propios, ligaJugadores] = await Promise.all([
    get('jugadores', '?select=id,nombre,liga_jugador_id'),
    get('liga_jugadores', `?equipo_id=eq.${temuco.id}&select=id,apellido,nombre`),
  ]);

  // Un liga_jugador_id no se asigna dos veces: al matchear uno, sale del pool.
  const disponibles = Array.isArray(ligaJugadores) ? [...ligaJugadores] : [];

  let vinculados = 0;
  let yaVinculados = 0;
  let sinMatch = 0;

  for (const j of Array.isArray(propios) ? propios : []) {
    if (j.liga_jugador_id) {
      yaVinculados++;
      continue;
    }
    const match = encontrarJugador(j.nombre, disponibles);
    if (!match) {
      console.log(`  ✗ sin match: "${j.nombre}"`);
      sinMatch++;
      continue;
    }
    await patch('jugadores', `?id=eq.${j.id}`, { liga_jugador_id: match.id });
    console.log(`  ✓ "${j.nombre}" → liga_jugadores #${match.id} (${match.nombre} ${match.apellido})`);
    const idx = disponibles.findIndex((d) => d.id === match.id);
    if (idx !== -1) disponibles.splice(idx, 1);
    vinculados++;
  }

  console.log(`\nListo. vinculados=${vinculados} ya_vinculados=${yaVinculados} sin_match=${sinMatch}`);
}

main();
