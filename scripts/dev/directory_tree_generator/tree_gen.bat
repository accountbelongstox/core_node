@echo off
setlocal enabledelayedexpansion

REM Get current script directory
set "SCRIPT_DIR=%~dp0"
set "PYTHON_SCRIPT=%SCRIPT_DIR%tree_generator.py"

REM Check if Python script exists
if not exist "%PYTHON_SCRIPT%" (
    echo Error: Python script not found: %PYTHON_SCRIPT%
    exit /b 1
)

REM Execute Python script with all arguments
python "%PYTHON_SCRIPT%" %*

REM Check execution result
if %ERRORLEVEL% neq 0 (
    echo Error: Script execution failed
    exit /b %ERRORLEVEL%
)

echo.
echo Tree generation completed successfully.
