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

:: Get current Path environment variable
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path ^| find "REG_SZ"') do (
    set "currentPath=%%B"
)

:: Backup the current Path to a reg file
for /f "delims=" %%a in ('wmic os get LocalDateTime ^| find "."') do set datetime=%%a
set "year=%datetime:~0,4%"
set "month=%datetime:~4,2%"
set "day=%datetime:~6,2%"
set "hour=%datetime:~8,2%"
set "minute=%datetime:~10,2%"
set "second=%datetime:~12,2%"
set "timestamp=%year%%month%%day%_%hour%%minute%%second%"
:: echo !currentPath! >> "environment_path_!timestamp!.bak"

:: Add the provided path to the environment variable
set "newPath=%~1"

:: Check if the provided path is already in the Path
echo !currentPath! | find /i "%newPath%" > nul
if errorlevel 1 (
    echo %newPath% is not in the Path.
    set "addPath=!currentPath!;%newPath%"
    if not "!addPath!"=="" (
        echo Adding !addPath! to the Path...
        :: Use reg add to modify the PATH variable
        reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path /t REG_SZ /d "!addPath!" /f
        echo Path updated successfully.
    ) else (
        echo The provided path is empty. Please provide a valid path.
    )
) else (
    echo Path:
    echo !currentPath!
    echo %newPath% is already in the Path.
)

endlocal
