@echo off
title Fire Weather Alert Bot Setup
echo.
echo ========================================
echo   Fire Weather Alert Bot - Setup
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo https://nodejs.org/
    echo.
    echo Download the LTS version, install it, then run this again.
    echo.
    pause
    exit /b 1
)

echo Node.js found!
echo.

:: Get Discord Token
echo You need a Discord Bot Token.
echo Get one at: https://discord.com/developers/applications
echo (Create app ^> Bot ^> Reset Token ^> Copy)
echo.
set /p TOKEN="Paste your Discord Bot Token: "

:: Get Channel ID
echo.
echo You need a Discord Channel ID.
echo (Enable Developer Mode in Discord settings, then right-click channel ^> Copy ID)
echo.
set /p CHANNEL="Paste your Channel ID: "

:: Create .env file
echo.
echo Creating .env file...
echo DISCORD_TOKEN=%TOKEN%> .env
echo DISCORD_CHANNEL_ID=%CHANNEL%>> .env
echo Done!

:: Install dependencies
echo.
echo Installing dependencies (this may take a minute)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup complete!
echo ========================================
echo.
echo Starting the bot...
echo (Keep this window open - closing it stops the bot)
echo.
node index.js
pause
