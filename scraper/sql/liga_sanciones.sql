-- Descuentos de puntos por sanciones administrativas (incumplimientos,
-- inhabilitados, etc. — cosas fuera de la cancha, no eventos de un partido).
-- Se aplican en la tabla de posiciones de la app y del bot de Telegram.
-- Lectura pública, escritura solo para usuarios autenticados (Admin).

create table if not exists liga_sanciones (
  id bigint generated always as identity primary key,
  equipo_id bigint not null references liga_equipos(id) on delete cascade,
  puntos int not null check (puntos > 0), -- puntos a DESCONTAR (siempre positivo, se resta en la tabla)
  motivo text not null,
  fecha date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists liga_sanciones_equipo_idx on liga_sanciones (equipo_id);

alter table liga_sanciones enable row level security;

drop policy if exists liga_sanciones_read on liga_sanciones;
create policy liga_sanciones_read on liga_sanciones for select using (true);

drop policy if exists liga_sanciones_write on liga_sanciones;
create policy liga_sanciones_write on liga_sanciones for insert
  with check (auth.role() = 'authenticated');

drop policy if exists liga_sanciones_delete on liga_sanciones;
create policy liga_sanciones_delete on liga_sanciones for delete
  using (auth.role() = 'authenticated');
