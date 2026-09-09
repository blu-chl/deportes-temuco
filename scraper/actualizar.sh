#!/usr/bin/env bash
# Misma rutina que actualizar.bat, para macOS y Linux.
cd "$(dirname "$0")" || exit 1

echo "=========================================="
echo "  Actualizando datos de la liga"
echo "=========================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[X] No encontré Node.js. Instálalo desde https://nodejs.org (versión LTS)."
  exit 1
fi

if [ ! -f .env ]; then
  echo "[X] Falta el archivo .env con las llaves de Supabase."
  echo "    Copia .env.example como .env y pega ahí tus dos llaves."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Instalando dependencias (solo la primera vez, demora un poco)..."
  npm install
  echo
fi

# Los tres pasos corren siempre, aunque uno falle: son independientes y es
# mejor que se actualice lo que se pueda a que se corte todo.
echo "[1/3] Partidos, goles, tarjetas y minutaje..."
node scrape.mjs || true
echo

echo "[2/3] Tabla oficial de minutos sub-21..."
node scrapeU21.mjs || true
echo

echo "[3/3] Vinculando el plantel propio..."
node link-jugadores.mjs || true
echo

echo "=========================================="
echo "  Listo."
echo "=========================================="
