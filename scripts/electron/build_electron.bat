@echo off
set "CURRENT_DIR=%~dp0"
yarn build-w
set "APP_DIR=%CURRENT_DIR%out\win-unpacked\resources\app"

echo "Removing %APP_DIR%\ncore"
echo PowerShell.exe -Command "Remove-Item -Path '%APP_DIR%\ncore' -Recurse -Force"

echo "Removing %APP_DIR%\electron"
echo PowerShell.exe -Command "Remove-Item -Path '%APP_DIR%\electron' -Recurse -Force"

echo "Removing %APP_DIR%\scripts"
echo PowerShell.exe -Command "Remove-Item -Path '%APP_DIR%\scripts' -Recurse -Force"

echo "Removing %APP_DIR%\apps"
echo PowerShell.exe -Command "Remove-Item -Path '%APP_DIR%\apps' -Recurse -Force"

echo "Creating hard link for %APP_DIR%\ncore"
echo PowerShell.exe -Command "New-Item -ItemType Junction -Path '%APP_DIR%\ncore' -Target '%CURRENT_DIR%ncore'"

echo "Creating hard link for %APP_DIR%\electron"
echo PowerShell.exe -Command "New-Item -ItemType Junction -Path '%APP_DIR%\electron' -Target '%CURRENT_DIR%electron'"

echo "Creating hard link for %APP_DIR%\scripts"
echo PowerShell.exe -Command "New-Item -ItemType Junction -Path '%APP_DIR%\scripts' -Target '%CURRENT_DIR%scripts'"

echo "Creating hard link for %APP_DIR%\apps"
echo PowerShell.exe -Command "New-Item -ItemType Junction -Path '%APP_DIR%\apps' -Target '%CURRENT_DIR%apps'"

echo "Directories have been deleted and hard links have been created."
pause
