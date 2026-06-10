@echo off
title Attendance Hub Server
color 0A
cd /d "%~dp0server"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js required: https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  ATTENDANCE HUB - Starting...
echo  Keep this window OPEN.
echo.

start "" cmd /c "powershell -NoProfile -Command \"$u='http://localhost:3001/api/health'; for($i=0;$i -lt 45;$i++){ try { $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process 'http://localhost:3001'; Start-Process 'http://localhost:3001/admin'; exit 0 } } catch {}; Start-Sleep -Seconds 1 }; Start-Process 'http://localhost:3001'\""

node src\index.js
pause