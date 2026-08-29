-- Limpieza puntual de liga_jugadores: 3 registros con "nombre" vacío (el PDF
-- fuente de ANFP venía sin ese dato) y 2 de ellos habían generado un
-- duplicado "huérfano" (0 partidos jugados) porque el matcher de sub-21 no
-- pudo reconocerlos sin nombre. Verificado cruzando alineaciones/goles/
-- tarjetas/cambios real es antes de tocar nada — no se borró ningún jugador
-- con participación real.

-- 1) Cuadra (Deportes Temuco, id=239): nombre confirmado contra el plantel
--    propio del club ("Maximiliano Cuadra", dorsal 14). No tenía duplicado.
update liga_jugadores set nombre = 'Maximiliano' where id = 239;

-- 2) Barrera Castillo (Deportes Iquique, id=318) == BARRERA, BAYRON (id=495,
--    huérfano sin partidos, creado por el scraper de sub-21 al no poder
--    matchear "Bayron Barrera" contra un jugador con nombre vacío).
update liga_jugadores
  set nombre = 'Bayron', sub21 = true, minutos_oficial_temporada = 651
  where id = 318;
delete from liga_jugadores where id = 495;

-- 3) Avello Leal (Santiago Wanderers, id=431) == AVELLO, FABIANO (id=494,
--    mismo patrón que el caso anterior).
update liga_jugadores
  set nombre = 'Fabiano', sub21 = true, minutos_oficial_temporada = 0
  where id = 431;
delete from liga_jugadores where id = 494;

-- 4) Deportes Temuco, id=492: llegó desde la tabla sub-21 como "JUAN JOSÉ
--    GARRIDO MOLINA" y el split automático (última palabra = apellido) lo
--    partió al revés (apellido="MOLINA", nombre="JUAN JOSÉ GARRIDO"). NO lo
--    fusioné con el arquero suplente Garrido Parra (id=432, sí tiene 10
--    partidos): comparten "Juan José Garrido" pero el segundo apellido no
--    calza (Parra vs Molina) y no hay como confirmarlo con los datos
--    disponibles — probablemente sea el jugador nuevo que mencionaste. Si
--    confirmas que SÍ es la misma persona que Garrido Parra, avísame y hago
--    la fusión (reasignar sus eventos, si llega a tener, y borrar esta fila).
update liga_jugadores
  set apellido = 'Garrido Molina', nombre = 'Juan José'
  where id = 492;

-- 5) Rangers de Talca, id=493: "ROSALES, MARTÍN" tampoco tiene con quién
--    fusionarse en el plantel de Rangers (no hay otro "Rosales"). Se deja
--    como jugador aparte, solo se normaliza mayúsculas/tildes.
update liga_jugadores
  set apellido = 'Rosales', nombre = 'Martín'
  where id = 493;
