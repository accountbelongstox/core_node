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
:: Quick Flutter App Runner
:: Usage: runApp.bat [app_name]
:: Example: runApp.bat main
:: If no app name provided, shows selection menu

setlocal enabledelayedexpansion

:: Set console to UTF-8
chcp 65001 >nul

:: Get script directory and navigate to it
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Set window title
title Flutter App Runner

:: Check if PowerShell is available
where powershell.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available in PATH
    echo Please install PowerShell to use this app runner
        exit /b 1
)

:: Check if Flutter is available
where flutter.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Flutter is not available in PATH
    echo Please install Flutter and add it to your PATH
        exit /b 1
)

:: Execute app selector PowerShell script with parameters
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\appSelector.ps1" %*

:: Check exit code
if %errorlevel% neq 0 (
    echo.
    echo App runner exited with error code: %errorlevel%
    )

echo.
echo App runner session ended.

