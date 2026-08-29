-- Total OFICIAL de minutos sub-21 por equipo, tal como lo calcula ANFP
-- (fila "TOTAL CONTABLE" de la Tabla Oficial de Minutos Sub 21).
--
-- Por qué no alcanza con sumar liga_jugadores.minutos_oficial_temporada de
-- cada jugador: cuando un equipo tiene más de un sub-21 en cancha al mismo
-- tiempo, esa suma cuenta cada minuto una vez por jugador — sobrecuenta.
-- ANFP usa su propia regla con tope, y el resultado puede ser MUY distinto
-- (ej. Santiago Wanderers: suma de jugadores = 6.705, total oficial ANFP =
-- 2.468 — casi 3x de diferencia porque rotan varios sub-21 a la vez).

alter table liga_equipos add column if not exists sub21_minutos_contable int;
