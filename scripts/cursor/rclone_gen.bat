@echo off
setlocal
set "BatName=rclone_start"
:: Define paths
set "SCRIPT_PATH=D:\programing\core_node\scripts\cursor\%BatName%.py"
set "ENV_PATH=D:\lang_compiler\environments\"
set "RCLONE_PATH=%ENV_PATH%rclone.exe"
set "SHORTCUT_NAME=%BatName%.lnk"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\%SHORTCUT_NAME%"
set "ICON_PATH=%RCLONE_PATH%"

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
