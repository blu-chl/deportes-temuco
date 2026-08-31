-- Voto MVP por partido (beta): cualquier visitante puntúa de 1 a 5 balones
-- a los jugadores de Temuco que jugaron esa fecha. Sin login — el "votante"
-- es un UUID que la app genera y guarda en el localStorage del navegador
-- (columna votante_id), así que es anti-abuso débil (un browser = un voto
-- por jugador por partido, pero borrar site data o cambiar de navegador
-- resetea eso). Es la PRIMERA tabla de la app con escritura pública: todas
-- las demás requieren sesión admin.

create table if not exists liga_votos_mvp (
  id bigint generated always as identity primary key,
  partido_id bigint not null references liga_partidos(id) on delete cascade,
  jugador_id bigint not null references liga_jugadores(id) on delete cascade,
  puntaje int not null check (puntaje between 1 and 5),
  votante_id text not null,
  created_at timestamptz default now(),
  unique (partido_id, jugador_id, votante_id)
);

create index if not exists liga_votos_mvp_partido_idx on liga_votos_mvp (partido_id);

alter table liga_votos_mvp enable row level security;

drop policy if exists liga_votos_mvp_read on liga_votos_mvp;
create policy liga_votos_mvp_read on liga_votos_mvp for select using (true);

drop policy if exists liga_votos_mvp_insert on liga_votos_mvp;
create policy liga_votos_mvp_insert on liga_votos_mvp for insert with check (true);

-- Permite cambiar el propio voto (upsert por partido_id+jugador_id+votante_id).
drop policy if exists liga_votos_mvp_update on liga_votos_mvp;
create policy liga_votos_mvp_update on liga_votos_mvp for update using (true) with check (true);
