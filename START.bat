@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        Lost & Found Portal - Starting Services
echo ========================================================
echo.

:: 1. Verify Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please run INSTALL.bat first.
    pause
    exit /b 1
)

:: 2. Verify dependencies exist
if not exist "backend\node_modules\" (
    echo ERROR: dependencies not installed. Please run INSTALL.bat first.
    pause
    exit /b 1
)

:: 3. Verify env configuration
if not exist ".env" (
    echo ERROR: .env configuration file is missing. Please run INSTALL.bat first.
    pause
    exit /b 1
)

:: 4. Sync configuration file to backend folder
copy /y .env backend\.env >nul

:: 5. Stop any existing processes on port 5000 and 3000 to prevent EADDRINUSE
echo Cleaning up existing server instances...
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"

:: 6. Launch Backend Server in background
echo Starting Backend Server on port 5000...
start /b cmd /c "cd backend && node server.js"

:: 7. Launch Frontend Static Server in background
echo Starting Frontend Server on port 3000...
start /b cmd /c "node frontend/serve.js"

:: 8. Poll Backend API until it is healthy
echo Waiting for backend API to become active...
powershell -Command "for ($i=1; $i -le 15; $i++) { try { $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/test' -TimeoutSec 1; if ($r.message -eq 'API working') { exit 0 } } catch {} Start-Sleep -Seconds 1 }; exit 1"
if %errorlevel% neq 0 (
    echo ERROR: Backend failed to start or connect to database.
    echo Please run CHECK.bat to diagnose connectivity.
    pause
    exit /b 1
)

:: 9. Open default browser
echo Opening frontend in browser...
start http://localhost:3000

echo.
echo ========================================================
echo  LOST & FOUND PORTAL IS RUNNING!
echo  Frontend URL: http://localhost:3000
echo  Backend URL:  http://localhost:5000
echo.
echo  Keep this window open to view logs.
echo  To stop the application, close this window or run STOP.bat
echo ========================================================
echo.

:: Loop infinitely to keep process/window alive and showing background logs
:loop
timeout /t 5 >nul
goto loop
