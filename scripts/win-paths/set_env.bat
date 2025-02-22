@echo off
setlocal

REM Get the directory path of the current script
set "script_dir=%~dp0"

REM Construct the full path to the set_env.js file
set "set_env_file=%script_dir%set_env.js"

REM Check if the set_env.js file exists
if not exist "%set_env_file%" (
    echo "set_env.js" file does not exist. Please verify.
    exit /b
)


REM Checking if enough arguments are provided
if "%~1"=="" (
    echo Please provide enough arguments.
    exit /b
)

REM Checking if the first argument is supported
set "action=%~1"
if "%action%" neq "add" if "%action%" neq "remove" if "%action%" neq "is" if "%action%" neq "show" (
    echo  "add", "remove", "is", "show".
    exit /b
)
 
REM If the second argument is "add", "remove", or "is", then checking if the third argument is provided
if "%action%"=="add" if "%~2"=="" (
    echo The Path argument cannot be empty.
    exit /b
)
if "%action%"=="remove" if "%~2"=="" (
    echo The Path argument cannot be empty.
    exit /b
)
if "%action%"=="is" if "%~2"=="" (
    echo The Path argument cannot be empty.
    exit /b
)

if "%~3"=="" (
    set "node=node"
) else (
    set "node=%~3"
)

%node% "%set_env_file%" "%action%" "%~2"

endlocal
