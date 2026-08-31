-- Foto por estadio (cuadrado chico en la hero card de Próxima fecha y en
-- el detalle de partido). El nombre del estadio ya sale del scraper
-- (liga_partidos.estadio) — acá solo se guarda la URL de la foto,
-- emparejada por ese mismo nombre exacto. Lectura pública, escritura solo
-- para el cuerpo técnico logueado en Admin (mismo patrón que
-- liga_notas_rivales).

create table if not exists liga_estadios (
  nombre text primary key,
  foto_url text
);

alter table liga_estadios enable row level security;

drop policy if exists liga_estadios_read on liga_estadios;
create policy liga_estadios_read on liga_estadios for select using (true);

drop policy if exists liga_estadios_write on liga_estadios;
create policy liga_estadios_write on liga_estadios for insert
  with check (auth.role() = 'authenticated');

drop policy if exists liga_estadios_update on liga_estadios;
create policy liga_estadios_update on liga_estadios for update
  using (auth.role() = 'authenticated');
