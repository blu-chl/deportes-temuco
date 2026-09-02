// Completa lat/lon en liga_estadios para los estadios que ya están en la
// base pero sin coordenadas cargadas — no se puede sacar del scraper (ANFP
// no publica coordenadas), así que se investigó a mano cada uno (Wikipedia/
// Wikidata) y se dejan acá como referencia fija.
//
// Matchea por un fragmento del nombre en vez de una lista de nombres
// exactos, porque el nombre real en la base puede venir truncado/con
// variantes que no se conocen de antemano al escribir este script — así
// no hay riesgo de crear una fila nueva por un typo, siempre se hace
// PATCH sobre el nombre real que ya existe en liga_estadios.
//
// Corre una vez (workflow_dispatch, ver
// .github/workflows/fill-estadios-coords.yml) — es idempotente: si un
// estadio ya tiene lat/lon cargado (a mano o por una corrida anterior), se
// deja tal cual.
import { get, patch } from './lib/db.mjs';

const COORDS = [
  ['Iván Azócar', -35.41972, -71.67389], // Talca (ex Fiscal de Talca)
  ['Fiscal Talca', -35.41972, -71.67389],
  ['La Granja', -34.97444, -71.22972], // Curicó
  ['Joaquín Muñoz', -34.64, -71.37], // Santa Cruz
  ['Jorge Silva', -34.583, -70.983], // San Fernando (aprox. ciudad, no se encontró la dirección exacta)
  ['La Pintana', -33.58667, -70.63583],
  ['Recoleta', -33.4083, -70.633], // aprox. comuna, no se encontró la dirección exacta
  ['San Bernardo', -33.5945, -70.6903],
  ['San Felipe', -32.74694, -70.73],
  ['Calvo y Bascuñán', -23.67, -70.405], // Antofagasta
  ['Santa Laura', -33.40461, -70.659],
  ['Tierra de Campeones', -20.24241, -70.13294], // Iquique
  ['Valenzuela Hermosilla', -27.3767, -70.3208], // Copiapó
  ['Lucio Fariña', -32.8876, -71.252], // Quillota
  ['Zorros del Desierto', -22.46, -68.92056], // Calama
  ['Chinquihue', -41.4915, -72.98705], // Puerto Montt
  ['Dittborn', -18.4875, -70.29917], // Arica
  ['Figueroa Brander', -33.022, -71.64], // Valparaíso
  ['Germán Becker', -38.74278, -72.61972], // Temuco
];

async function main() {
  const estadios = await get('liga_estadios', '?select=nombre,lat,lon');
  if (!Array.isArray(estadios)) {
    console.error('No se pudo leer liga_estadios (¿corriste liga_estadios_coords.sql?):', estadios);
    process.exitCode = 1;
    return;
  }
  console.log(`${estadios.length} estadios en la base.\n`);
  let actualizados = 0;
  const sinMatch = [];
  for (const e of estadios) {
    if (e.lat != null && e.lon != null) {
      console.log(`· ${e.nombre} — ya tiene coordenadas, se deja`);
      continue;
    }
    const match = COORDS.find(([frag]) => e.nombre.includes(frag));
    if (!match) {
      sinMatch.push(e.nombre);
      continue;
    }
    const [, lat, lon] = match;
    await patch('liga_estadios', `?nombre=eq.${encodeURIComponent(e.nombre)}`, { lat, lon });
    console.log(`✓ ${e.nombre} -> ${lat}, ${lon}`);
    actualizados++;
  }
  console.log(`\nListo: ${actualizados} estadios actualizados.`);
  if (sinMatch.length) console.log(`Sin coincidencia (${sinMatch.length}): ${sinMatch.join(' | ')}`);
}

main();
