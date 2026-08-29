# Bot de Telegram — Deportes Temuco

Bot de comandos fijos (sin LLM, gratis) que responde con datos en vivo desde
Supabase. Corre como Cloudflare Worker: no hay servidor que mantener
prendido, Telegram le pega a una URL cada vez que alguien escribe.

## Comandos

- `/ultimo` — último resultado de Temuco
- `/proximo` — próximo partido de Temuco
- `/tabla` — tabla de posiciones completa
- `/goleadores` — top 10 goleadores de la liga
- `/rival <equipo>` — últimos partidos de un equipo (ej: `/rival Cobreloa`)

## Deploy (una sola vez)

**1. Crear el bot en Telegram y obtener el token**
Abre Telegram, busca `@BotFather`, mándale `/newbot` y sigue las
instrucciones (nombre, username terminado en `bot`). Al final te da un
**token** — cópialo, lo vas a necesitar en el paso 4. No lo compartas ni lo
pegues en el código.

**2. Instalar dependencias**
```bash
cd telegram-bot
npm install
```

**3. Conectar con Cloudflare**
Necesitas una cuenta de Cloudflare (gratis, si no tienes créala en
cloudflare.com). Luego:
```bash
npx wrangler login
```
Esto abre el navegador para autorizar — solo se hace una vez.

**4. Guardar los secretos**
El token de Telegram y un secreto propio para verificar que los mensajes
al webhook realmente vienen de Telegram (no van en `wrangler.toml` porque
ese archivo queda en el repo):
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# pega el token de BotFather cuando lo pida

npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# pega cualquier string random largo, ej generado con: openssl rand -hex 24
```

**5. Deploy**
```bash
npm run deploy
```
Al terminar te muestra la URL del worker, algo como:
`https://temuco-bot.<tu-subdominio>.workers.dev`

**6. Registrar el webhook con Telegram**
Reemplaza `<TOKEN>`, `<URL_DEL_WORKER>` y `<WEBHOOK_SECRET>` (el mismo que
pusiste en el paso 4) y corre:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=<URL_DEL_WORKER>" \
  -d "secret_token=<WEBHOOK_SECRET>"
```
Debería responder `{"ok":true,"result":true,...}`.

**7. Probar**
Abre el chat con tu bot en Telegram y manda `/start`.

## Actualizar el bot más adelante

Cualquier cambio en `src/index.js` se sube con:
```bash
npm run deploy
```
No hace falta volver a registrar el webhook (la URL no cambia).
