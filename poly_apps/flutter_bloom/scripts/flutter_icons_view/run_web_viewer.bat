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
