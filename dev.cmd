@echo off
REM Start dev server without PowerShell execution-policy issues (uses npm.cmd).
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if not exist "node_modules\" (
  echo Running npm install...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
echo Starting Next.js dev server at http://localhost:3000
call npm.cmd run dev
