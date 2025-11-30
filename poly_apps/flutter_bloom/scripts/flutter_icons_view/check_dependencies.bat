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
REM Flutter Icons Visualization System - Dependencies Checker
REM Checks required Python packages and provides installation commands
REM Author: Development Script System
REM Version: 1.0

echo Flutter Icons Visualization System
echo Dependencies Checker
echo.

echo Checking Python and required packages...
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found!
    echo Please install Python 3.7+ from https://python.org
    echo Make sure to add Python to PATH during installation.
    echo.
        exit /b 1
)

echo [OK] Python found:
python --version
echo.

REM Check tkinter (usually included with Python)
echo Checking tkinter...
python -c "import tkinter; print('tkinter version:', tkinter.TkVersion)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] tkinter not available
    echo tkinter is usually included with Python. Try reinstalling Python.
    echo.
) else (
    echo [OK] tkinter available
)

REM Check PIL/Pillow
echo Checking PIL/Pillow...
python -c "import PIL; print('Pillow version:', PIL.__version__)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [MISSING] PIL/Pillow not found
    echo.
    echo To install Pillow (recommended for full functionality):
    echo pip install Pillow
    echo.
    echo Or copy this command:
    echo.
    echo pip install Pillow
    echo.
) else (
    echo [OK] PIL/Pillow available:
    python -c "import PIL; print('Pillow version:', PIL.__version__)"
)

echo.
echo Package Installation Commands
echo.
echo If you need to install missing packages, use these commands:
echo.
echo 1. Install Pillow (image processing - RECOMMENDED):
echo    pip install Pillow
echo.
echo 2. If pip is not working, try:
echo    python -m pip install Pillow
echo.
echo 3. For virtual environment users:
echo    conda install Pillow
echo    OR
echo    pipenv install Pillow
echo.
echo System Information
echo.
echo Python location:
where python 2>nul
echo.
echo Python executable:
python -c "import sys; print(sys.executable)"
echo.
echo Python path:
python -c "import sys; print('\n'.join(sys.path))"
echo.
echo Note: PIL/Pillow is optional but recommended for:
echo - Image compression and optimization
echo - Smart resizing and cropping
echo - Format conversion (PNG/JPEG)
echo - Advanced image analysis
echo.
echo The system will work without Pillow but with limited functionality.
echo.
