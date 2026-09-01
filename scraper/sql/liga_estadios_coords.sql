-- Coordenadas por estadio, para poder pedir el clima histórico del día del
-- partido (Open-Meteo Archive API necesita lat/lon). Se cargan a mano desde
-- Admin → Enriquecer → 🏟️ Fotos de estadios, igual que la foto — ya no se
-- pueden sacar del scraper porque ANFP no publica coordenadas, solo el
-- nombre del recinto.

alter table liga_estadios add column if not exists lat double precision;
alter table liga_estadios add column if not exists lon double precision;
