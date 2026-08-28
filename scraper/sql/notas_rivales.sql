-- Notas de scouting por rival (pestaña "Rivales" de la app). Lectura
-- pública, escritura solo para usuarios autenticados (cuerpo técnico
-- logueado en la pestaña Admin).

create table if not exists liga_notas_rivales (
  id bigint generated always as identity primary key,
  equipo_id bigint not null references liga_equipos(id) on delete cascade,
  texto text not null,
  autor text,
  created_at timestamptz default now()
);

create index if not exists liga_notas_rivales_equipo_idx on liga_notas_rivales (equipo_id);

alter table liga_notas_rivales enable row level security;

drop policy if exists liga_notas_rivales_read on liga_notas_rivales;
create policy liga_notas_rivales_read on liga_notas_rivales for select using (true);

drop policy if exists liga_notas_rivales_write on liga_notas_rivales;
create policy liga_notas_rivales_write on liga_notas_rivales for insert
  with check (auth.role() = 'authenticated');

drop policy if exists liga_notas_rivales_delete on liga_notas_rivales;
create policy liga_notas_rivales_delete on liga_notas_rivales for delete
  using (auth.role() = 'authenticated');
