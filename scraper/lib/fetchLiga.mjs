import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; deportes-temuco-scraper/1.0; +https://github.com/blu-chl/deportes-temuco)';

// Cloudflare devuelve de vez en cuando un 5xx transitorio (ej. 520) sin que
// haya nada mal con la request; un reintento simple con backoff resuelve
// casi todos esos casos sin tener que relanzar todo el workflow.
async function fetchConReintentos(url, options, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, options);
      if (r.ok) return r;
      if (r.status < 500 || i === intentos) throw new Error(`HTTP ${r.status} al pedir ${url}`);
    } catch (e) {
      if (i === intentos) throw e;
    }
    await new Promise((res) => setTimeout(res, 1000 * i));
  }
}

async function fetchHtml(url) {
  const r = await fetchConReintentos(url, { headers: { 'User-Agent': UA } });
  return r.text();
}

// Lista todas las URLs /match/.../ enlazadas desde la página de la liga
// (el fixture de temporada completa vive en una sola página).
export async function listMatchUrls(ligaUrl) {
  const html = await fetchHtml(ligaUrl);
  const $ = cheerio.load(html);
  const urls = new Set();
  $('a[href*="/match/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) urls.add(href.split('?')[0]);
  });
  return [...urls];
}

function slugFromClubUrl(href) {
  if (!href) return null;
  const m = href.match(/\/club\/([^/]+)\/?/);
  return m ? m[1] : null;
}

// Extrae del HTML todo lo que NO viene en el PDF: nombres/slugs de equipo,
// marcador, fecha/hora ISO, competencia, jornada, estadio, árbitros y el
// link al PDF del informe. Devuelve null si el partido aún no se jugó o el
// informe todavía no está publicado.
export async function fetchMatch(matchUrl) {
  const html = await fetchHtml(matchUrl);
  const $ = cheerio.load(html);

  const pdfLink = $('a[href$=".pdf"]')
    .filter((_, el) => /informe.*arbitro/i.test($(el).text()) || /informe.*arbitro/i.test($(el).attr('href') || ''))
    .first();
  const pdfUrl = pdfLink.attr('href') || null;

  const scoreboard = $('.match-scoreboard').first();
  const datetimeIso = scoreboard.attr('data-fl-game-datetime') || null;

  const clubWrappers = scoreboard.find('.match-scoreboard__club-wrapper');
  const homeWrap = clubWrappers.eq(0);
  const awayWrap = clubWrappers.eq(1);
  const equipoLocal = homeWrap.find('.match-scoreboard__club-title').first().text().trim();
  const equipoVisita = awayWrap.find('.match-scoreboard__club-title').first().text().trim();
  const slugLocal = slugFromClubUrl(homeWrap.find('a.anwp-link-cover').attr('href'));
  const slugVisita = slugFromClubUrl(awayWrap.find('a.anwp-link-cover').attr('href'));

  const scoreNums = scoreboard.find('.match-scoreboard__score-number');
  const golesLocal = scoreNums.eq(0).text().trim();
  const golesVisita = scoreNums.eq(1).text().trim();
  const resultado = scoreboard.find('.match-scoreboard__text-result').first().text().trim();
  const finalizado = /completo|finalizado|terminado/i.test(resultado) && golesLocal !== '' && golesVisita !== '';

  const competencia = scoreboard.find('.match-scoreboard__header-line a').first().text().trim();
  const jornadaTxt = scoreboard.find('.match-scoreboard__header-line span.anwp-text-nowrap').first().text().trim();
  const jornada = (jornadaTxt.match(/\d+/) || [])[0] || null;
  const estadio = scoreboard.find('.match-scoreboard__header-line a[href*="/estadio/"]').first().text().trim() || null;

  // "Árbitro asistente" aparece dos veces (uno por cada línea) con la misma
  // etiqueta, así que numeramos por orden de aparición en vez de usar un
  // diccionario simple por etiqueta.
  const oficiales = {};
  const asistentes = [];
  $('.match__referee-wrapper').each((_, el) => {
    const job = $(el).find('.match__referee-job').text().replace(':', '').trim();
    const name = $(el).find('.match__referee-name').text().trim();
    if (!job) return;
    if (job === 'Árbitro asistente') asistentes.push(name);
    else oficiales[job] = name;
  });

  if (!equipoLocal || !equipoVisita || !pdfUrl || !finalizado) return null;

  return {
    matchUrl,
    equipoLocal,
    equipoVisita,
    slugLocal,
    slugVisita,
    golesLocal: Number(golesLocal),
    golesVisita: Number(golesVisita),
    fechaHoraIso: datetimeIso,
    competencia,
    jornada: jornada ? Number(jornada) : null,
    estadio,
    pdfUrl,
    arbitro: oficiales['Árbitro'] || null,
    arbitroAsistente1: asistentes[0] || null,
    arbitroAsistente2: asistentes[1] || null,
    cuartoArbitro: oficiales['Cuarto árbitro'] || null,
    var: oficiales['VAR'] || null,
    avar1: oficiales['AVAR'] || null,
  };
}

// La página de la liga tiene un botón a "Tabla Oficial de Minutos Sub 21"
// (uno por liga: LDP=Primera, LDA=Ascenso, Copa=Copa de la Liga). Lo
// ubicamos por el nombre de archivo en vez de por texto del botón para no
// depender de que el label visible no cambie.
export async function findMinutosU21Url(ligaUrl) {
  const html = await fetchHtml(ligaUrl);
  const $ = cheerio.load(html);
  const link = $('a[href*="Tabla-Oficial-Minutos-LDA"]').first();
  return link.attr('href') || null;
}

export async function downloadPdf(pdfUrl) {
  const r = await fetchConReintentos(pdfUrl, { headers: { 'User-Agent': UA } });
  return Buffer.from(await r.arrayBuffer());
}
