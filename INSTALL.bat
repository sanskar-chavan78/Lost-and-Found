@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        Lost & Found Portal Setup & Installation
echo ========================================================
echo.

:: 1. Verify OS environment is Windows
if not "%OS%"=="Windows_NT" (
    echo ERROR: This setup script must be run under Windows NT.
    pause
    exit /b 1
)

:: 2. Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js was not found on this computer.
    echo Please download and install Node.js LTS from: https://nodejs.org/
    echo after installation, restart this terminal/setup script.
    pause
    exit /b 1
)

:: 3. Read Node.js version
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [PASS] Node.js is installed: %NODE_VER%

:: 4. Check npm installation
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm (Node Package Manager) was not found.
    echo Please make sure Node.js is correctly installed and added to the PATH.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [PASS] npm is installed: %NPM_VER%
echo.

:: 5. Verify package files exist
if not exist "backend\package.json" (
    echo ERROR: backend\package.json is missing. 
    echo Please ensure the project files are completely extracted.
    pause
    exit /b 1
)

:: 6. Handle .env configuration file
if not exist ".env" (
    echo Config file .env not found. Creating from template .env.example ...
    if exist ".env.example" (
        copy .env.example .env
        echo [WARN] A placeholder .env has been created. Please configure MONGODB_URI and JWT_SECRET in .env.
    ) else (
        echo ERROR: .env.example is missing. Cannot create .env configuration.
        pause
        exit /b 1
    )
) else (
    echo [PASS] Root .env configuration found.
)

:: 7. Create uploads folder
if not exist "backend\uploads" (
    echo Creating backend uploads directory ...
    mkdir "backend\uploads"
)
echo [PASS] Uploads directory verified.

:: 8. Install Backend dependencies
echo.
echo Installing backend dependencies...
cd backend

if exist "package-lock.json" (
    echo package-lock.json found. Running npm ci ...
    call npm ci
) else (
    echo Running npm install ...
    call npm install
)

if %errorlevel% neq 0 (
    echo ERROR: Dependency installation failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [PASS] Backend dependencies installed successfully.
echo.

:: 9. Sync config file to backend
echo Synchronizing config variables...
copy /y .env backend\.env >nul
echo [PASS] Configuration synchronized.
echo.

:: 10. Check if credentials are set
powershell -Command "$env_text = Get-Content -Path '.env' -Raw; if ($env_text -match 'YOUR_JWT_SECRET' -or $env_text -match 'YOUR_MONGODB_ATLAS_URI') { Write-Host '[WARN] Please edit the root .env file and set your actual JWT_SECRET and MONGODB_URI credentials before starting the server.' -ForegroundColor Yellow } else { Write-Host '[PASS] Environment configuration values look customized.' -ForegroundColor Green }"

echo.
echo ========================================================
echo  Installation Completed successfully!
echo  To start the application, double-click START.bat
echo ========================================================
pause
exit /b 0
