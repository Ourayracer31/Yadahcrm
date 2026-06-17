@echo off
REM Omni-Engine — ONE BUTTON (Windows: double-click this file).
cd /d "%~dp0"

echo Running the Omni-Engine for today...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed. Install it from https://nodejs.org (LTS), then double-click this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run - setting up (one minute)...
  call npm install --silent
)

node runner\src\daily.js --config config\omni.config.example.json

set BOARD=daily\travis-follow-up-board.md
if exist %BOARD% (
  echo.
  echo Opening today's board: %BOARD%
  start "" %BOARD%
)

echo.
echo Done. Read the board, make your calls.
pause
