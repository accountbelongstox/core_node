@echo off
set "CURRENT_DIR=%~dp0"
cd /d "%CURRENT_DIR%frontend"
yarn build
