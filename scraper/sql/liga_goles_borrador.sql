-- Borrador de goles de Deportes Temuco, cargado a mano desde Admin apenas
-- termina el partido (antes de que ANFP publique el informe y el scraper
-- pueda procesarlo). No se sabe el minuto exacto de cada gol todavía —
-- por eso "orden" es la posición cronológica dentro del partido (1°, 2°,
-- 3° gol de Temuco) tal como el admin los va cargando, no un minuto.
--
-- Cuando el scraper procesa el informe real, cruza el gol N del orden acá
-- con el N-ésimo gol de Temuco ordenado por minuto en liga_goles, valida
-- que jugador_id coincida (si se cargó) y le copia subtipo/asistidor_id/
-- asist_subtipo. Ver aplicarBorradorGoles en scraper/lib/db.mjs. Las filas
-- aplicadas se borran solas; las que no calzaron quedan para revisar a mano.

create table if not exists liga_goles_borrador (
  id bigint generated always as identity primary key,
  partido_id bigint not null references liga_partidos(id) on delete cascade,
  orden int not null,
  jugador_id bigint references liga_jugadores(id) on delete set null,
  subtipo text,
  asistidor_id bigint references liga_jugadores(id) on delete set null,
  asist_subtipo text,
  created_at timestamptz not null default now(),
  unique (partido_id, orden)
);

create index if not exists liga_goles_borrador_partido_idx on liga_goles_borrador (partido_id);

alter table liga_goles_borrador enable row level security;

drop policy if exists liga_goles_borrador_read on liga_goles_borrador;
create policy liga_goles_borrador_read on liga_goles_borrador for select using (true);

-- Se carga y se borra desde el navegador del admin logueado (misma llave
-- "authenticated" que ya usa liga_goles para el enriquecimiento) — el
-- scraper, aparte, también puede tocarla porque corre con service_role,
-- que salta RLS.
drop policy if exists liga_goles_borrador_write on liga_goles_borrador;
create policy liga_goles_borrador_write on liga_goles_borrador for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
