@echo off
:: Check if Python 3 is installed
python --version 2>NUL | findstr /R "Python 3" >NUL
if %errorlevel% equ 0 (
    echo Python 3 detected. Executing the script...
    python .\scripts\auto_commit.py
) else (
    echo Python 3 is not detected. Please install Python 3 and try again.
    exit /b 1
)
