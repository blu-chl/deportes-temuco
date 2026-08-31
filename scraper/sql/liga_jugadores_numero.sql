-- Número de camiseta por jugador de la liga. El scraper ya extrae el
-- dorsal de cada alineación (lo usa para cruzar goles/tarjetas/cambios
-- con el jugador), pero nunca lo guardaba en liga_jugadores — se agrega
-- acá para poder mostrarlo (ej. goleadores de la liga, en vez de solo
-- iniciales). Se actualiza con "el último dorsal visto" en cada scrapeo,
-- así que si un jugador cambia de número, queda el más reciente.

alter table liga_jugadores add column if not exists numero int;
