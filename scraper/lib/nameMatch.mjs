// La tabla de minutos sub-21 nombra a cada jugador como "PrimerNombre
// PrimerApellido" (a veces con algún token de más), mientras que
// liga_jugadores guarda apellido/nombre completos sacados del informe de
// partido — y encima los dos sistemas de ANFP a veces escriben el mismo
// apellido distinto (ej. "Ithal" vs "Ital"). Por eso el match es por
// similitud de tokens con tolerancia a errores de tipeo, no por igualdad
// exacta de string.

function normalizar(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s) {
  return normalizar(s).split(' ').filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function tokensParecidos(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false; // tokens cortos: exigir igualdad exacta
  return levenshtein(a, b) <= 1;
}

// Puntaje 0..1: proporción de tokens del nombre corto (doc U21) que
// encuentran un token parecido en el candidato (apellido+nombre completos).
function score(nombreCorto, apellido, nombre) {
  const docTokens = tokens(nombreCorto);
  const candTokens = tokens(`${nombre} ${apellido}`);
  if (!docTokens.length || !candTokens.length) return 0;
  let matches = 0;
  for (const dt of docTokens) {
    if (candTokens.some((ct) => tokensParecidos(dt, ct))) matches++;
  }
  return matches / docTokens.length;
}

// Busca, entre jugadores [{id, apellido, nombre}] de UN equipo, el que mejor
// calza con el nombre corto del documento sub-21. Umbral alto (0.9 = casi
// todos los tokens del nombre corto deben aparecer) porque una atribución
// equivocada de fecha de nacimiento es peor que crear un jugador de más.
export function encontrarJugador(nombreCorto, jugadores) {
  let mejor = null;
  let mejorScore = 0;
  for (const j of jugadores) {
    const s = score(nombreCorto, j.apellido, j.nombre);
    if (s > mejorScore) {
      mejorScore = s;
      mejor = j;
    }
  }
  return mejorScore >= 0.9 ? mejor : null;
}

// Para crear un jugador nuevo cuando no hay match: partimos "Nombre
// Apellido" -> último token = apellido, el resto = nombre. Es una
// aproximación (no siempre correcto con apellidos compuestos), pero es
// exactamente lo que trae el documento y sirve como fallback razonable.
export function partirNombreCorto(nombreCorto) {
  const partes = nombreCorto.trim().split(/\s+/);
  if (partes.length === 1) return { nombre: partes[0], apellido: partes[0] };
  const apellido = partes[partes.length - 1];
  const nombre = partes.slice(0, -1).join(' ');
  return { nombre, apellido };
}
