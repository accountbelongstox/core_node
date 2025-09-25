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
:: Flutter Multi-App Development System - Windows Entry Point
:: Author: Development Script System
:: Version: 1.0

setlocal enabledelayedexpansion

:: Set console to UTF-8
chcp 65001 >nul

:: Get script directory and navigate to it
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Set window title
title Flutter Multi-App Development System

:: Display banner
echo           Flutter Multi-App Development System(winStart.bat)
echo.
echo Starting PowerShell development environment...
echo.

:: Check if PowerShell is available
where powershell.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available in PATH
    echo Please install PowerShell to use this development system
        exit /b 1
)

:: Execute new app selector script
call "winStartNew.bat" %*

:: Fallback to original script if needed
:: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\startDevByWin.ps1"

:: Check exit code
if %errorlevel% neq 0 (
    echo.
    echo PowerShell script exited with error code: %errorlevel%
    echo Please check the error messages above
    )

:: End of script
echo.
echo Development system session ended.

