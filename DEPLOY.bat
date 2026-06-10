@echo off
title Deploy Attendance Hub to Netlify
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Deploy Attendance Hub to Netlify
echo  ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org
  pause
  exit /b 1
)

echo Step 1: Installing dependencies...
call npm.cmd install
call npm.cmd install --prefix server

echo.
echo Step 2: Netlify login (browser will open)...
call npx.cmd netlify login

echo.
echo Step 3: Link site (first time only)...
call npx.cmd netlify init

echo.
echo Step 4: Deploy to production...
call npx.cmd netlify deploy --prod

echo.
echo Done! Your site URL will appear above.
pause