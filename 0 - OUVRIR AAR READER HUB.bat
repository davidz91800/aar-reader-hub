@echo off
setlocal
cd /d "%~dp0"

echo.
echo [AAR Reader Hub] Lanceur simple
echo Double-clique ce fichier pour ouvrir l'application correctement.
echo.

call "%~dp0start-reader-server.bat"
