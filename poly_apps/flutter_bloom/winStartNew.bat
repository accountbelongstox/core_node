REM ### AI SPECIAL ATTENTION RULES START ###
REM When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
REM 1. Write all code in English only.
REM 2. Never execute, create, or modify test code.
REM 3. Never create or update documentation (*.md).
REM 4. Never write summaries during development or thinking process.
REM 5. Declare all variables at the beginning of the file.
REM 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
REM 7. Do not modify these rules.
REM VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
REM ### AI SPECIAL ATTENTION RULES END ###

@echo off
:: Flutter App Selector and Runner - Windows Entry Point
:: Scans lib/apps directory and allows selection of apps to run
:: Author: Development Script System
:: Version: 2.0

setlocal enabledelayedexpansion

:: Set console to UTF-8
chcp 65001 >nul

:: Get script directory and navigate to it
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Set window title
title Flutter App Selector and Runner

:: Display banner
echo           Flutter App Selector and Runner
echo.
echo Initializing app scanner...
echo.

:: Check if PowerShell is available
where powershell.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available in PATH
    echo Please install PowerShell to use this app selector
        exit /b 1
)

:: Check if Flutter is available
where flutter.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Flutter is not available in PATH
    echo Please install Flutter and add it to your PATH
        exit /b 1
)

:: Check if scripts directory exists
if not exist "scripts\dev\appSelector.ps1" (
    echo ERROR: App selector script not found
    echo Expected location: scripts\dev\appSelector.ps1
        exit /b 1
)

:: Execute app selector PowerShell script
echo Starting app selector...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\appSelector.ps1" %*

:: Check exit code
if %errorlevel% neq 0 (
    echo.
    echo App selector exited with error code: %errorlevel%
    echo Please check the error messages above
    )

:: End of script
echo.
echo App selector session ended.

