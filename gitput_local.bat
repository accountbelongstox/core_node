@echo off
SETLOCAL EnableDelayedExpansion
set new_remote=ssh://git@git.local.12gm.com:17003/adminroot/core_node.git

REM Function to get the current timestamp
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do (
  set "DEL=%%a"
)
for /f "delims=" %%a in ('wmic OS Get localdatetime ^| find "."') do set datetime=%%a
set "year=%datetime:~0,4%"
set "month=%datetime:~4,2%"
set "day=%datetime:~6,2%"
set "hour=%datetime:~8,2%"
set "minute=%datetime:~10,2%"
set "second=%datetime:~12,2%"
set "timestamp=%year%-%month%-%day%@%hour%-%minute%-%second%"
set "core_node_dir=%~dp0core_node\"

call :ColorText 0a "-------------------"
echo.
call :ColorText 0C "Submit_github"
echo.
call :ColorText 0b "-------------------"
echo.
call :ColorText 19 "-------------------"
echo.
call :ColorText 2F "%timestamp%"
echo.
call :ColorText 4e "-------------------"
echo.

REM Get the current remote URL and back it up
for /f "tokens=2" %%i in ('git remote get-url origin') do set original_remote=%%i
call :ColorText 0a "Current remote URL: %original_remote%"
echo.
call :ColorText 0a "Backing up the current remote URL..."
echo.

REM Set the new remote URL to the given one
call :ColorText 0C "Setting new remote URL: %new_remote%"
git remote set-url origin %new_remote%
echo.
git remote -v
call :ColorText 0a "--------------------------------"
echo.

:process_directory
REM Function to process the directory
set "current_dir=%cd%"
echo.
call :ColorText 0a "Entering--"
echo %current_dir%
call :ColorText 0a "--------------------------------"
echo.

REM Verify if the 'main' branch exists, if not, create it
set branch_exists=false
for /f %%i in ('git branch -r ^| findstr /r /c:"origin/main"') do (
    set branch_exists=true
)
if /i "!branch_exists!" == "false" (
    call :ColorText 0C "Branch 'main' does not exist. Creating 'main' branch..."
    echo.
    git checkout -b main
    git push --set-upstream origin main
    git branch --set-upstream-to=origin/main main
    git pull origin main
    echo.
)

git remote -v
call :ColorText 0a "--------------------------------"
echo.
echo.
echo.
call :ColorText 2F "----------------------------------------------------------------"
echo.

REM Commands to commit and push changes
git add .
git commit -m "%timestamp%"
git pull
git add .
git commit -m "%timestamp%"
git push --set-upstream origin main
echo.
call :ColorText 19 "----------------------------------------------------------------"
echo.
echo.



REM Process core_node directory if it exists
if exist "%core_node_dir%" (
    cd /d "%core_node_dir%"
    call :process_directory
)

goto :eof

:ColorText
<nul set /p ".=%DEL%" > "%~2"
findstr /v /a:%1 /R "^$" "%~2" nul
del "%~2"
