@echo off
setlocal
cd /d "%~dp0"

echo [AAR] Lancement watcher email drop...
where node >nul 2>nul
if errorlevel 1 (
  echo [AAR] Node.js introuvable. Installe Node.js puis relance.
  pause
  exit /b 1
)

node email-drop-ingest.js
pause
