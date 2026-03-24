@echo off
title ChurchStand
color 1F
cls

echo.
echo  ==========================================
echo    ChurchStand  ^|  Worship Band Assistant
echo  ==========================================
echo.

REM Check the app has been built
if not exist "dist\index.html" (
    echo  [!] App not built yet.
    echo.
    echo  Please run "ChurchStand - Setup.bat" first.
    echo.
    pause
    exit /b 1
)

REM Check Node.js is available
where node > nul 2>&1
if errorlevel 1 (
    echo  [!] Node.js is not installed.
    echo.
    echo  Download it from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Starting server...
echo.

REM Open the director view in the browser after a 3-second delay (background)
start /b cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:5000/director"

REM Run the server in this window (blocks until closed)
REM Closing the window = stopping the server
call npm start

echo.
echo  ChurchStand has stopped.
echo  Press any key to close this window.
pause > nul
