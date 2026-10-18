@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Twilight Audio - Local Storefront
echo ========================================

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js 20 or newer from https://nodejs.org/ then reopen this window.
  pause
  exit /b 1
)

for /f "tokens=1" %%v in ('node -p "Number(process.versions.node.split('.')[0])"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20 or newer is required. Current major version: %NODE_MAJOR%
  echo Install a newer version from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Dependencies are missing. Installing them now; this normally happens only once.
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed. Check your internet connection and Node.js installation.
    pause
    exit /b 1
  )
)

if not exist "node_modules\better-sqlite3\package.json" (
  echo SQLite dependency is missing. Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Starting website at http://localhost:3000 ...
call npm start
pause
