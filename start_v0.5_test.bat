@echo off
chcp 65001 > nul
cd /d %~dp0

echo Hero Civilization v0.5 Test Launcher

echo Checking dependencies...
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Starting game...
call npm run dev
pause
