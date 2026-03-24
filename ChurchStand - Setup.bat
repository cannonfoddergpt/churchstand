@echo off
title ChurchStand Setup
color 1F
cls

echo.
echo  ==========================================
echo    ChurchStand  ^|  First-time Setup
echo  ==========================================
echo.
echo  This will install dependencies and build
echo  the app. It only needs to run once.
echo.
echo  Press any key to continue, or close this
echo  window to cancel.
echo.
pause > nul

echo.
echo  [1/2] Installing packages...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed.
    echo  Make sure Node.js is installed: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo.
echo  [2/2] Building app...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed. See errors above.
    echo.
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo    Setup complete!
echo.
echo    You can now double-click:
echo    "ChurchStand - Start.bat"
echo    to launch the app each week.
echo  ==========================================
echo.
pause
