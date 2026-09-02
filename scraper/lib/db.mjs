// Cliente REST minimalista para Supabase, mismo patrón que usa index.html
// (fetch directo a /rest/v1/), pero acá con la service_role key: el scraper
// corre en GitHub Actions (server-side), nunca en el navegador, así que
// puede saltarse RLS para escribir. La llave nunca queda en el repo, se lee
// de variables de entorno / secrets de GitHub.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  throw new Error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno');
}

async function sb(method, table, { body, params = '', prefer } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
  };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${table}${params}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!r.ok) {
    throw new Error(`Supabase ${method} ${table} -> ${r.status}: ${text}`);
  }
  return parsed;
}

export const get = (table, params = '') => sb('GET', table, { params });
export const patch = (table, params, body) => sb('PATCH', table, { params, body });
const del = (table, params) => sb('DELETE', table, { params });

// Upsert por una columna "clave" (ej. slug, o una combinación con
// on_conflict). Devuelve la fila resultante.
export async function upsertOne(table, row, onConflict) {
  const result = await sb('POST', table, {
    body: row,
    params: `?on_conflict=${onConflict}`,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return Array.isArray(result) ? result[0] : result;
}

export async function upsertEquipo(nombre, slug) {
  const rows = await get('liga_equipos', `?nombre=eq.${encodeURIComponent(nombre)}`);
  if (Array.isArray(rows) && rows[0]) return rows[0];
  const created = await sb('POST', 'liga_equipos', {
    body: { nombre, slug },
    prefer: 'return=representation',
  });
  return created[0];
}

export async function upsertJugador(equipoId, apellido, nombre) {
  const params = `?equipo_id=eq.${equipoId}&apellido=eq.${encodeURIComponent(apellido)}&nombre=eq.${encodeURIComponent(nombre)}`;
  const rows = await get('liga_jugadores', params);
  if (Array.isArray(rows) && rows[0]) return rows[0];

  // A jugador cuya celda "Nombre" viene vacía en el PDF fuente de ANFP (pasa
  // en algunos informes, no es un bug del parser) crearía un duplicado cada
  // vez que un scrapeo posterior sí trajera el nombre completo, o viceversa.
  // Antes de crear uno nuevo, si hay exactamente un jugador con el mismo
  // apellido en ese equipo cuyo nombre está vacío o coincide con este por
  // prefijo, lo reutilizamos (completando el nombre si nos falta a nosotros).
  if (apellido) {
    const mismosApellido = await get(
      'liga_jugadores',
      `?equipo_id=eq.${equipoId}&apellido=eq.${encodeURIComponent(apellido)}&select=id,nombre`
    );
    if (Array.isArray(mismosApellido) && mismosApellido.length === 1) {
      const existente = mismosApellido[0];
      if (!existente.nombre && nombre) {
        await sb('PATCH', 'liga_jugadores', { body: { nombre }, params: `?id=eq.${existente.id}` });
        return { ...existente, nombre };
      }
      if (existente.nombre && !nombre) {
        return existente;
      }
    }
  }

  const created = await sb('POST', 'liga_jugadores', {
    body: { equipo_id: equipoId, apellido, nombre },
    prefer: 'return=representation',
  });
  return created[0];
}

// Best-effort: guarda el "último dorsal visto" para el jugador. Columna
// nueva (`liga_jugadores.numero`, ver scraper/sql/liga_jugadores_numero.sql)
// — si todavía no se corrió esa migración en Supabase, el PATCH falla con
// "column does not exist"; se ignora ese error puntual para no tumbar el
// scrapeo completo por un dato que es un plus, no algo crítico.
export async function actualizarNumeroJugador(jugadorId, numero) {
  if (numero == null || !jugadorId) return;
  try {
    await sb('PATCH', 'liga_jugadores', { body: { numero }, params: `?id=eq.${jugadorId}` });
  } catch (e) {
    if (!/numero/i.test(e.message)) throw e;
  }
}

export async function upsertPartido(partido) {
  return upsertOne('liga_partidos', partido, 'match_url');
}

// Las tablas de eventos (alineaciones/goles/tarjetas/sustituciones) se
// reemplazan completas por partido en cada corrida: es más simple y robusto
// que hacer upsert campo a campo, y permite corregir datos si el informe se
// vuelve a scrapear (ej. porque ANFP corrigió el PDF).
//
// liga_goles es la excepción: tiene subtipo/asistidor_id/asist_subtipo, que
// el scraper nunca rellena (son 100% trabajo manual de Admin → Enriquecer).
// Antes de borrar y reinsertar se rescata ese enriquecimiento por gol —
// matcheando por jugador_id+minuto+minuto_extra+autogol, que identifica un
// gol de forma prácticamente única dentro de un mismo partido — y se
// reaplica a la fila nueva que corresponda, para que volver a scrapear un
// partido (ej. con --force) no borre lo ya cargado a mano.
export async function reemplazarEventosPartido(partidoId, { alineaciones, goles, tarjetas, sustituciones }) {
  const golesPrevios = await get(
    'liga_goles',
    `?partido_id=eq.${partidoId}&select=jugador_id,minuto,minuto_extra,autogol,subtipo,asistidor_id,asist_subtipo`
  );
  const claveGol = (g) => `${g.jugador_id}_${g.minuto}_${g.minuto_extra || 0}_${g.autogol}`;
  const enriquecimientoPorClave = {};
  if (Array.isArray(golesPrevios)) {
    for (const g of golesPrevios) {
      if (g.subtipo == null && g.asistidor_id == null && g.asist_subtipo == null) continue;
      enriquecimientoPorClave[claveGol(g)] = {
        subtipo: g.subtipo,
        asistidor_id: g.asistidor_id,
        asist_subtipo: g.asist_subtipo,
      };
    }
  }
  const golesConEnriquecimiento = goles.map((g) => {
    const previo = enriquecimientoPorClave[claveGol(g)];
    return previo ? { ...g, ...previo } : g;
  });

  await del('liga_alineaciones', `?partido_id=eq.${partidoId}`);
  await del('liga_goles', `?partido_id=eq.${partidoId}`);
  await del('liga_tarjetas', `?partido_id=eq.${partidoId}`);
  await del('liga_sustituciones', `?partido_id=eq.${partidoId}`);

  if (alineaciones.length) await sb('POST', 'liga_alineaciones', { body: alineaciones });
  if (golesConEnriquecimiento.length) await sb('POST', 'liga_goles', { body: golesConEnriquecimiento });
  if (tarjetas.length) await sb('POST', 'liga_tarjetas', { body: tarjetas });
  if (sustituciones.length) await sb('POST', 'liga_sustituciones', { body: sustituciones });
}

export async function listarEquipos() {
  return get('liga_equipos', '?select=id,nombre');
}

export async function listarJugadoresEquipo(equipoId) {
  return get('liga_jugadores', `?equipo_id=eq.${equipoId}&select=id,apellido,nombre`);
}

export async function crearJugador(equipoId, apellido, nombre, extra = {}) {
  const created = await sb('POST', 'liga_jugadores', {
    body: { equipo_id: equipoId, apellido, nombre, ...extra },
    prefer: 'return=representation',
  });
  return created[0];
}

export async function actualizarDatosU21(jugadorId, { fecha_nacimiento, minutos_oficial_temporada }) {
  await sb('PATCH', 'liga_jugadores', {
    body: { fecha_nacimiento, sub21: true, minutos_oficial_temporada },
    params: `?id=eq.${jugadorId}`,
  });
}

// Total oficial ANFP (fila "TOTAL CONTABLE" del PDF) — no confundir con la
// suma de minutos_oficial_temporada de los jugadores, que sobrecuenta.
export async function actualizarSub21Contable(equipoId, totalContable) {
  if (totalContable == null) return;
  await sb('PATCH', 'liga_equipos', {
    body: { sub21_minutos_contable: totalContable },
    params: `?id=eq.${equipoId}`,
  });
}

// Devuelve el id si el partido ya está completo (informe procesado, con
// resultado). Una fila "programada" (sin resultado aún, guardada solo para
// el calendario de próximos rivales) no cuenta como completa: se debe poder
// reprocesar en cuanto el informe se publique.
export async function partidoYaExiste(matchUrl) {
  const rows = await get('liga_partidos', `?match_url=eq.${encodeURIComponent(matchUrl)}&select=id,goles_local`);
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return row && row.goles_local !== null ? row.id : null;
}
