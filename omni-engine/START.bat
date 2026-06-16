@echo off
REM Omni-Engine — START HERE (Windows: double-click this file).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org (LTS), then double-click this again.
  pause
  exit /b 1
)
node tools\quickstart.js
set BOARD=daily\travis-follow-up-board.md
if exist %BOARD% start "" %BOARD%
pause
