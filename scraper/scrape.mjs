import { listMatchUrls, fetchMatch, downloadPdf } from './lib/fetchLiga.mjs';
import { parseInformePdf } from './lib/parseInforme.mjs';
import { calcMinutaje } from './lib/minutaje.mjs';
import { ladoEquipo } from './lib/teamMatch.mjs';

const args = process.argv.slice(2);
// Cada parámetro se puede dar de dos formas: bandera en la línea de comandos
// (gana) o variable de entorno. Lo segundo es para el workflow: el scraper
// corre en un runner propio en Windows, donde la sintaxis del shell no es la
// misma que en Linux, así que pasar todo por `env:` evita tener que escribir
// el comando distinto según la máquina.
const flag = (name, env, def = null) => {
  const i = args.indexOf(`--${name}`);
  if (i !== -1) return args[i + 1];
  return process.env[env] || def;
};
const bandera = (name, env) => args.includes(`--${name}`) || process.env[env] === 'true';
const dryRun = bandera('dry-run', 'DRY_RUN');
const force = bandera('force', 'FORCE');
const ligaUrl = flag('liga', 'LIGA_URL', 'https://www.campeonatochileno.cl/ligas/liga-de-ascenso-caixun/');
const limit = Number(flag('limit', 'LIMIT', '0')) || Infinity;

const db = dryRun ? null : await import('./lib/db.mjs');

async function procesarPartido(matchUrl) {
  const meta = await fetchMatch(matchUrl);
  if (!meta) {
    console.log(`  · sin datos todavía, se salta`);
    return 'skipped';
  }

  if (!meta.finalizado) {
    console.log(`  · ${meta.equipoLocal} vs ${meta.equipoVisita} · programado, sin informe todavía (fecha ${meta.jornada || '?'})`);
    if (dryRun) return 'dry-run';
    const equipoLocal = await db.upsertEquipo(meta.equipoLocal, meta.slugLocal);
    const equipoVisita = await db.upsertEquipo(meta.equipoVisita, meta.slugVisita);
    await db.upsertPartido({
      match_url: meta.matchUrl,
      pdf_url: meta.pdfUrl,
      competencia: meta.competencia,
      jornada: meta.jornada,
      fecha_hora: meta.fechaHoraIso,
      estadio: meta.estadio,
      equipo_local_id: equipoLocal.id,
      equipo_visita_id: equipoVisita.id,
      goles_local: null,
      goles_visita: null,
      arbitro: meta.arbitro,
      arbitro_asistente1: meta.arbitroAsistente1,
      arbitro_asistente2: meta.arbitroAsistente2,
      cuarto_arbitro: meta.cuartoArbitro,
      var: meta.var,
      avar1: meta.avar1,
    });
    return 'programado';
  }

  const pdfBuf = await downloadPdf(meta.pdfUrl);
  const informe = await parseInformePdf(pdfBuf);

  const subsA = informe.sustituciones.filter((s) => matchLadoPdf(s.equipo, informe) === 'A');
  const subsB = informe.sustituciones.filter((s) => matchLadoPdf(s.equipo, informe) === 'B');
  const minsA = calcMinutaje(informe.equipoA.jugadores, subsA, 90);
  const minsB = calcMinutaje(informe.equipoB.jugadores, subsB, 90);

  const sinLado = [...informe.amarillas, ...informe.rojas, ...informe.sustituciones].filter(
    (c) => !matchLadoPdf(c.equipo, informe)
  );

  console.log(
    `  · ${meta.equipoLocal} ${meta.golesLocal}-${meta.golesVisita} ${meta.equipoVisita} | ` +
      `${informe.equipoA.jugadores.length + informe.equipoB.jugadores.length} jugadores, ` +
      `${informe.goles.length} goles, ${informe.amarillas.length} amarillas, ${informe.rojas.length} rojas, ` +
      `${informe.sustituciones.length} cambios` +
      (sinLado.length ? `  ⚠ ${sinLado.length} sin equipo resuelto (${sinLado.map((c) => c.equipo).join(', ')})` : '')
  );

  if (dryRun) return 'dry-run';

  const equipoLocal = await db.upsertEquipo(meta.equipoLocal, meta.slugLocal);
  const equipoVisita = await db.upsertEquipo(meta.equipoVisita, meta.slugVisita);

  const partido = await db.upsertPartido({
    match_url: meta.matchUrl,
    pdf_url: meta.pdfUrl,
    competencia: meta.competencia,
    jornada: meta.jornada,
    fecha_hora: meta.fechaHoraIso,
    estadio: meta.estadio,
    equipo_local_id: equipoLocal.id,
    equipo_visita_id: equipoVisita.id,
    goles_local: meta.golesLocal,
    goles_visita: meta.golesVisita,
    arbitro: meta.arbitro,
    arbitro_asistente1: meta.arbitroAsistente1,
    arbitro_asistente2: meta.arbitroAsistente2,
    cuarto_arbitro: meta.cuartoArbitro,
    var: meta.var,
    avar1: meta.avar1,
  });

  // Jugadores + dorsal->jugador_id por lado, para cruzar goles/tarjetas/subs.
  const dorsalToJugadorA = {};
  for (const j of informe.equipoA.jugadores) {
    const jr = await db.upsertJugador(equipoLocal.id, j.apellido, j.nombre);
    dorsalToJugadorA[j.dorsal] = jr.id;
    await db.actualizarNumeroJugador(jr.id, j.dorsal);
  }
  const dorsalToJugadorB = {};
  for (const j of informe.equipoB.jugadores) {
    const jr = await db.upsertJugador(equipoVisita.id, j.apellido, j.nombre);
    dorsalToJugadorB[j.dorsal] = jr.id;
    await db.actualizarNumeroJugador(jr.id, j.dorsal);
  }

  const alineaciones = [
    ...informe.equipoA.jugadores.map((j) => ({
      partido_id: partido.id,
      jugador_id: dorsalToJugadorA[j.dorsal],
      equipo_id: equipoLocal.id,
      dorsal: j.dorsal,
      titular: j.titular,
      portero: j.portero,
      capitan: j.capitan,
      minutos_jugados: minsA[j.dorsal] ?? null,
    })),
    ...informe.equipoB.jugadores.map((j) => ({
      partido_id: partido.id,
      jugador_id: dorsalToJugadorB[j.dorsal],
      equipo_id: equipoVisita.id,
      dorsal: j.dorsal,
      titular: j.titular,
      portero: j.portero,
      capitan: j.capitan,
      minutos_jugados: minsB[j.dorsal] ?? null,
    })),
  ];

  const golesRows = informe.goles.map((g) => {
    const lado = g.equipo; // 'A' | 'B' — columna del PDF donde aparece el dorsal (el equipo DEL JUGADOR, no necesariamente el que suma en el marcador)
    const equipoJugador = lado === 'A' ? equipoLocal.id : equipoVisita.id;
    // Un autogol lo mete un jugador de un equipo, pero el gol cuenta en el
    // marcador para el RIVAL — el dorsal/jugador se busca en el equipo del
    // lado (correcto), pero equipo_id (a quién le suma el gol) debe ser el
    // contrario cuando autogol=true.
    const equipoId = g.autogol ? (lado === 'A' ? equipoVisita.id : equipoLocal.id) : equipoJugador;
    const jugadorId = lado === 'A' ? dorsalToJugadorA[g.dorsal] : dorsalToJugadorB[g.dorsal];
    return {
      partido_id: partido.id,
      jugador_id: jugadorId,
      equipo_id: equipoId,
      minuto: g.minuto,
      minuto_extra: g.minuto_extra,
      penal: g.penal,
      autogol: g.autogol,
    };
  });

  const tarjetasRows = [...informe.amarillas, ...informe.rojas]
    .map((c) => {
      const lado = matchLadoPdf(c.equipo, informe);
      if (!lado) return null;
      const equipoId = lado === 'A' ? equipoLocal.id : equipoVisita.id;
      const jugadorId = lado === 'A' ? dorsalToJugadorA[c.dorsal] : dorsalToJugadorB[c.dorsal];
      if (!jugadorId) return null;
      return {
        partido_id: partido.id,
        jugador_id: jugadorId,
        equipo_id: equipoId,
        tipo: c.tipo,
        segunda_amarilla: c.segunda_amarilla,
        minuto: c.minuto,
        minuto_extra: c.minuto_extra,
        motivo: c.motivo,
      };
    })
    .filter(Boolean);

  const sustitucionesRows = informe.sustituciones
    .map((s) => {
      const lado = matchLadoPdf(s.equipo, informe);
      if (!lado) return null;
      const equipoId = lado === 'A' ? equipoLocal.id : equipoVisita.id;
      const entraId = lado === 'A' ? dorsalToJugadorA[s.entra_dorsal] : dorsalToJugadorB[s.entra_dorsal];
      const saleId = lado === 'A' ? dorsalToJugadorA[s.sale_dorsal] : dorsalToJugadorB[s.sale_dorsal];
      return {
        partido_id: partido.id,
        equipo_id: equipoId,
        entra_jugador_id: entraId ?? null,
        sale_jugador_id: saleId ?? null,
        minuto: s.minuto,
        minuto_extra: s.minuto_extra,
      };
    })
    .filter(Boolean);

  await db.reemplazarEventosPartido(partido.id, {
    alineaciones,
    goles: golesRows,
    tarjetas: tarjetasRows,
    sustituciones: sustitucionesRows,
  });

  // Si el admin cargó un borrador de estos goles antes de que saliera el
  // informe (ver liga_goles_borrador), acá se cruza con lo recién scrapeado.
  const temucoEquipoId =
    meta.equipoLocal === 'Deportes Temuco' ? equipoLocal.id : meta.equipoVisita === 'Deportes Temuco' ? equipoVisita.id : null;
  if (temucoEquipoId) await db.aplicarBorradorGoles(partido.id, temucoEquipoId);

  return 'ok';
}

// El PDF trae el nombre corto del equipo tal cual (ej. "RANGERS"); lo
// resolvemos contra los nombres completos "Equipo A"/"Equipo B" del propio
// PDF (no contra el HTML) porque son consistentes entre sí dentro del mismo
// informe.
function matchLadoPdf(nombreCorto, informe) {
  const lado = ladoEquipo(nombreCorto, informe.equipoA.nombre, informe.equipoB.nombre);
  if (lado === 'local') return 'A';
  if (lado === 'visita') return 'B';
  return null;
}

async function main() {
  console.log(`Liga: ${ligaUrl}${dryRun ? '  [dry-run, no escribe en Supabase]' : ''}`);
  const urls = await listMatchUrls(ligaUrl);

  // Una sola consulta con todos los partidos ya cargados, en vez de una por
  // partido: antes eran ~240 viajes a Supabase por corrida, casi todos para
  // responder "sáltalo".
  const yaCargados = dryRun || force ? new Map() : await db.partidosYaCargados();
  console.log(
    `${urls.length} partidos en el fixture` +
      (yaCargados.size ? `, ${yaCargados.size} ya cargados` : '') +
      `. Procesando hasta ${limit === Infinity ? 'todos' : limit}...\n`
  );

  let procesados = 0;
  let saltados = 0;
  let errores = 0;
  let pedidos = 0; // cuántas veces le pedimos algo al sitio

  for (const url of urls) {
    if (procesados + saltados + errores >= limit) break;

    // El salteo va ANTES de la pausa: esos 400 ms son para no bombardear el
    // sitio del campeonato, y a un partido que se saltea no se le pide nada.
    // Aplicárselos igual eran ~96 segundos de espera pura por corrida.
    const existeId = yaCargados.get(url);
    if (existeId) {
      console.log(`${url}\n  · ya está en la base (id ${existeId}), se salta (usa --force para re-scrapear)`);
      saltados++;
      continue;
    }

    if (pedidos > 0) await new Promise((r) => setTimeout(r, 400));
    pedidos++;
    console.log(url);
    try {
      const resultado = await procesarPartido(url);
      if (resultado === 'skipped') saltados++;
      else procesados++;
    } catch (e) {
      if (e.code === 'PLANTILLA_NO_SOPORTADA') {
        console.log(`  · ${e.message}, se salta`);
        saltados++;
      } else {
        console.error(`  ✗ error: ${e.message}`);
        errores++;
      }
    }
  }

  console.log(`\nListo. procesados=${procesados} saltados=${saltados} errores=${errores}`);
  if (errores > 0) process.exitCode = 1;
}

main();
