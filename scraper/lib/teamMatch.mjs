// Distintos documentos de campeonatochileno.cl/ANFP nombran a los mismos
// equipos de formas distintas: el informe de partido usa un nombre corto
// ("RANGERS", "MAGALLANES", "DEPORTES IQUIQUE"), la tabla de minutos sub-21
// abrevia con prefijos ("DEP. ANTOFAGASTA", "U. SAN FELIPE", "S. WANDERERS"),
// y el HTML trae el nombre completo del club ("Rangers de Talca", "Unión
// Española"). Este módulo normaliza y resuelve esas variantes contra una
// lista de equipos conocidos.

const ABREVIATURAS = {
  dep: 'deportes',
  u: 'union',
  s: 'santiago',
  cd: 'club deportes',
};

function normalizar(s) {
  const base = (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return base
    .split(' ')
    .map((tok) => ABREVIATURAS[tok] || tok)
    .join(' ')
    .trim();
}

// Palabras demasiado genéricas para decidir un match por sí solas.
const RELLENO = new Set(['de', 'del', 'la', 'club', 'deportes', 'deportivo', 'union']);

function tokensSignificativos(s) {
  return normalizar(s)
    .split(' ')
    .filter((t) => t && !RELLENO.has(t));
}

function similitud(a, b) {
  const ta = tokensSignificativos(a);
  const tb = tokensSignificativos(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const comunes = ta.filter((t) => setB.has(t)).length;
  return comunes / Math.max(ta.length, tb.length);
}

export function ladoEquipo(nombreCorto, nombreLocal, nombreVisita) {
  const simLocal = similitud(nombreCorto, nombreLocal);
  const simVisita = similitud(nombreCorto, nombreVisita);
  if (simLocal === 0 && simVisita === 0) return null;
  return simLocal >= simVisita ? 'local' : 'visita';
}

// Busca, entre una lista de equipos [{id, nombre}], el que mejor calza con
// un nombre corto/abreviado. Devuelve el equipo o null si no hay ningún
// match razonable.
export function encontrarEquipo(nombreCorto, equipos) {
  let mejor = null;
  let mejorScore = 0;
  for (const eq of equipos) {
    const score = similitud(nombreCorto, eq.nombre);
    if (score > mejorScore) {
      mejorScore = score;
      mejor = eq;
    }
  }
  return mejorScore >= 0.5 ? mejor : null;
}
