-- Posición (POR/DEF/MED/DEL) para jugadores de liga_jugadores, editable a
-- mano desde Admin. El scraper NUNCA escribe esta columna (el informe de
-- ANFP no trae posición) — por eso es segura: no hay riesgo de que el
-- próximo scrapeo pise lo que se cargue acá, a diferencia de otros campos
-- que sí vienen del informe.

alter table liga_jugadores add column if not exists posicion text check (posicion in ('POR','DEF','MED','DEL'));

drop policy if exists liga_jugadores_write on liga_jugadores;
create policy liga_jugadores_write on liga_jugadores for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
