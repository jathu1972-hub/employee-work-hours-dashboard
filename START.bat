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

start "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3001 & start http://localhost:3001/admin"

node src\index.js
pause