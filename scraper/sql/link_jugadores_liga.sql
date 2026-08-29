-- Conecta el plantel propio (tabla "jugadores", cargada a mano en Admin)
-- con su identidad en los datos scrapeados de la liga (liga_jugadores),
-- que hoy solo coinciden por nombre en texto libre y pueden desalinearse
-- silenciosamente (ej. si ANFP cambia la ortografía de un apellido entre
-- informes). El scraper llena esta columna automáticamente
-- (scraper/link-jugadores.mjs), no hace falta tocarla a mano.

alter table jugadores add column if not exists liga_jugador_id bigint references liga_jugadores(id) on delete set null;

create index if not exists jugadores_liga_jugador_idx on jugadores (liga_jugador_id);
