-- Link al resumen en YouTube de cada partido, editable a mano desde Admin
-- (el informe de ANFP no trae esto). El scraper NUNCA escribe esta
-- columna, mismo patrón que liga_jugadores.posicion/foto_url — cero
-- riesgo de que un scrapeo futuro la pise.

alter table liga_partidos add column if not exists resumen_youtube_url text;

drop policy if exists liga_partidos_write on liga_partidos;
create policy liga_partidos_write on liga_partidos for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
