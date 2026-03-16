@echo off
setlocal

cd /d "%~dp0"
set "PORT=8080"
set "FALLBACK_PORT=18080"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo [AAR Reader Hub] Dossier : %CD%
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr "LISTENING"') do set "PORT_BUSY_PID=%%P"
if not defined PORT_BUSY_PID goto :port_ok
echo [AAR Reader Hub] Port %PORT% deja utilise (PID %PORT_BUSY_PID%).
set "PORT=%FALLBACK_PORT%"
set "URL=http://localhost:%PORT%/index.html"
echo [AAR Reader Hub] Bascule automatique vers le port %PORT%.
:port_ok
echo [AAR Reader Hub] URL : %URL%
echo.

python --version >nul 2>&1
if %errorlevel%==0 (
  echo [AAR Reader Hub] Demarrage via: python -m http.server %PORT%
  start "AAR Reader Hub Server (%PORT%)" cmd /k "cd /d ""%~dp0"" && python -m http.server %PORT%"
  timeout /t 1 >nul
  start "" "%URL%"
  goto :eof
)

py --version >nul 2>&1
if %errorlevel%==0 (
  echo [AAR Reader Hub] Demarrage via: py -m http.server %PORT%
  start "AAR Reader Hub Server (%PORT%)" cmd /k "cd /d ""%~dp0"" && py -m http.server %PORT%"
  timeout /t 1 >nul
  start "" "%URL%"
  goto :eof
)

echo [AAR Reader Hub] Erreur: Python non trouve.
echo Installe Python puis relance ce fichier.
pause
