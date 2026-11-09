@echo off
REM One-click start for the game.
REM
REM Runs serve.py, the dev server that sends no-store headers, so a module you edit is
REM picked up on reload instead of being served from the browser's cache — which is what
REM turned the page blank white when a fresh importer met a stale module.
REM
REM Needs Python 3 on PATH. Close the minimised "Driftwood server" window to stop it.
setlocal
cd /d "%~dp0"

REM Already running? Just open the page and leave the existing server alone.
netstat -ano | findstr /r /c:":8123 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo Server already running on port 8123.
  start "" "http://127.0.0.1:8123/index.html"
  exit /b 0
)

set "PY=python"
where python >nul 2>nul || set "PY=py -3"
%PY% --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python 3 is required and was not found on PATH.
  echo Install Python, or run "python serve.py 8123" in a terminal that has it.
  echo.
  pause
  exit /b 1
)

echo Starting the game server on http://127.0.0.1:8123 ...
start "Driftwood server" /min %PY% serve.py 8123
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8123/index.html"
