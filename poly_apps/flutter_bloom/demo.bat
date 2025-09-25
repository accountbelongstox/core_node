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
:: Demo script to show app scanner functionality
:: This script demonstrates the app detection without actually running Flutter

setlocal enabledelayedexpansion

:: Set console to UTF-8
chcp 65001 >nul

:: Get script directory and navigate to it
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Set window title
title Flutter App Scanner Demo

echo           Flutter App Scanner Demo
echo.
echo This demo shows the app detection functionality
echo without actually starting Flutter apps.
echo.

:: Check if PowerShell is available
where powershell.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available in PATH
        exit /b 1
)

echo Running app scanner test...
echo.

:: Run test scripts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\testAppScanner.ps1"

echo.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\testMenu.ps1"

echo.
echo Demo completed!
echo.
echo To actually run apps, use:
echo   runApp.bat           (interactive mode)
echo   runApp.bat main      (run main app directly)
echo   runApp.bat achat     (run achat app directly)
echo.

