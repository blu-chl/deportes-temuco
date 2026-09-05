-- Los tipos personalizados que se agregan en Admin → Config → "Tipos de
-- gol" / "Tipos de asistencia" (agregarTipoGol/agregarTipoAsist en
-- index.html) vivían SOLO en un array de JS en memoria — se perdían apenas
-- alguien recargaba la página, porque nunca se guardaban en ningún lado.
-- Esta tabla los persiste para que sobrevivan a un refresh/redeploy.

create table if not exists liga_tipos_custom (
  id bigint generated always as identity primary key,
  categoria text not null check (categoria in ('gol', 'asistencia')),
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (categoria, nombre)
);

alter table liga_tipos_custom enable row level security;

drop policy if exists liga_tipos_custom_read on liga_tipos_custom;
create policy liga_tipos_custom_read on liga_tipos_custom for select using (true);

drop policy if exists liga_tipos_custom_write on liga_tipos_custom;
create policy liga_tipos_custom_write on liga_tipos_custom for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
