@echo off
cd /d %~dp0\..\..\

echo Checking and installing system dependencies...
where gcc >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Please install build tools manually:
    echo For Windows, install Visual Studio Build Tools or MinGW
    pause
)

echo Installing Node.js dependencies...
yarn add express sequelize sqlite3 bcrypt jsonwebtoken handlebars chalk envalid

echo Installing dev dependencies...
yarn add -D nodemon jest

echo Dependencies installation completed!
pause 