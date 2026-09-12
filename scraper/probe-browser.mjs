// Sonda: ¿pasa el bloqueo de Cloudflare un Chromium de verdad?
//
// El 403 que devuelve campeonatochileno.cl es la página del WAF/Bot Fight
// Mode ("Sorry, you have been blocked"), NO la del error 1020 (regla por
// IP o país). La diferencia importa: Bot Fight Mode decide mirando la
// huella de la conexión —TLS, orden de headers, cookies, si corre
// JavaScript— y no solo de dónde viene. Node deja una huella inconfundible
// de robot; un navegador real deja la de un navegador.
//
// Esto no scrapea nada: solo pide la página de la liga con Chromium y
// reporta si entró o si lo bloquearon. Si entra, conviene mover el scraper
// a este camino y no hace falta un runner en un PC de casa.
//
//   node probe-browser.mjs [--url <url>]

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const i = args.indexOf('--url');
const url =
  i !== -1 ? args[i + 1] : process.env.LIGA_URL || 'https://www.campeonatochileno.cl/ligas/liga-de-ascenso-caixun/';

// channel:'chromium' pide el navegador COMPLETO. Sin esto, Playwright usa
// por defecto un "headless shell" recortado, que justamente es más fácil de
// detectar — no es lo que queremos estar probando.
// CHROMIUM_PATH permite apuntar a un binario ya instalado (útil para probar
// la sonda en un entorno donde Playwright no bajó el suyo).
const launchOpts = { channel: 'chromium' };
if (process.env.CHROMIUM_PATH) {
  launchOpts.executablePath = process.env.CHROMIUM_PATH;
  delete launchOpts.channel; // un binario explícito manda sobre el canal
}
const browser = await chromium.launch(launchOpts);
// Contexto con apariencia de navegador chileno real: locale y zona horaria
// consistentes con el User-Agent, porque una mezcla incoherente es
// justamente una de las cosas que delata a un bot.
const context = await browser.newContext({
  locale: 'es-CL',
  timezoneId: 'America/Santiago',
  viewport: { width: 1366, height: 768 },
});
const page = await context.newPage();

console.log(`Pidiendo con Chromium: ${url}`);
let resp;
try {
  resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
} catch (e) {
  console.log(`✗ no cargó: ${e.message.split('\n')[0]}`);
  await browser.close();
  process.exit(1);
}

const status = resp ? resp.status() : 0;
const titulo = await page.title();
console.log(`  status: ${status}`);
console.log(`  título: ${titulo}`);

// El dato que decide: ¿están los links a los partidos?
const links = await page.$$eval('a[href*="/match/"]', (as) => as.length);
const texto = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').trim();

if (links > 0) {
  console.log(`\n✅ PASÓ. Encontró ${links} links a partidos.`);
  console.log('   Se puede scrapear con Chromium desde este runner.');
  await browser.close();
  process.exit(0);
}

// Cloudflare a veces sirve un interstitial y recién después la página real:
// esperar un poco y volver a mirar antes de declararlo bloqueado.
console.log('\n  sin links todavía; esperando 8s por si hay interstitial…');
await page.waitForTimeout(8000);
const links2 = await page.$$eval('a[href*="/match/"]', (as) => as.length);
if (links2 > 0) {
  console.log(`✅ PASÓ tras la espera. ${links2} links a partidos.`);
  await browser.close();
  process.exit(0);
}

console.log(`\n❌ BLOQUEADO igual que con Node.`);
console.log(`   texto: ${texto.slice(0, 400)}`);
await browser.close();
process.exit(1);
