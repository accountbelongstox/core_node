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
echo Flutter Icons Web Visualization System
echo.

cd /d "%~dp0"

echo Checking Python availability...
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.7 or higher
        exit /b 1
)

echo.
echo Checking Flask installation...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Flask is not installed. Installing...
    pip install flask
    if errorlevel 1 (
        echo Error: Failed to install Flask
        echo Please run: pip install flask
                exit /b 1
    )
)

echo.
echo Checking PIL/Pillow installation...
python -c "from PIL import Image" >nul 2>&1
if errorlevel 1 (
    echo PIL/Pillow is not installed. Installing...
    pip install Pillow
    if errorlevel 1 (
        echo Warning: Failed to install Pillow
        echo Image processing will be limited
        echo You can install it manually with: pip install Pillow
    )
)

echo.
echo Starting Flutter Icons Web Visualization System...
echo Server will be available at: http://localhost:40017
echo.
echo Press Ctrl+C to stop the server
echo.

python web_main.py

echo.
echo Web server stopped.
