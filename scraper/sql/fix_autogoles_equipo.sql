-- Corrige un bug del scraper (ya arreglado en scraper/scrape.mjs): los
-- autogoles quedaban con equipo_id = el equipo DEL JUGADOR que lo metió,
-- en vez de equipo_id = el equipo RIVAL (a quien realmente le suma el gol
-- en el marcador). Esto hacía que, por ejemplo, un autogol de Temuco
-- apareciera contando COMO GOL DE TEMUCO en vez de como gol en contra,
-- descuadrando goles por período, "rachas y curiosidades", etc.
--
-- Este UPDATE da vuelta el equipo_id de cada autogol ya cargado, una sola
-- vez. Correrlo de nuevo no hace nada malo pero tampoco hace falta — ya
-- queda corregido la primera vez.

update liga_goles g
set equipo_id = case
  when g.equipo_id = p.equipo_local_id then p.equipo_visita_id
  else p.equipo_local_id
end
from liga_partidos p
where g.partido_id = p.id and g.autogol = true;
