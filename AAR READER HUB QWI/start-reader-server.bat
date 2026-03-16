@echo off
setlocal

set "APP_DIR=%~dp0"
for %%I in ("%APP_DIR%..\..") do set "ROOT_DIR=%%~fI"
set "APP_PATH=/E%%20-%%20AAR%%20READER%%20HUB/AAR%%20READER%%20HUB%%20QWI/index.html"
set "PORT=18081"
set "FALLBACK_PORT=18082"
set "URL=http://localhost:%PORT%%APP_PATH%"

echo.
echo [AAR Reader Hub QWI] Dossier APP : %APP_DIR%
echo [AAR Reader Hub QWI] Dossier ROOT: %ROOT_DIR%
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do set "PORT_BUSY_PID=%%P"
if not defined PORT_BUSY_PID goto :port_ok
echo [AAR Reader Hub QWI] Port %PORT% deja utilise (PID %PORT_BUSY_PID%).
set "PORT=%FALLBACK_PORT%"
set "URL=http://localhost:%PORT%%APP_PATH%"
echo [AAR Reader Hub QWI] Bascule automatique vers le port %PORT%.
:port_ok
echo [AAR Reader Hub QWI] URL : %URL%
echo.

python --version >nul 2>&1
if %errorlevel%==0 (
  echo [AAR Reader Hub QWI] Demarrage via: python -m http.server %PORT%
  start "AAR Reader Hub QWI Server (%PORT%)" cmd /k "cd /d ""%ROOT_DIR%"" && python -m http.server %PORT%"
  timeout /t 1 >nul
  start "" "%URL%"
  goto :eof
)

py --version >nul 2>&1
if %errorlevel%==0 (
  echo [AAR Reader Hub QWI] Demarrage via: py -m http.server %PORT%
  start "AAR Reader Hub QWI Server (%PORT%)" cmd /k "cd /d ""%ROOT_DIR%"" && py -m http.server %PORT%"
  timeout /t 1 >nul
  start "" "%URL%"
  goto :eof
)

echo [AAR Reader Hub QWI] Erreur: Python non trouve.
echo Installe Python puis relance ce fichier.
pause
