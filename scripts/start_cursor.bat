@echo off
setlocal

:: Define paths
set "SCRIPT_PATH=D:\programing\core_node\scripts\start_cursor.py"
set "SHORTCUT_NAME=start_cursor.lnk"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\%SHORTCUT_NAME%"
set "ICON_PATH=%USERPROFILE%\AppData\Local\Programs\cursor\Cursor.exe"

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
