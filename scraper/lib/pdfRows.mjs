import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Los informes de partido de COMET/ANFP son generados por plantilla: la
// posición x/y de cada celda es estable entre partidos de una misma
// competencia. Por eso extraemos texto con coordenadas (no como texto plano)
// y agrupamos por fila (y) para poder distinguir columnas de forma confiable,
// incluso en tablas de dos equipos lado a lado (alineaciones).

const Y_TOLERANCE = 2;

export async function loadPdfPages(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => ({
        str: it.str,
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
      }))
      .filter((it) => it.str.trim() !== '');
    pages.push(groupIntoRows(items));
  }
  return pages;
}

function groupIntoRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= Y_TOLERANCE);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  return rows.sort((a, b) => b.y - a.y);
}

// Devuelve el primer item cuyo x cae en [min, max), o null.
export function cell(rowItems, min, max) {
  const it = rowItems.find((i) => i.x >= min && i.x < max);
  return it ? it.str.trim() : '';
}

// Concatena todos los items cuyo x cae en [min, max).
export function cellJoin(rowItems, min, max) {
  return rowItems
    .filter((i) => i.x >= min && i.x < max)
    .map((i) => i.str.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function rowText(rowItems) {
  return rowItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
}
