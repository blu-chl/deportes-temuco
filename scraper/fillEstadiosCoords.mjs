// Completa lat/lon en liga_estadios para los estadios que aparecen en
// liga_partidos.estadio (la misma lista que ve Admin → Enriquecer → Fotos
// de estadios) — liga_estadios solo tiene fila para los que alguien ya
// guardó una foto o coordenada a mano, así que la mayoría de los nombres
// todavía no existen ahí; por eso se arma la lista desde liga_partidos y
// se hace upsert, no un simple PATCH sobre lo que ya hubiera en
// liga_estadios. Las coordenadas no se pueden sacar del scraper (ANFP no
// las publica), así que se investigaron a mano (Wikipedia/Wikidata) y
// quedan acá como referencia fija.
//
// Matchea por un fragmento del nombre en vez de una lista de nombres
// exactos, porque el nombre real puede traer variantes que no se conocen
// de antemano al escribir este script — así el upsert siempre usa el
// nombre real tal cual aparece en liga_partidos, nunca uno adivinado.
//
// Corre una vez (workflow_dispatch, ver
// .github/workflows/fill-estadios-coords.yml) — es idempotente: si un
// estadio ya tiene lat/lon cargado (a mano o por una corrida anterior), se
// deja tal cual, nunca lo pisa.
import { get, upsertOne } from './lib/db.mjs';

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
  const [partidos, estadiosExistentes] = await Promise.all([
    get('liga_partidos', '?select=estadio&estadio=not.is.null'),
    get('liga_estadios', '?select=nombre,lat,lon'),
  ]);
  if (!Array.isArray(partidos)) {
    console.error('No se pudo leer liga_partidos:', partidos);
    process.exitCode = 1;
    return;
  }
  if (!Array.isArray(estadiosExistentes)) {
    console.error('No se pudo leer liga_estadios (¿corriste liga_estadios_coords.sql?):', estadiosExistentes);
    process.exitCode = 1;
    return;
  }
  const nombres = [...new Set(partidos.map((p) => p.estadio).filter(Boolean))];
  const coordsPorNombre = {};
  estadiosExistentes.forEach((e) => {
    if (e.lat != null && e.lon != null) coordsPorNombre[e.nombre] = e;
  });
  console.log(`${nombres.length} estadios distintos en liga_partidos.\n`);

  let actualizados = 0;
  const sinMatch = [];
  for (const nombre of nombres) {
    if (coordsPorNombre[nombre]) {
      console.log(`· ${nombre} — ya tiene coordenadas, se deja`);
      continue;
    }
    const match = COORDS.find(([frag]) => nombre.includes(frag));
    if (!match) {
      sinMatch.push(nombre);
      continue;
    }
    const [, lat, lon] = match;
    await upsertOne('liga_estadios', { nombre, lat, lon }, 'nombre');
    console.log(`✓ ${nombre} -> ${lat}, ${lon}`);
    actualizados++;
  }
  console.log(`\nListo: ${actualizados} estadios actualizados.`);
  if (sinMatch.length) console.log(`Sin coincidencia (${sinMatch.length}): ${sinMatch.join(' | ')}`);
}

main();
