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
