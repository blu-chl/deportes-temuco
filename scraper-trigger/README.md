# temuco-scraper-trigger

Worker de Cloudflare que dispara el workflow "Web Scraper" de GitHub
Actions desde el botón en Admin → Enriquecer de la app. Existe porque el
token de GitHub necesario para disparar workflows **no puede vivir en el
navegador** (cualquiera podría verlo en el código fuente de la página y
usarlo para lo que quiera en el repo) — este Worker lo guarda como
secreto y solo lo usa si quien llama trae una sesión de admin válida.

## 1. Crear el token de GitHub (Fine-Grained PAT)

1. Andá a https://github.com/settings/personal-access-tokens/new
2. **Resource owner**: tu usuario (`blu-chl` o el dueño del repo).
3. **Repository access**: "Only select repositories" → elegí solo
   `deportes-temuco`. NO le des acceso a todos tus repos.
4. **Permissions** → **Repository permissions** → **Actions**: `Read and write`.
   No hace falta ningún otro permiso.
5. Generá el token y copialo — GitHub solo lo muestra una vez.

## 2. Deploy

Este proyecto tiene el mismo problema de antes: la carpeta tiene un `:`
en la ruta, lo que rompe `npx`/`npm run`. Por eso todo se corre con el
binario directo.

```bash
cd scraper-trigger
npm install
./node_modules/.bin/wrangler login
```

Cargá el token de GitHub como secreto (te va a pedir que lo pegues,
apretás Enter y queda guardado — nunca queda visible en la terminal ni
en ningún archivo):

```bash
./node_modules/.bin/wrangler secret put GITHUB_TOKEN
```

Deploy:

```bash
./node_modules/.bin/wrangler deploy
```

Al terminar, Wrangler imprime la URL del Worker (algo como
`https://temuco-scraper-trigger.<tu-cuenta>.workers.dev`). Copiala.

## 3. Conectar con la app

Pasame la URL que te dio el deploy y actualizo `index.html` para que el
botón "🔄 Sincronizar liga ahora" en Admin apunte ahí.

## Actualizar después de un cambio

```bash
cd scraper-trigger
./node_modules/.bin/wrangler deploy
```

El secreto `GITHUB_TOKEN` no se pierde entre deploys, no hace falta
volver a cargarlo salvo que quieras rotarlo.
