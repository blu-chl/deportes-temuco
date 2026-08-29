// Bot de Telegram de Deportes Temuco — comandos fijos, sin LLM.
// Lee directo de Supabase (misma llave publicable que usa la web, solo
// lectura por RLS) y responde vía la API HTTP de Telegram. Corre como
// Cloudflare Worker: Telegram llama a este endpoint (webhook) por cada
// mensaje, no hay proceso corriendo 24/7 que mantener.

const FK_LOCAL = 'liga_partidos_equipo_local_id_fkey'
const FK_VISITA = 'liga_partidos_equipo_visita_id_fkey'

async function sbGet(env, table, query) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
  })
  if (!r.ok) throw new Error(`Supabase ${table} → HTTP ${r.status}`)
  const j = await r.json()
  return Array.isArray(j) ? j : []
}

function fmtFecha(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })
}

async function equipoTemuco(env) {
  const equipos = await sbGet(env, 'liga_equipos', '?select=id,nombre&order=nombre')
  return { equipos, temuco: equipos.find((e) => e.nombre === 'Deportes Temuco') }
}

// ===== Comandos =====

async function cmdUltimo(env) {
  const { temuco } = await equipoTemuco(env)
  if (!temuco) return 'No encontré a Deportes Temuco en la base.'
  const partidos = await sbGet(
    env,
    'liga_partidos',
    `?or=(equipo_local_id.eq.${temuco.id},equipo_visita_id.eq.${temuco.id})&goles_local=not.is.null` +
      `&select=jornada,fecha_hora,estadio,local:liga_equipos!${FK_LOCAL}(nombre),visita:liga_equipos!${FK_VISITA}(nombre),goles_local,goles_visita` +
      `&order=fecha_hora.desc&limit=1`
  )
  const p = partidos[0]
  if (!p) return 'Todavía no hay partidos jugados registrados.'
  return `📋 *Fecha ${p.jornada || '-'}*\n${p.local.nombre} *${p.goles_local} - ${p.goles_visita}* ${p.visita.nombre}\n${fmtFecha(p.fecha_hora)}${p.estadio ? ' · ' + p.estadio : ''}`
}

async function cmdProximo(env) {
  const { temuco } = await equipoTemuco(env)
  if (!temuco) return 'No encontré a Deportes Temuco en la base.'
  const partidos = await sbGet(
    env,
    'liga_partidos',
    `?or=(equipo_local_id.eq.${temuco.id},equipo_visita_id.eq.${temuco.id})&goles_local=is.null` +
      `&select=jornada,fecha_hora,estadio,local:liga_equipos!${FK_LOCAL}(nombre),visita:liga_equipos!${FK_VISITA}(nombre)` +
      `&order=fecha_hora.asc&limit=1`
  )
  const p = partidos[0]
  if (!p) return 'No hay próximo partido programado todavía.'
  return `🔜 *Fecha ${p.jornada || '-'}*\n${p.local.nombre} vs ${p.visita.nombre}\n${fmtFecha(p.fecha_hora)}${p.estadio ? ' · ' + p.estadio : ''}`
}

async function cmdTabla(env) {
  const { equipos } = await equipoTemuco(env)
  const partidos = await sbGet(
    env,
    'liga_partidos',
    '?goles_local=not.is.null&select=equipo_local_id,equipo_visita_id,goles_local,goles_visita&limit=1000'
  )
  const st = {}
  equipos.forEach((e) => (st[e.id] = { nombre: e.nombre, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }))
  partidos.forEach((p) => {
    const l = st[p.equipo_local_id], v = st[p.equipo_visita_id]
    if (!l || !v) return
    l.pj++; v.pj++
    l.gf += p.goles_local; l.gc += p.goles_visita
    v.gf += p.goles_visita; v.gc += p.goles_local
    if (p.goles_local > p.goles_visita) { l.pg++; l.pts += 3; v.pp++ }
    else if (p.goles_local < p.goles_visita) { v.pg++; v.pts += 3; l.pp++ }
    else { l.pe++; v.pe++; l.pts++; v.pts++ }
  })
  const tabla = Object.values(st).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  const filas = tabla
    .map((e, i) => {
      const pos = String(i + 1).padStart(2, ' ')
      const nom = (e.nombre.length > 16 ? e.nombre.slice(0, 15) + '…' : e.nombre).padEnd(16, ' ')
      const dg = e.gf - e.gc
      return `${pos} ${nom} ${String(e.pj).padStart(2)} ${String(e.pts).padStart(3)}pt ${dg >= 0 ? '+' : ''}${dg}`
    })
    .join('\n')
  return `🏆 *Tabla — Liga de Ascenso Caixun 2026*\n\`\`\`\n${filas}\n\`\`\``
}

async function cmdGoleadores(env) {
  const [goles, jugadores, equipos] = await Promise.all([
    sbGet(env, 'liga_goles', '?select=jugador_id,autogol&autogol=eq.false&limit=1000'),
    sbGet(env, 'liga_jugadores', '?select=id,nombre,apellido,equipo_id&limit=1000'),
    sbGet(env, 'liga_equipos', '?select=id,nombre'),
  ])
  const jugMap = {}; jugadores.forEach((j) => (jugMap[j.id] = j))
  const eqMap = {}; equipos.forEach((e) => (eqMap[e.id] = e.nombre))
  const conteo = {}
  goles.forEach((g) => (conteo[g.jugador_id] = (conteo[g.jugador_id] || 0) + 1))
  const top = Object.entries(conteo)
    .map(([jid, n]) => {
      const j = jugMap[jid]
      return { goles: n, nombre: j ? `${j.nombre} ${j.apellido}` : '?', equipo: j ? eqMap[j.equipo_id] || '?' : '?' }
    })
    .sort((a, b) => b.goles - a.goles)
    .slice(0, 10)
  const filas = top.map((g, i) => `${i + 1}. ${g.nombre} (${g.equipo}) — *${g.goles}*`).join('\n')
  return `⚽ *Goleadores de la temporada*\n${filas}`
}

async function cmdRival(env, args) {
  const q = args.join(' ').trim()
  if (!q) return 'Uso: `/rival <nombre del equipo>`\nEj: `/rival Cobreloa`'
  const { equipos } = await equipoTemuco(env)
  const qLower = q.toLowerCase()
  const matches = equipos.filter((e) => e.nombre.toLowerCase().includes(qLower))
  if (matches.length === 0) return `No encontré ningún equipo que coincida con "${q}".`
  if (matches.length > 1) return `Hay varios equipos que coinciden:\n${matches.map((e) => '• ' + e.nombre).join('\n')}\nSé más específico.`
  const equipo = matches[0]
  const partidos = await sbGet(
    env,
    'liga_partidos',
    `?or=(equipo_local_id.eq.${equipo.id},equipo_visita_id.eq.${equipo.id})&goles_local=not.is.null` +
      `&select=jornada,fecha_hora,local:liga_equipos!${FK_LOCAL}(nombre),visita:liga_equipos!${FK_VISITA}(nombre),goles_local,goles_visita` +
      `&order=fecha_hora.desc&limit=5`
  )
  if (partidos.length === 0) return `${equipo.nombre} todavía no tiene partidos jugados registrados.`
  const filas = partidos
    .map((p) => `F${p.jornada || '-'}  ${p.local.nombre} ${p.goles_local}-${p.goles_visita} ${p.visita.nombre}`)
    .join('\n')
  return `📅 *${equipo.nombre} — últimos partidos*\n\`\`\`\n${filas}\n\`\`\``
}

const COMANDOS = {
  start: async () =>
    '👋 Bot de Deportes Temuco.\nUsa /help para ver los comandos disponibles.',
  help: async () =>
    '*Comandos disponibles*\n' +
    '/ultimo — último resultado de Temuco\n' +
    '/proximo — próximo partido de Temuco\n' +
    '/tabla — tabla de posiciones\n' +
    '/goleadores — top 10 goleadores de la liga\n' +
    '/rival <equipo> — últimos partidos de un equipo',
  ultimo: cmdUltimo,
  proximo: cmdProximo,
  tabla: cmdTabla,
  goleadores: cmdGoleadores,
  rival: cmdRival,
}

async function enviarMensaje(env, chatId, texto) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
  })
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('ok')

    // Solo aceptar updates que realmente vengan de Telegram (el secret_token
    // se configura una vez al registrar el webhook, ver README).
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 })
    }

    let update
    try {
      update = await request.json()
    } catch {
      return new Response('bad request', { status: 400 })
    }

    const msg = update.message
    const text = msg && msg.text
    if (!msg || !text || !text.startsWith('/')) return new Response('ok')

    const [cmdRaw, ...args] = text.trim().split(/\s+/)
    const cmd = cmdRaw.slice(1).split('@')[0].toLowerCase()
    const handler = COMANDOS[cmd]

    let respuesta
    try {
      respuesta = handler ? await handler(env, args) : 'Comando no reconocido. Usa /help.'
    } catch (e) {
      respuesta = '⚠️ Error consultando los datos. Intenta de nuevo en un rato.'
    }

    await enviarMensaje(env, msg.chat.id, respuesta)
    return new Response('ok')
  },
}
