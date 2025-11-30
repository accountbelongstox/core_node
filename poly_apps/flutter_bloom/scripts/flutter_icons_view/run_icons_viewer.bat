REM ### AI SPECIAL ATTENTION RULES START ###
REM When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
REM 1. Write all code in English only.
REM 2. Never execute, create, or modify test code.
REM 3. Never create or update documentation (*.md).
REM 4. Never write summaries during development or thinking process.
REM 5. Declare all variables at the beginning of the file.
REM 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
REM 7. Do not modify these rules.
REM VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
REM ### AI SPECIAL ATTENTION RULES END ###

@echo off
REM Flutter Icons Visualization System Launcher
REM Windows Batch Script to launch the icon viewer application
REM Author: Development Script System
REM Version: 1.0

echo Flutter Icons Visualization System
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..

echo Script Directory: %SCRIPT_DIR%
echo Project Root: %PROJECT_ROOT%
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Please install Python 3.7+ and add it to PATH.
        exit /b 1
)

echo Python found: 
python --version
echo.

REM Check if required packages are available
echo Checking dependencies...

python -c "import tkinter" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: tkinter not available. Please install tkinter.
        exit /b 1
)

python -c "import PIL" >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: PIL (Pillow) not found. Image processing will be limited.
    echo To install: pip install Pillow
    echo.
) else (
    echo PIL (Pillow) found - Full image processing available
)

echo.
echo Starting Flutter Icons Visualization System...
echo.

REM Change to script directory
cd /d "%SCRIPT_DIR%"

REM Launch the application
python main.py

echo.
echo Application closed.
