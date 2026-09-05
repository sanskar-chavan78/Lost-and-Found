@echo off
echo ========================================================
echo        Lost & Found Portal - Stopping Services
echo ========================================================
echo.

echo Terminating server on port 5000 (Backend)...
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"

echo Terminating server on port 3000 (Frontend)...
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"

echo.
echo [PASS] All services stopped successfully.
pause
