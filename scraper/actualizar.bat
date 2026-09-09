@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Actualizar datos - Deportes Temuco

echo ==========================================
echo   Actualizando datos de la liga
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] No encontre Node.js en este computador.
  echo     Instalalo desde https://nodejs.org  ^(version LTS^) y vuelve a
  echo     ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [X] Falta el archivo .env con las llaves de Supabase.
  echo     Copia  .env.example  como  .env  y pega ahi tus dos llaves.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias ^(solo la primera vez, demora un poco^)...
  call npm install
  echo.
)

REM Los tres pasos corren siempre, aunque uno falle: son independientes y
REM es mejor que se actualice lo que se pueda a que se corte todo.
echo [1/3] Partidos, goles, tarjetas y minutaje...
call node scrape.mjs
echo.

echo [2/3] Tabla oficial de minutos sub-21...
call node scrapeU21.mjs
echo.

echo [3/3] Vinculando el plantel propio...
call node link-jugadores.mjs
echo.

echo ==========================================
echo   Listo. Ya puedes cerrar esta ventana.
echo ==========================================
pause
