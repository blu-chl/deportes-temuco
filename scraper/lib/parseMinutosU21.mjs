import { loadPdfPages, cell, cellJoin, rowText } from './pdfRows.mjs';

// Parsea "Tabla Oficial de Minutos Sub 21" (ANFP): un documento distinto al
// informe de partido, con un bloque por equipo. Cada jugador trae nombre
// completo (un solo string, no apellido/nombre separado), fecha de
// nacimiento y el total de minutos acumulados en la temporada — que ANFP ya
// calculó y usa para fiscalizar la regla de minutos sub-21. Como este
// documento solo lista a los jugadores sub-21 de cada plantel, la sola
// presencia de un jugador acá ya confirma que es sub-21 (no hace falta
// calcular edad).
//
// No parseamos las 30 columnas de jornada (minuto a minuto / colores de
// celda): para lo que necesitamos (identificar sub-21 + su total oficial de
// minutos) alcanza con nombre + fecha de nacimiento + total.

const FECHA_RE = /^\d{2}\.\d{2}\.\d{2}$/;

function parseFecha(str) {
  const m = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(str);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  // Los jugadores sub-21 en 2026 nacieron entre ~2005 y ~2011: siempre siglo 2000+.
  return `20${yy}-${mm}-${dd}`;
}

export async function parseMinutosU21(pdfBuffer) {
  const pages = await loadPdfPages(pdfBuffer);
  const equipos = [];
  let actual = null;

  for (const page of pages) {
    for (const r of page) {
      const it = r.items;
      const txt = rowText(it);
      if (txt.includes('TOTAL CONTABLE')) continue;

      const nombre = cellJoin(it, 190, 268);
      const totalStr = cell(it, 640, 680);
      const fechaStr = cell(it, 270, 305);

      // Fila de jugador: tiene nombre Y un total de minutos (aunque sea
      // "0"). La fecha de nacimiento a veces falta en el documento oficial
      // (queda en blanco), así que NO la usamos para decidir si es una fila
      // de jugador — solo para completar el dato cuando está disponible.
      if (nombre && nombre !== 'SELECCIÓN' && totalStr !== '') {
        if (!actual) continue; // fila huérfana sin encabezado de equipo (no debería pasar)
        actual.jugadores.push({
          nombre,
          fecha_nacimiento: FECHA_RE.test(fechaStr) ? parseFecha(fechaStr) : null,
          minutos_oficial: Number(totalStr),
        });
        continue;
      }
      if (nombre === 'SELECCIÓN') continue;

      // Fila de encabezado de equipo: tiene texto de nombre pero NINGÚN
      // total (los slots vacíos de la tabla no tienen texto de nombre en
      // absoluto, así que no se confunden con esto).
      // Corta antes de x=305: ahí empieza la columna de la jornada 1, que a
      // veces queda en la misma fila que el nombre del equipo.
      const posibleNombreEquipo = cellJoin(it, 190, 305);
      if (posibleNombreEquipo && !/^\d+$/.test(posibleNombreEquipo.split(' ')[0] || '')) {
        actual = { equipoCorto: posibleNombreEquipo.trim(), jugadores: [] };
        equipos.push(actual);
      }
    }
  }

  return equipos.filter((e) => e.jugadores.length > 0);
}
