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
