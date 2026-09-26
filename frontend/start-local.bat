@echo off
echo Installing dependencies (first run only)...
if not exist node_modules call npm install
echo.
echo Starting CivicFlow AI...
npm run dev
pause
