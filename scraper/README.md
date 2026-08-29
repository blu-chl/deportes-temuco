# Scraper de liga (campeonatochileno.cl)

Scrapea el fixture de una liga en campeonatochileno.cl, descarga el "Informe
de Partido" (PDF oficial ANFP/COMET) de cada partido jugado, lo parsea
(alineaciones, goles con minuto, tarjetas con minuto y motivo,
sustituciones) y lo carga a las tablas `liga_*` en Supabase.

Es independiente de las tablas que ya usa la app (`jugadores`, `partidos`,
`eventos`, `minutaje`), que son del plantel propio de Deportes Temuco. Esto
es para tener estadísticas de **toda la liga**: goleadores, tarjetas,
minutos jugados, tendencias local/visita, goles en tiempo extra, etc. de
cualquier equipo, no solo el propio.

## Cómo funciona

1. `lib/fetchLiga.mjs` — lee el HTML de la página de la liga y de cada
   partido (equipos, marcador, fecha, árbitros, link al PDF).
2. `lib/parseInforme.mjs` — descarga y parsea el PDF por coordenadas
   (los informes de COMET son generados por plantilla, así que la posición
   x/y de cada celda es estable entre partidos).
3. `lib/minutaje.mjs` — calcula minutos jugados por jugador a partir de
   titularidad + sustituciones (mismo cálculo que usa la app para el
   plantel propio).
4. `lib/db.mjs` — sube todo a Supabase vía REST, con la `service_role` key
   (nunca la llave pública del navegador).
5. `scrape.mjs` — orquesta todo lo anterior.

## Setup (una sola vez)

1. **Crear las tablas**: copiar y pegar [`sql/liga_schema.sql`](sql/liga_schema.sql)
   completo en el SQL Editor de Supabase y ejecutarlo.
2. **Agregar secrets en GitHub** (Settings → Secrets and variables →
   Actions → New repository secret):
   - `SUPABASE_URL`: `https://vskhzbstwadaabzyhzwh.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: la *service_role key* del proyecto
     (Supabase → Project Settings → API → `service_role`, **no** la
     `anon`/`publishable`). Esta llave sí puede escribir saltándose RLS —
     por eso vive solo en GitHub Secrets, nunca en el código.

## Cómo correrlo

**Desde GitHub (recomendado):** pestaña *Actions* → workflow "Scrapear
liga" → *Run workflow*. Parámetros opcionales: URL de la liga, límite de
partidos (0 = todos) y si forzar re-scrapeo de partidos ya cargados.

**Local, para probar:**

```bash
cd scraper
npm install
node scrape.mjs --dry-run --limit 5   # prueba sin tocar Supabase
node scrape.mjs --limit 20            # requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno
node scrape.mjs                       # liga completa
node scrape.mjs --force               # re-scrapea aunque ya exista el partido
```

## Tabla oficial de minutos sub-21

`scrapeU21.mjs` es un segundo scraper, independiente del de partidos.
Descarga la "Tabla Oficial de Minutos Sub 21" que ANFP publica en la misma
página de la liga (la ubica automáticamente por nombre de archivo, no hace
falta pasarle la URL) y la usa para completar `fecha_nacimiento`, `sub21` y
`minutos_oficial_temporada` en `liga_jugadores`. Como ese documento solo
lista a los jugadores sub-21 de cada plantel, aparecer ahí ya es la
confirmación de que el jugador es sub-21 — no hace falta calcular edad.

El documento nombra a los jugadores como "PrimerNombre PrimerApellido" (a
veces con algún dato de más), y no siempre coincide en la ortografía con el
informe de partido (ej. un mismo jugador aparece como "Ithal" en un sistema
de ANFP y "Ital" en otro). Por eso el cruce con `liga_jugadores` es por
similitud de nombre con tolerancia a errores de tipeo (`lib/nameMatch.mjs`),
con un umbral alto: si no encuentra un match confiable, crea el jugador
como nuevo en vez de arriesgar una fecha de nacimiento mal atribuida.

```bash
node scrapeU21.mjs --dry-run   # imprime todo lo que encontró, sin escribir
node scrapeU21.mjs             # actualiza Supabase
```

Se corre después de `scrape.mjs` en el mismo workflow de GitHub Actions.

## Vincular el plantel propio con liga_jugadores

`jugadores` (el plantel propio, cargado a mano en Admin) y `liga_jugadores`
(scrapeado de ANFP) son dos tablas independientes que hasta ahora solo
"coincidían" por nombre en texto libre — sin nada que garantice que sigan
alineadas si cambia una ortografía. `link-jugadores.mjs` agrega esa
conexión real: llena `jugadores.liga_jugador_id` matcheando por similitud
de nombre (mismo criterio que `scrapeU21.mjs`, `lib/nameMatch.mjs`, umbral
alto). Es idempotente — los que ya están vinculados se saltan — así que
corre solo, después de cada scrapeo (requiere que `sql/link_jugadores_liga.sql`
ya se haya corrido en Supabase).

```bash
node link-jugadores.mjs   # requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
```

Los que no matchean con confianza (score < 0.9) se listan en el log tal
cual — normalmente son jugadores que todavía no debutan en un partido
scrapeado (no tienen fila en `liga_jugadores` para matchear), no un error.

## Qué falta / próximos pasos

- No parsea "Informe del árbitro / delegado" (página 4, incidencias como
  clima o retrasos) — no forma parte de las métricas pedidas por ahora.
- El emparejamiento equipo↔nombre-corto del PDF es por texto normalizado
  (ver `lib/teamMatch.mjs`); validado contra los 16 equipos de Liga de
  Ascenso, pero si se agrega otra liga con nombres muy distintos conviene
  revisar el log del scraper por advertencias "sin equipo resuelto".
- El cruce de nombres de `scrapeU21.mjs` es una aproximación razonable, no
  perfecta: conviene revisar de vez en cuando cuántos jugadores "sin match"
  se están creando de más (podrían ser jugadores duplicados en vez de
  nuevos).
