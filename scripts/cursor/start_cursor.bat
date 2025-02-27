@echo off
setlocal
set "SCRIPT_DIR=D:\programing\core_node\scripts\cursor"
set "SCRIPT_NAME=start_cursor"
:: Define paths
set "SCRIPT_PATH=%SCRIPT_DIR%\%SCRIPT_NAME%.py"
set "SHORTCUT_NAME=%SCRIPT_NAME%.lnk"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\%SHORTCUT_NAME%"
set "ICON_PATH=%SCRIPT_DIR%\iconcursor.ico"

:: Check shortcut existence
if exist "%SHORTCUT_PATH%" (
    echo Shortcut already exists.
) else (
    echo Creating shortcut...
    powershell -Command ^
        "$WScriptShell = New-Object -ComObject WScript.Shell; " ^
        "$Shortcut = $WScriptShell.CreateShortcut('%SHORTCUT_PATH%'); " ^
        "$Shortcut.TargetPath = 'python.exe'; " ^
        "$Shortcut.Arguments = '\"%SCRIPT_PATH%\"'; " ^
        "$Shortcut.IconLocation = '%ICON_PATH%'; " ^
        "$Shortcut.Save()"
    echo Shortcut created successfully!
)

:: Execute main script
echo Launching start_cursor.py...
python "%SCRIPT_PATH%"
