-- Qué camiseta usó realmente cada equipo en un partido.
--
-- Por defecto la app asume lo normal: el local juega con la titular y el
-- visitante con la alternativa. Pero eso no siempre pasa — si no hay
-- choque de colores, el visitante suele salir con su camiseta titular.
-- Estas dos columnas permiten fijarlo partido por partido desde Admin;
-- en null, se usa el criterio por defecto.
--
-- El scraper NUNCA escribe estas columnas (el informe de ANFP no dice qué
-- indumentaria se usó), mismo patrón que resumen_youtube_url.

alter table liga_partidos add column if not exists uniforme_local text
  check (uniforme_local in ('local', 'visita'));
alter table liga_partidos add column if not exists uniforme_visita text
  check (uniforme_visita in ('local', 'visita'));

-- La política de escritura para el admin logueado ya existe
-- (liga_partidos_write, ver liga_partidos_resumen_youtube.sql), así que
-- no hace falta tocarla acá.
