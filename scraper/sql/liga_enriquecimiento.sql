-- Datos que el scraper NO puede sacar del informe de ANFP (no vienen en el
-- PDF) y por eso se cargan a mano desde Admin: foto de jugador, cómo fue
-- cada gol, quién dio el pase y cómo. El scraper nunca escribe estas
-- columnas — mismo patrón que liga_jugadores.posicion, cero riesgo de que
-- un scrapeo futuro pise lo que se cargue acá.

alter table liga_jugadores add column if not exists foto_url text;

alter table liga_goles add column if not exists subtipo text
  check (subtipo in ('Pie Derecho','Pie Izquierdo','Cabeza','Tiro Libre','Otro'));
alter table liga_goles add column if not exists asistidor_id bigint references liga_jugadores(id) on delete set null;
alter table liga_goles add column if not exists asist_subtipo text
  check (asist_subtipo in ('Pase','Pase Filtrado','Centro','Cutback','Córner','Rebote','Individual','Tiro Libre','Penal Cedido','Otro'));

drop policy if exists liga_goles_write on liga_goles;
create policy liga_goles_write on liga_goles for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
