@echo off
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

REM Flutter Bloom Dev Debug Quick Start
REM PARAMETERS: PROHIBITED - No parameters allowed for consistency and reliability

echo.
echo ========================================
echo Flutter Bloom Dev Debug Quick Start
echo ========================================
echo.
echo This will launch the dev debug main script directly.
echo Make sure you have run start.ps1 at least once to set your preferences.
echo.
pause

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "main.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Script execution failed with exit code: %ERRORLEVEL%
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Dev debug completed successfully
pause