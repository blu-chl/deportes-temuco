-- Uniformes por equipo, guardados como COLORES (no como imágenes): la
-- camiseta se dibuja en SVG en la app (ver camisetaSvg en index.html).
-- Así no depende de que un archivo externo siga existiendo, se ve nítida
-- en cualquier tamaño y se corrige desde Admin cuando un club estrena
-- camiseta.
--
-- Cada equipo tiene dos filas: 'local' y 'visita'. En cada partido se
-- muestra la que corresponde a la condición de ese equipo.

create table if not exists liga_uniformes (
  equipo_id bigint not null references liga_equipos(id) on delete cascade,
  tipo text not null check (tipo in ('local', 'visita')),
  patron text not null default 'liso'
    check (patron in ('liso', 'rayas', 'bandas', 'franja', 'mitades')),
  camiseta text not null default '#ffffff',
  detalle text,
  mangas text,
  short text,
  medias text,
  primary key (equipo_id, tipo)
);

alter table liga_uniformes enable row level security;

drop policy if exists liga_uniformes_read on liga_uniformes;
create policy liga_uniformes_read on liga_uniformes for select using (true);

drop policy if exists liga_uniformes_write on liga_uniformes;
create policy liga_uniformes_write on liga_uniformes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Punto de partida con los colores TRADICIONALES de cada club, para no
-- tener que cargar 32 filas a mano. Son los históricos, no la camiseta
-- 2026 exacta: hay que verificarlos contra Wikipedia desde
-- Admin → Enriquecer → Uniformes y corregir lo que haya cambiado.
--
-- Los clubes que NO están acá quedaron fuera a propósito: no tengo certeza
-- de sus colores y prefiero que aparezcan vacíos en el admin antes que
-- pintarlos mal. Se cargan a mano igual, desde la misma pantalla.
insert into liga_uniformes (equipo_id, tipo, patron, camiseta, detalle, mangas, short, medias)
select e.id, v.tipo, v.patron, v.camiseta, v.detalle, v.mangas, v.short, v.medias
from (values
  ('Cobreloa',           'local',  'liso',   '#f47b20', '#ffffff', '#f47b20', '#f47b20', '#f47b20'),
  ('Cobreloa',           'visita', 'liso',   '#ffffff', '#f47b20', '#ffffff', '#ffffff', '#ffffff'),
  ('Rangers de Talca',   'local',  'rayas',  '#000000', '#d32b2b', '#000000', '#000000', '#000000'),
  ('Rangers de Talca',   'visita', 'liso',   '#ffffff', '#d32b2b', '#ffffff', '#000000', '#ffffff'),
  ('Unión Española',     'local',  'liso',   '#d0231f', '#ffffff', '#d0231f', '#d0231f', '#d0231f'),
  ('Unión Española',     'visita', 'liso',   '#ffffff', '#d0231f', '#ffffff', '#ffffff', '#ffffff'),
  ('Santiago Wanderers', 'local',  'liso',   '#0f7b4a', '#ffffff', '#0f7b4a', '#ffffff', '#0f7b4a'),
  ('Santiago Wanderers', 'visita', 'liso',   '#ffffff', '#0f7b4a', '#ffffff', '#ffffff', '#ffffff'),
  ('San Luis',           'local',  'liso',   '#f2c313', '#000000', '#f2c313', '#000000', '#f2c313'),
  ('San Luis',           'visita', 'liso',   '#1b1b1b', '#f2c313', '#1b1b1b', '#1b1b1b', '#1b1b1b'),
  ('Deportes Iquique',   'local',  'liso',   '#4aa3dd', '#ffffff', '#4aa3dd', '#ffffff', '#4aa3dd'),
  ('Deportes Iquique',   'visita', 'liso',   '#ffffff', '#4aa3dd', '#ffffff', '#ffffff', '#ffffff'),
  ('Deportes Copiapó',   'local',  'liso',   '#5b2d8e', '#ffffff', '#5b2d8e', '#5b2d8e', '#5b2d8e'),
  ('Deportes Copiapó',   'visita', 'liso',   '#ffffff', '#5b2d8e', '#ffffff', '#ffffff', '#ffffff'),
  ('Deportes Antofagasta','local', 'liso',   '#6cb9e8', '#ffffff', '#6cb9e8', '#ffffff', '#6cb9e8'),
  ('Deportes Antofagasta','visita','liso',   '#123a63', '#6cb9e8', '#123a63', '#123a63', '#123a63'),
  ('Magallanes',         'local',  'liso',   '#7fc4e8', '#ffffff', '#7fc4e8', '#ffffff', '#7fc4e8'),
  ('Magallanes',         'visita', 'liso',   '#ffffff', '#7fc4e8', '#ffffff', '#ffffff', '#ffffff'),
  ('Deportes Temuco',    'local',  'liso',   '#0f8a44', '#ffffff', '#0f8a44', '#ffffff', '#0f8a44'),
  ('Deportes Temuco',    'visita', 'liso',   '#ffffff', '#0f8a44', '#ffffff', '#ffffff', '#ffffff')
) as v(equipo, tipo, patron, camiseta, detalle, mangas, short, medias)
join liga_equipos e on e.nombre = v.equipo
on conflict (equipo_id, tipo) do nothing;
