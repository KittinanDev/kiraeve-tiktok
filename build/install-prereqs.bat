@echo off
setlocal enabledelayedexpansion
title Kiraeve TikTok - Environment Setup
color 0A

:: Ensure script directory is working directory
cd /d "%~dp0"
set "APP_DIR=%~dp0"

echo ==========================================================
echo   Kiraeve TikTok - Automatic System Setup
echo ==========================================================
echo Target Directory: %APP_DIR%
echo Checking and installing required packages (Python, Node.js)...
echo Please keep this window open until setup completes.
echo.

:: ---------------------------------------------------------
:: 1. Check Python
:: ---------------------------------------------------------
echo [1/4] Checking Python 3.x...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   -^> Python is already installed:
    python --version
) else (
    echo   -^> Python not found. Installing via winget...
    winget install --id Python.Python.3.11 -e --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo   -^> winget failed or not available, downloading official Python installer...
        powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%TEMP%\python_installer.exe' -UseBasicParsing; Start-Process '%TEMP%\python_installer.exe' -ArgumentList '/quiet InstallAllUsers=1 PrependPath=1' -Wait; Remove-Item '%TEMP%\python_installer.exe' -Force"
    )
)

:: Refresh PATH from Registry for current CMD session
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

:: ---------------------------------------------------------
:: 2. Check Node.js
:: ---------------------------------------------------------
echo.
echo [2/4] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo   -^> Node.js is already installed:
    node -v
) else (
    echo   -^> Node.js not found. Installing via winget...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo   -^> winget failed or not available, downloading official Node.js installer...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\node_installer.msi' -UseBasicParsing; Start-Process msiexec.exe -ArgumentList '/i \"%TEMP%\node_installer.msi\" /qn' -Wait; Remove-Item '%TEMP%\node_installer.msi' -Force"
    )
)

:: Refresh PATH again
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

:: ---------------------------------------------------------
:: 3. Install Python Dependencies
:: ---------------------------------------------------------
echo.
echo [3/4] Installing Python requirements (TikTokLive, aiohttp, edge-tts, gTTS)...
if exist "requirements.txt" (
    python -m pip install --upgrade pip --no-warn-script-location
    python -m pip install -r requirements.txt --no-warn-script-location
) else (
    python -m pip install TikTokLive>=6.6.5 aiohttp>=3.9 edge-tts>=6.1.9 gTTS>=2.5.0 --no-warn-script-location
)

:: ---------------------------------------------------------
:: 4. Install Node.js TikTok Connector Package
:: ---------------------------------------------------------
echo.
echo [4/4] Installing Node.js module (tiktok-live-connector)...
cd /d "%APP_DIR%"
call npm install --save tiktok-live-connector --no-audit --no-fund

echo.
echo ==========================================================
echo   [SUCCESS] Setup Completed! You can now use Kiraeve TikTok.
echo ==========================================================
timeout /t 3
