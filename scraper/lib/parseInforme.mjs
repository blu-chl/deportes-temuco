import { loadPdfPages, cell, cellJoin, rowText } from './pdfRows.mjs';

// Parsea el "Informe de Partido" (PDF oficial ANFP/COMET) descargado desde
// campeonatochileno.cl. La info de equipos/fecha/marcador/árbitros ya la
// sacamos del HTML de la página del partido (más simple y estable), así que
// este módulo solo extrae lo que NO está en el HTML: alineaciones con
// dorsal/titular/arquero/capitán, goles con minuto, tarjetas con minuto y
// motivo, y sustituciones con minuto — todo referenciado por dorsal, para
// cruzarlo después con la alineación y no depender de parsear nombres.

const MIN_RE = /^(\d+)'?\s*(?:\+\s*(\d+))?$/;

function parseMinuto(str) {
  const m = MIN_RE.exec((str || '').trim());
  if (!m) return null;
  return { minuto: Number(m[1]), minuto_extra: m[2] ? Number(m[2]) : 0 };
}

// ---------- Página 1: alineaciones ----------

export function parseAlineaciones(rows) {
  const headerRow = rows.find((r) => {
    const t = rowText(r.items);
    return t.includes('Apellido') && t.includes('Nombre') && t.includes('T/S');
  });
  const legendRow = rows.find((r) => rowText(r.items).includes('Titular') && rowText(r.items).includes('Suplente'));
  const teamsRow = rows.find((r) => rowText(r.items).startsWith('Equipo A'));

  if (!headerRow || !legendRow || !teamsRow) {
    // ANFP/COMET emite al menos dos plantillas distintas de informe; esta
    // función solo soporta la de 4 páginas (tabla de alineaciones a dos
    // columnas). La otra plantilla (2 páginas, formato más compacto) todavía
    // no tiene parser — se detecta acá para poder saltar el partido en vez
    // de reventar con un error genérico.
    const err = new Error('Plantilla de PDF no soportada (no es el formato de 4 páginas con tabla de alineaciones)');
    err.code = 'PLANTILLA_NO_SOPORTADA';
    throw err;
  }

  const nombreA = cellJoin(teamsRow.items, 100, 300);
  const nombreB = cellJoin(teamsRow.items, 380, 700);

  const playerRows = rows.filter((r) => r.y < headerRow.y && r.y > legendRow.y);

  const jugadoresA = [];
  const jugadoresB = [];

  for (const r of playerRows) {
    const it = r.items;
    const left = readJugador(it, { dorsal: [20, 44], apellido: [44, 149], nombre: [149, 255], ts: [255, 264], ac: [264, 300] });
    const right = readJugador(it, { dorsal: [300, 320], apellido: [320, 424], nombre: [424, 534], ts: [534, 540], ac: [540, 572] });
    if (left) jugadoresA.push(left);
    if (right) jugadoresB.push(right);
  }

  return {
    equipoA: { nombre: nombreA, jugadores: jugadoresA },
    equipoB: { nombre: nombreB, jugadores: jugadoresB },
  };
}

function readJugador(items, ranges) {
  const dorsalStr = cell(items, ranges.dorsal[0], ranges.dorsal[1]);
  const apellido = cellJoin(items, ranges.apellido[0], ranges.apellido[1]);
  const nombre = cellJoin(items, ranges.nombre[0], ranges.nombre[1]);
  if (!dorsalStr || !apellido) return null;
  const ts = cell(items, ranges.ts[0], ranges.ts[1]);
  const ac = cellJoin(items, ranges.ac[0], ranges.ac[1]);
  return {
    dorsal: Number(dorsalStr),
    apellido,
    nombre,
    titular: ts === 'T',
    portero: ac.includes('A'),
    capitan: ac.includes('C'),
  };
}

// ---------- Página 2: sustituciones / goles / tarjetas ----------

export function parseEventosPagina2(rows) {
  const sustituciones = parseSustituciones(rows);
  const goles = parseGoles(rows);
  const amarillas = parseTarjetas(rows, 'AMONESTACIONES - Tarjetas Amarillas', 'EXPULSIONES - Tarjetas rojas');
  const rojas = parseTarjetas(rows, 'EXPULSIONES - Tarjetas rojas', 'AMONESTACIONES de Cuerpo técnico');
  return { sustituciones, goles, amarillas, rojas };
}

function sectionRows(rows, startText, endText) {
  const start = rows.findIndex((r) => rowText(r.items).includes(startText));
  if (start === -1) return [];
  const rest = rows.slice(start + 1);
  const end = endText ? rest.findIndex((r) => rowText(r.items).includes(endText)) : -1;
  return end === -1 ? rest : rest.slice(0, end);
}

function parseSustituciones(rows) {
  const section = sectionRows(rows, 'SUSTITUCIONES', 'GOLES');
  const out = [];
  for (const r of section) {
    const it = r.items;
    const tiempoStr = cell(it, 30, 55);
    // La columna "Equipo A"/"Equipo B" está centrada (no alineada a la
    // izquierda como el resto): con nombres largos ("DEPORTES IQUIQUE") su
    // texto arranca bastante más a la izquierda que con nombres cortos
    // ("RANGERS"). En vez de un rango fijo, tomamos el ítem más a la
    // derecha de toda la fila que quede después de la columna "Sale Nombre"
    // (que sí es fija, ancla en x≈408).
    const equipoItem = it.filter((i) => i.x >= 440).sort((a, b) => b.x - a.x)[0];
    const equipo = equipoItem ? equipoItem.str.trim() : '';
    if (!tiempoStr || !equipo) continue;
    const tiempo = parseMinuto(tiempoStr);
    if (!tiempo) continue;
    const entraDorsal = cell(it, 55, 78);
    const saleDorsal = cell(it, 288, 304);
    if (!entraDorsal || !saleDorsal) continue;
    out.push({
      equipo,
      ...tiempo,
      entra_dorsal: Number(entraDorsal),
      entra_apellido: cellJoin(it, 78, 182),
      entra_nombre: cellJoin(it, 182, 288),
      sale_dorsal: Number(saleDorsal),
      sale_apellido: cellJoin(it, 304, 408),
      sale_nombre: cellJoin(it, 408, 440),
    });
  }
  return out;
}

function parseGoles(rows) {
  const section = sectionRows(rows, 'GOLES', 'AMONESTACIONES - Tarjetas Amarillas');
  const goles = [];
  const markers = [];

  for (const r of section) {
    const it = r.items;
    // Fila "PEN" / "AG" aislada (marcador de penal/autogol junto al gol de arriba)
    if (it.length === 1 && /^(PEN|AG)$/.test(it[0].str.trim())) {
      markers.push({ y: r.y, x: it[0].x, tipo: it[0].str.trim() });
      continue;
    }
    const leftTiempo = cell(it, 25, 60);
    if (leftTiempo && parseMinuto(leftTiempo)) {
      goles.push({
        lado: 'A',
        y: r.y,
        ...parseMinuto(leftTiempo),
        dorsal: Number(cell(it, 60, 78)),
        apellido: cellJoin(it, 78, 182),
        nombre: cellJoin(it, 182, 290),
      });
    }
    const rightTiempo = cell(it, 300, 335);
    if (rightTiempo && parseMinuto(rightTiempo)) {
      goles.push({
        lado: 'B',
        y: r.y,
        ...parseMinuto(rightTiempo),
        dorsal: Number(cell(it, 335, 353)),
        apellido: cellJoin(it, 353, 450),
        nombre: cellJoin(it, 450, 600),
      });
    }
  }

  for (const mk of markers) {
    const lado = mk.x < 300 ? 'A' : 'B';
    let best = null;
    for (const g of goles) {
      if (g.lado !== lado) continue;
      const dy = g.y - mk.y; // el gol queda arriba (mayor y) del marcador
      if (dy >= -2 && dy <= 8 && (!best || dy < best.dy)) best = { g, dy };
    }
    if (best) {
      if (mk.tipo === 'PEN') best.g.penal = true;
      if (mk.tipo === 'AG') best.g.autogol = true;
    }
  }

  return goles.map(({ y, lado, ...g }) => ({ equipo: lado, penal: false, autogol: false, ...g }));
}

function parseTarjetas(rows, startText, endText) {
  const section = sectionRows(rows, startText, endText).filter(
    (r) => cellJoin(r.items, 182, 380) !== 'Jugador'
  );
  const isRoja = startText.includes('rojas');

  // El texto de "Motivo" se envuelve en varias líneas que quedan centradas
  // verticalmente respecto a la fila con Tiempo/Nº/Equipo/Jugador: algunas
  // líneas de continuación caen ARRIBA de esa fila, no solo abajo. Por eso
  // primero ubicamos las filas ancla (con Tiempo válido) y después asignamos
  // cada línea de motivo suelta al ancla más cercana en Y.
  const anchors = [];
  const looseMotivoLines = [];

  for (const r of section) {
    const it = r.items;
    const tiempoStr = cell(it, 25, 60);
    const tiempo = tiempoStr ? parseMinuto(tiempoStr) : null;
    if (tiempo) {
      anchors.push({
        y: r.y,
        tipo: isRoja ? 'roja' : 'amarilla',
        ...tiempo,
        dorsal: Number(cell(it, 60, 78)) || null,
        equipo: cellJoin(it, 78, 182),
        jugador: cellJoin(it, 182, 380),
        motivoLines: [],
      });
      const ownFragment = cellJoin(it, 380, 900);
      if (ownFragment) anchors[anchors.length - 1].motivoLines.push({ y: r.y, text: ownFragment });
    } else {
      const cont = cellJoin(it, 380, 900);
      if (cont) looseMotivoLines.push({ y: r.y, text: cont });
    }
  }

  for (const line of looseMotivoLines) {
    let closest = null;
    for (const a of anchors) {
      const d = Math.abs(a.y - line.y);
      if (!closest || d < closest.d) closest = { a, d };
    }
    if (closest) closest.a.motivoLines.push(line);
  }

  return anchors.map((a) => {
    const motivo = a.motivoLines
      .sort((x, y) => y.y - x.y)
      .map((l) => l.text)
      .join(' ')
      .trim();
    const { y, motivoLines, ...rest } = a;
    return { ...rest, motivo, segunda_amarilla: /segunda tarjeta amarilla/i.test(motivo) };
  });
}

export async function parseInformePdf(pdfBuffer) {
  const pages = await loadPdfPages(pdfBuffer);
  const alineaciones = parseAlineaciones(pages[0]);
  const eventos = parseEventosPagina2(pages[1] || []);
  return { ...alineaciones, ...eventos };
}
