-- Índices que faltaban para los filtros que la app usa de verdad.
--
-- liga_schema.sql ya indexó partido_id y jugador_id en las tablas de
-- eventos, pero la app casi nunca filtra por partido: filtra por EQUIPO
-- (?equipo_id=eq.<id>) — Estadísticas, Próximo rival, Enriquecer,
-- Jugadores clave y Análisis, todas. Esa columna no tenía índice en
-- ninguna tabla.
--
-- Nota honesta de tamaño: hoy la tabla más grande (liga_alineaciones)
-- tiene ~6.200 filas, así que Postgres las recorre enteras en
-- milisegundos y la ganancia inmediata es chica. Esto es barato y es
-- para que no se degrade cuando la temporada se llene y se acumulen
-- temporadas siguientes.

-- El filtro más frecuente de toda la app: goles de un equipo, sin autogoles.
create index if not exists liga_goles_equipo_idx on liga_goles (equipo_id, autogol);

-- Asistencias: se filtra asistidor_id=not.is.null y se agrupa por asistidor.
create index if not exists liga_goles_asistidor_idx on liga_goles (asistidor_id)
  where asistidor_id is not null;

create index if not exists liga_tarjetas_equipo_idx on liga_tarjetas (equipo_id);
create index if not exists liga_alineaciones_equipo_idx on liga_alineaciones (equipo_id);
create index if not exists liga_sustituciones_equipo_idx on liga_sustituciones (equipo_id);

-- Plantilla de un equipo: se pide en casi todas las pantallas.
create index if not exists liga_jugadores_equipo_idx on liga_jugadores (equipo_id);

-- Calendario: order=fecha_hora en fixture, próximo rival y último partido.
create index if not exists liga_partidos_fecha_idx on liga_partidos (fecha_hora);
