import { findMinutosU21Url, downloadPdf } from './lib/fetchLiga.mjs';
import { parseMinutosU21 } from './lib/parseMinutosU21.mjs';
import { encontrarEquipo } from './lib/teamMatch.mjs';
import { encontrarJugador, partirNombreCorto } from './lib/nameMatch.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const ligaUrl = flag('liga', 'https://www.campeonatochileno.cl/ligas/liga-de-ascenso-caixun/');

const db = dryRun ? null : await import('./lib/db.mjs');

async function main() {
  console.log(`Liga: ${ligaUrl}${dryRun ? '  [dry-run, no escribe en Supabase]' : ''}`);
  const pdfUrl = await findMinutosU21Url(ligaUrl);
  if (!pdfUrl) throw new Error('No se encontró el link a la Tabla Oficial de Minutos Sub 21 en la página de la liga');
  console.log(`PDF: ${pdfUrl}\n`);

  const buf = await downloadPdf(pdfUrl);
  const bloques = await parseMinutosU21(buf);
  console.log(`${bloques.length} equipos con datos sub-21, ${bloques.reduce((a, b) => a + b.jugadores.length, 0)} jugadores en total.\n`);

  const equipos = dryRun ? null : await db.listarEquipos();

  let actualizados = 0;
  let creados = 0;
  let equiposSinMatch = 0;

  for (const bloque of bloques) {
    if (dryRun) {
      const suma = bloque.jugadores.reduce((a, j) => a + j.minutos_oficial, 0);
      console.log(`${bloque.equipoCorto}: total contable oficial=${bloque.totalContable ?? '?'} (suma de jugadores=${suma})`);
      for (const j of bloque.jugadores) {
        console.log(`  · ${j.nombre.padEnd(28)} nace ${j.fecha_nacimiento || '(sin dato)'}  ${j.minutos_oficial} min oficiales`);
      }
      continue;
    }

    const equipo = encontrarEquipo(bloque.equipoCorto, equipos);
    if (!equipo) {
      console.log(`⚠ "${bloque.equipoCorto}" no calzó con ningún equipo conocido, se salta (${bloque.jugadores.length} jugadores)`);
      equiposSinMatch++;
      continue;
    }

    const jugadoresEquipo = await db.listarJugadoresEquipo(equipo.id);
    console.log(`${bloque.equipoCorto} -> ${equipo.nombre}${bloque.totalContable != null ? ` (total contable oficial: ${bloque.totalContable})` : ''}`);
    await db.actualizarSub21Contable(equipo.id, bloque.totalContable);

    for (const j of bloque.jugadores) {
      let jugador = encontrarJugador(j.nombre, jugadoresEquipo);
      if (jugador) {
        console.log(`  · ${j.nombre.padEnd(28)} = ${jugador.apellido}, ${jugador.nombre} (match)`);
        await db.actualizarDatosU21(jugador.id, {
          fecha_nacimiento: j.fecha_nacimiento,
          minutos_oficial_temporada: j.minutos_oficial,
        });
        actualizados++;
      } else {
        const { apellido, nombre } = partirNombreCorto(j.nombre);
        console.log(`  · ${j.nombre.padEnd(28)} sin match, se crea como "${apellido}, ${nombre}"`);
        const creado = await db.crearJugador(equipo.id, apellido, nombre, {
          fecha_nacimiento: j.fecha_nacimiento,
          sub21: true,
          minutos_oficial_temporada: j.minutos_oficial,
        });
        jugadoresEquipo.push(creado);
        creados++;
      }
    }
  }

  if (!dryRun) {
    console.log(`\nListo. actualizados=${actualizados} creados=${creados} equipos_sin_match=${equiposSinMatch}`);
  }
}

main().catch((e) => {
  console.error('✗ error:', e.message);
  process.exitCode = 1;
});
