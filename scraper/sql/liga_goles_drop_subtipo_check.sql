-- Config → Tipos de gol / Tipos de asistencia ahora maneja la MISMA lista
-- que usa Enriquecer (antes eran dos listas separadas — por eso agregar
-- un tipo en Config no aparecía en Enriquecer). Como esa lista ahora
-- puede crecer desde la app sin tocar el código, el CHECK constraint que
-- limitaba subtipo/asist_subtipo a un set fijo en la base queda obsoleto
-- y hay que sacarlo — si no, guardar un tipo nuevo agregado en Config
-- fallaría porque la base lo rechaza.

alter table liga_goles drop constraint if exists liga_goles_subtipo_check;
alter table liga_goles drop constraint if exists liga_goles_asist_subtipo_check;
