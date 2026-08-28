-- Esquema para estadísticas de LIGA (todos los equipos del Campeonato de
-- Ascenso, no solo Deportes Temuco). Va separado de las tablas existentes
-- (jugadores, partidos, eventos, minutaje) que son del plantel propio del
-- club y tienen otro propósito (ficha médica, formaciones, etc).
--
-- Cómo correr esto: pegar completo en el SQL Editor de Supabase y ejecutar
-- una sola vez. Es seguro volver a correrlo (usa IF NOT EXISTS).

create table if not exists liga_equipos (
  id bigint generated always as identity primary key,
  nombre text not null,
  slug text unique,
  created_at timestamptz default now()
);
create unique index if not exists liga_equipos_nombre_idx on liga_equipos (lower(nombre));

create table if not exists liga_jugadores (
  id bigint generated always as identity primary key,
  equipo_id bigint not null references liga_equipos(id) on delete cascade,
  apellido text not null,
  nombre text not null,
  -- Estos tres los completa el scraper de la Tabla Oficial de Minutos Sub 21
  -- (fuente distinta al informe de partido): fecha de nacimiento, si ANFP
  -- lo clasifica como sub-21 esta temporada, y su total de minutos oficial
  -- (útil para contrastar contra el minutaje que calculamos nosotros).
  fecha_nacimiento date,
  sub21 boolean not null default false,
  minutos_oficial_temporada int,
  created_at timestamptz default now(),
  unique (equipo_id, apellido, nombre)
);

-- Por si ya habías corrido una versión anterior de este archivo sin estas
-- columnas (CREATE TABLE IF NOT EXISTS no las agrega a una tabla existente).
alter table liga_jugadores add column if not exists fecha_nacimiento date;
alter table liga_jugadores add column if not exists sub21 boolean not null default false;
alter table liga_jugadores add column if not exists minutos_oficial_temporada int;

create table if not exists liga_partidos (
  id bigint generated always as identity primary key,
  match_url text unique not null,
  pdf_url text,
  competencia text,
  jornada int,
  fecha_hora timestamptz,
  estadio text,
  equipo_local_id bigint references liga_equipos(id),
  equipo_visita_id bigint references liga_equipos(id),
  goles_local int,
  goles_visita int,
  arbitro text,
  arbitro_asistente1 text,
  arbitro_asistente2 text,
  cuarto_arbitro text,
  var text,
  avar1 text,
  scraped_at timestamptz default now()
);

create table if not exists liga_alineaciones (
  id bigint generated always as identity primary key,
  partido_id bigint not null references liga_partidos(id) on delete cascade,
  jugador_id bigint not null references liga_jugadores(id) on delete cascade,
  equipo_id bigint not null references liga_equipos(id),
  dorsal int,
  titular boolean not null default false,
  portero boolean not null default false,
  capitan boolean not null default false,
  minutos_jugados int,
  unique (partido_id, jugador_id)
);

create table if not exists liga_goles (
  id bigint generated always as identity primary key,
  partido_id bigint not null references liga_partidos(id) on delete cascade,
  jugador_id bigint not null references liga_jugadores(id) on delete cascade,
  equipo_id bigint not null references liga_equipos(id),
  minuto int not null,
  minuto_extra int not null default 0,
  penal boolean not null default false,
  autogol boolean not null default false
);

create table if not exists liga_tarjetas (
  id bigint generated always as identity primary key,
  partido_id bigint not null references liga_partidos(id) on delete cascade,
  jugador_id bigint not null references liga_jugadores(id) on delete cascade,
  equipo_id bigint not null references liga_equipos(id),
  tipo text not null check (tipo in ('amarilla','roja')),
  segunda_amarilla boolean not null default false,
  minuto int not null,
  minuto_extra int not null default 0,
  motivo text
);

create table if not exists liga_sustituciones (
  id bigint generated always as identity primary key,
  partido_id bigint not null references liga_partidos(id) on delete cascade,
  equipo_id bigint not null references liga_equipos(id),
  entra_jugador_id bigint references liga_jugadores(id) on delete set null,
  sale_jugador_id bigint references liga_jugadores(id) on delete set null,
  minuto int not null,
  minuto_extra int not null default 0
);

create index if not exists liga_alineaciones_partido_idx on liga_alineaciones (partido_id);
create index if not exists liga_alineaciones_jugador_idx on liga_alineaciones (jugador_id);
create index if not exists liga_goles_partido_idx on liga_goles (partido_id);
create index if not exists liga_goles_jugador_idx on liga_goles (jugador_id);
create index if not exists liga_tarjetas_partido_idx on liga_tarjetas (partido_id);
create index if not exists liga_tarjetas_jugador_idx on liga_tarjetas (jugador_id);
create index if not exists liga_sustituciones_partido_idx on liga_sustituciones (partido_id);
create index if not exists liga_partidos_equipos_idx on liga_partidos (equipo_local_id, equipo_visita_id);

-- RLS: lectura pública (para que la app/analítica pueda consultar con la
-- llave publicable), escritura solo con la service_role key (la usa
-- exclusivamente el scraper desde GitHub Actions, nunca el navegador).
alter table liga_equipos enable row level security;
alter table liga_jugadores enable row level security;
alter table liga_partidos enable row level security;
alter table liga_alineaciones enable row level security;
alter table liga_goles enable row level security;
alter table liga_tarjetas enable row level security;
alter table liga_sustituciones enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['liga_equipos','liga_jugadores','liga_partidos','liga_alineaciones','liga_goles','liga_tarjetas','liga_sustituciones'])
  loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (true)', t, t);
  end loop;
end $$;
