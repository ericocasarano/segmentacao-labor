@echo off
setlocal
cd /d "%~dp0"

set "PORT=8010"
set "URL=http://127.0.0.1:%PORT%/dashboard_segmentacao_simulacao.html"

where py >nul 2>nul
if %errorlevel%==0 (
  start "Servidor Dashboard Segmentacao" /min cmd /c "py -3 -m http.server %PORT%"
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "Servidor Dashboard Segmentacao" /min cmd /c "python -m http.server %PORT%"
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b
)

echo Python nao encontrado. Instale Python ou abra manualmente com um servidor local.
pause
