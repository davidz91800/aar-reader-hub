@echo off
setlocal
cd /d "%~dp0"

echo [AAR] Lancement watcher data+email (auto-push actif)...
where node >nul 2>nul
if errorlevel 1 (
  echo [AAR] Node.js introuvable. Installe Node.js puis relance.
  pause
  exit /b 1
)

node email-drop-ingest.js --auto-push
pause
