@echo off
setlocal
cd /d "%~dp0"

echo [AAR] Rebuild index...
where node >nul 2>nul
if errorlevel 1 (
  echo [AAR] Node.js introuvable.
  pause
  exit /b 1
)
node email-drop-ingest.js --once

echo [AAR] Git add data...
git add "AAR Reader Data/*.json" "AAR Reader Data/index.json"

git diff --cached --quiet
if %errorlevel%==0 (
  echo [AAR] Aucun changement a publier.
  pause
  exit /b 0
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm:ss\""') do set TS=%%i
echo [AAR] Commit...
git commit -m "Publish Reader data %TS%"

echo [AAR] Push...
git push

echo [AAR] Publication terminee.
pause
