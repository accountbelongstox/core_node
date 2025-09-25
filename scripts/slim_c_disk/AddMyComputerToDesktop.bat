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
:: Display menu options
cls
echo Select an action:
echo.
echo 1. Show My Computer on Desktop
echo 2. Add Feature
echo 3. Exit
echo.

:: Prompt for user input
set /p choice=Enter your choice (1, 2, or 3): 

:: Execute actions based on user choice
if "%choice%"=="1" goto ShowMyComputer
if "%choice%"=="2" goto AddFeature
if "%choice%"=="3" exit

:ShowMyComputer
:: Call PowerShell to add My Computer to the desktop
powershell -Command "& { Add-MyComputerToDesktop }"
goto End

:AddFeature
:: Call PowerShell to display feature message
powershell -Command "& { Add-Feature }"
goto End

:End
pause
