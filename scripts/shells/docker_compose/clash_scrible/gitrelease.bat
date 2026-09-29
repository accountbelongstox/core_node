@echo off
SETLOCAL EnableDelayedExpansion

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

REM Ask for confirmation before committing and tagging
set /p confirm_commit=Do you want to commit and create a new tag for release? (yes/no):
if /i "%confirm_commit%" neq "yes" (
    call :ColorText 0C "Commit and release canceled by user."
    goto :eof
)

REM Commands to commit and push changes
git add .
git commit -m "%timestamp%"
git pull
git add .
git commit -m "%timestamp%"
git push --set-upstream origin main

REM Ask for tag creation
set /p confirm_tag=Do you want to create a new tag for release? (yes/no):
if /i "%confirm_tag%" neq "yes" (
    call :ColorText 0C "Tag creation canceled by user."
    goto :eof
)

REM Creating new tag based on timestamp and pushing it
set "new_tag=v%year%.%month%.%day%_%hour%-%minute%-%second%"
call :ColorText 0A "Creating a new tag"
git tag %new_tag%
git push origin %new_tag%

call :ColorText 0A "New tag '%new_tag%' has been created and pushed."
echo.
call :ColorText 19 "----------------------------------------------------------------"
echo.
echo.

REM Write timestamp to .git_new_tag file
if exist ".git_new_tag" (
    del ".git_new_tag"
)
echo "New tag '%new_tag%' created on %timestamp%" > ".git_new_tag"
call :ColorText 0A "Created .git_new_tag file with the release date."

REM Process core_node directory if it exists
if exist "%core_node_dir%" (
    cd /d "%core_node_dir%"
    call :process_directory
)

goto :eof

:ColorText
<nul set /p ".=%DEL%" > "%~2"
REM echo "%~2"
findstr /v /a:%1 /R "^$" "%~2" nul
del "%~2"
