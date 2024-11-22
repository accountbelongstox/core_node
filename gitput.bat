@echo off
SETLOCAL EnableDelayedExpansion
SET "PowerShellPath=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
%PowerShellPath% -command "$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')"

REM Get the Machine PATH
for /f "tokens=2*" %%A in ('c:/windows/system32/reg.exe query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path') do set machinePath=%%B
REM Get the User PATH
for /f "tokens=2*" %%A in ('c:/windows/system32/reg.exe query "HKCU\Environment" /v Path') do set userPath=%%B
REM Combine Machine and User PATHs
set combinedPath=%machinePath%;%userPath%
REM Temporarily set the combined PATH for the current session
set PATH=%combinedPath%
REM Print the new PATH to verify
echo PATH environment variable has been updated successfully for the current session.

REM Define the DevOpsStart.bat file and zip file
set devOpsBase=DevOpsStart
set devOpsBatFile=%devOpsBase%.bat
set devOpsFile=%~dp0%devOpsBatFile%
set devOpsZip=%~dp0%devOpsBase%.zip

REM Check if DevOpsStart.bat exists
if not exist "%devOpsFile%" (
    call :ColorText 4C "Error: DevOpsStart.bat not found in the current directory!"
) else (
    REM Delete the old DevOpsStart.zip if it exists
    @REM if exist "%devOpsZip%" (
    @REM     del "%devOpsZip%"
    @REM )
    REM Create a new zip file containing DevOpsStart.bat
    call :ColorText 0a "DevOpsStart.bat found. Creating zip archive..."
    C:\Windows\System32\tar.exe -a -c -f "%devOpsZip%" -C "%~dp0" "%devOpsBatFile%"
    echo C:\Windows\System32\tar.exe -a -c -f "%devOpsZip%" -C "%~dp0" "%devOpsBatFile%"
    call :ColorText 0a "DevOpsStart.bat has been zipped into DevOpsStart.zip"
)

for /f "delims=" %%a in ('wmic OS Get localdatetime ^| find "."') do set datetime=%%a
set "year=%datetime:~0,4%"
set "month=%datetime:~4,2%"
set "day=%datetime:~6,2%"
set "hour=%datetime:~8,2%"
set "minute=%datetime:~10,2%"
set "second=%datetime:~12,2%"
set "timestamp=%year%-%month%-%day%@%hour%-%minute%-%second%"
set "ncore_dir=%~dp0ncore\"

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

echo.
call :ColorText 0a "Entering--" 
@REM echo %cd%
call :ColorText 0a "--------------------------------" 
echo.
git remote -v
call :ColorText 0a "--------------------------------" 
echo.
echo.
echo.
call :ColorText 2F "----------------------------------------------------------------" 
echo.
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
goto :eof

:ColorText
<nul set /p ".=%DEL%" > "%~2"
REM echo "%~2"
C:\Windows\System32\findstr /v /a:%1 /R "^$" "%~2" nul
del "%~2"
