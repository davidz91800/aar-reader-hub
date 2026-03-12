@echo off
setlocal

cd /d "%~dp0"
set "PORT=8080"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo [AAR Reader Hub] Dossier: %CD%
echo [AAR Reader Hub] URL: %URL%
echo.

start "" "%URL%"

python --version >nul 2>&1
if %errorlevel%==0 (
  echo [AAR Reader Hub] Demarrage via: python -m http.server %PORT%
  python -m http.server %PORT%
  goto :eof
)

py --version >nul 2>&1
if %errorlevel%==0 (
  echo [AAR Reader Hub] Demarrage via: py -m http.server %PORT%
  py -m http.server %PORT%
  goto :eof
)

echo [AAR Reader Hub] Erreur: Python non trouve.
echo Installe Python puis relance ce fichier.
pause
