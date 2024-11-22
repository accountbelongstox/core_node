@echo off
setlocal
set "restart=%~1"
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    goto UACPrompt
) else (
    goto gotAdmin
)
:UACPrompt
echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
echo UAC.ShellExecute "%~s0", "%restart%", "", "runas", 1 >> "%temp%\getadmin.vbs"
"%temp%\getadmin.vbs"
exit /B
:gotAdmin
if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
pushd "%CD%"
powershell -Command "Set-ExecutionPolicy RemoteSigned"
cd /d "%~dp0"
echo Creating desktop shortcut, please do not close this window.
set "exeBat=%~f0"
set "LnkName=DevGuardian.lnk"
set "WorkDir=%cd%"
set "Desc=A developer environment management tool for personal use"
set "Desktop=%USERPROFILE%\Desktop"
set "BaseDriver=D:"
set "AppDirName=applications"
set "langDir=lang_compiler"
set "environmentFolder=environments"
set "python310Dir=Python310"
set "python39Folder=Python39"
set "programName=programing"
set "desktopName=desktop_by_node"
set "mainEntryJs=main.js"
set "langInstallDir=%BaseDriver%\%langDir%"
set "programDir=%BaseDriver%\%programName%"
set "environmentDir=%langInstallDir%\%environmentFolder%"
set "python310InstallerDir=%langInstallDir%\%python310Dir%"
set "python310OrgExe=%python310InstallerDir%\python.exe"
set "python310Exe=%python310InstallerDir%\python310.exe"
set "python310Scripts=%python310InstallerDir%\Scripts"
set "python39InstallerDir=%langInstallDir%\%python39Folder%"
set "python39OrgExe=%python39InstallerDir%\python.exe"
set "python39Exe=%python39InstallerDir%\python39.exe"
set "python39Scripts=%python39InstallerDir%\Scripts"
set "langTmpDir=%langInstallDir%\tmp"
set "setEnvBat=%environmentDir%\set_env.bat"
set "setEnvScriptBat=%environmentDir%\set_env.js"
set "setEnvTmp=%langTmpDir%\set_env.bat"
set "setEnvScriptTmp=%langTmpDir%\set_env.js"
set "desktopDir=%programDir%\%desktopName%"
set "iconDir=%programDir%\%desktopName%\public\images\desktop_by_node\logo.ico"
set "AppBaseDir=%BaseDriver%\%AppDirName%"
set "wingetSource=https://mirrors.ustc.edu.cn/winget-source"
set "restart_input_string=restart_input_string"
set "LOG_DIR=%desktopDir%\logs"
set "LOG_FILE=%LOG_DIR%\.startup_by_cmd"
set "RESTART_FILE=%LOG_DIR%\.startup_by_cmd"
set "YARNDIR_FILE=%LOG_DIR%\.yarn_dir"
set "PYTHON310_FILE=%LOG_DIR%\.python310_dir"
set "PYTHON39_FILE=%LOG_DIR%\.python39_dir"
set "NPM_FILE=%LOG_DIR%\.npm_dir"
for /f "delims=" %%a in ('wmic os get LocalDateTime ^| find "."') do set datetime=%%a
set "year=%datetime:~0,4%"
set "month=%datetime:~4,2%"
set "day=%datetime:~6,2%"
set "hour=%datetime:~8,2%"
set "minute=%datetime:~10,2%"
set "second=%datetime:~12,2%"
set "timestamp=%year%%month%%day%_%hour%%minute%%second%"
set "appBakDir=%AppDirName%_%timestamp%"
set "langBakDir=%langDir%_%timestamp%"
set "GitDir=%AppBaseDir%\Git"
set "GitBinDir=%GitDir%\cmd"
set "GitExe=%GitBinDir%\git.exe"
set "BandizipDir=%AppBaseDir%\Bandizip"
set "VisualStudioCodeDir=%AppBaseDir%\VisualStudioCode"
set "VSCodeExe=%VisualStudioCodeDir%\code.exe"
set "NotepadDir=%AppBaseDir%\Notepad++"
set "NotepadExe=%NotepadDir%\notepad++.exe"
set "BandizipExe=%BandizipDir%\Bandizip.exe"
set "ZipExe=%environmentDir%\7z.exe"
set "appDataLocal=%AppData%\Local\Desktop"
set "wingetSourceFile=%appDataLocal%\.winget_set_source"
set "bakApplicationsFile=%appDataLocal%\.applications_bak"
set "baklang_compilerFile=%appDataLocal%\.lang_compiler_bak"
set "nodeVersion=18.16.0"
set "nodeFileName=node-v%nodeVersion%-win-x64"
set "LocalUrl=https://static.local.12gm.com:905"
set "softlistUrl=%LocalUrl%/softlist"
set "git_shhUrl=%softlistUrl%/iso_keys/keys/git/id_ed25519"
set "git_shhPubUrl=%softlistUrl%/iso_keys/keys/git/id_ed25519.pub"
set "static_srcUrl=%softlistUrl%/static_src"
set "software_installersrcUrl=%static_srcUrl%/static_src"
set "langUrl=%softlistUrl%/lang_compiler"
set "primaryNodeZipUrl=%langUrl%/node_v%nodeVersion%_win_x64.zip"
set "environmentsUrl=%langUrl%/environments.tar"
set "python310Url=%langUrl%/Python310.zip"
set "python39Url=%langUrl%/Python39.zip"
set "setEnvUrl=%langUrl%/set_env.bat"
set "setEnvScriptUrl=%langUrl%/set_env.js"
set "backupNodeZipUrl=https://nodejs.org/dist/v18.16.0/node-v%nodeVersion%-win-x64.zip"
set "git_ncore=git@gitee.com:accountbelongstox/ncore.git"
set "git_desktop=git@gitee.com:accountbelongstox/desktop_by_node.git"
set "tempDir=%TEMP%\download"
set "NodeinstallFileDir=%langInstallDir%\%nodeFileName%"
set "node=%NodeinstallFileDir%\node.exe"
set "npm=%NodeinstallFileDir%\npm.cmd"
set "yarn=%NodeinstallFileDir%\yarn.cmd"
set "gitGlobalEmail=accountbelongstox@163.com"
set "gitGlobalUser=accountbelongstox"
set "python39Tmp=%langTmpDir%\python39.zip"
set "python310Tmp=%langTmpDir%\python310.zip"
set "iconsCode=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"
set "iconsCodeFile=%LOG_DIR%\.icon_file_code"
set "userName=%USERNAME%"
set "startupDir=C:\Users\%userName%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"

if not exist "%appDataLocal%" (
    mkdir "%appDataLocal%"
)
if not exist "%langTmpDir%" (
    mkdir "%langTmpDir%"
)
rem Backup applications
if not exist "%bakApplicationsFile%" (
    if exist "%AppBaseDir%" (
        echo Rename the "%AppBaseDir%" to "%appBakDir%"
        ren "%AppBaseDir%" "%appBakDir%"
        echo "%AppBaseDir%" "%appBakDir%"
        echo YourContentHere > "%bakApplicationsFile%"
    )
    mkdir "%AppBaseDir%"
)
rem Set Winget Source
if not exist "%wingetSourceFile%" (
    echo Creating .winget_set_source file...
    echo YourContentHere > "%wingetSourceFile%"
    rem Configure Winget source
    echo Adding Winget source...
    winget source remove winget
    winget source add winget %wingetSource%
    echo Winget source configuration completed.
)

if not exist "%environmentDir%" (
    if not exist "%langTmpDir%\environments.tar" (
        curl --insecure -o "%langTmpDir%\environments.tar" %environmentsUrl%
    )
    echo Extract environments to %environmentDir%
    tar -xf "%langTmpDir%\environments.tar" -C "%langInstallDir%"
)

if not exist "%setEnvBat%" (
    echo curl --insecure -o "%setEnvTmp%" %setEnvUrl%
    curl --insecure -o "%setEnvTmp%" %setEnvUrl%
    copy /Y "%setEnvTmp%" "%setEnvBat%"
)

if not exist "%setEnvScriptBat%" (
    echo curl --insecure -o "%setEnvScriptTmp%" %setEnvScriptUrl%
    curl --insecure -o "%setEnvScriptTmp%" %setEnvScriptUrl%
    copy /Y "%setEnvScriptTmp%" "%setEnvScriptBat%"
)

rem If Git is not found, install it using winget
if not exist "%GitExe%" (
    echo Git Installing...
    winget install --id "Git.Git" --accept-package-agreements --location %GitDir% --silent
    echo Git installation completed.
    %GitExe% config --global http.sslVerify false
    %GitExe% config --global hooks.filesizehardlimit 20000000
    %GitExe% config --global hooks.filesizesoftlimit 20000000
    %GitExe% config --global core.ignorecase false
)
%GitExe% --version
rem Check if user email is configured
%GitExe% config --global user.email >nul 2>&1
if %errorlevel% neq 0 (
    echo Git User email is not configured, configuring...
    %GitExe% config --global user.email "%gitGlobalEmail%"
) else (
    echo Git User email is configured
)
rem Check if username is configured
%GitExe% config --global user.name >nul 2>&1
if %errorlevel% neq 0 (
    echo Git Username is not configured, configuring...
    %GitExe% config --global user.name "%gitGlobalUser%"
) else (
    echo Git Username is configured
)
if not exist "%BandizipExe%" (
    echo Bandizip Installing...
    winget install --id "Bandisoft.Bandizip" --accept-package-agreements --location %BandizipDir% --silent
    echo Bandizip installation completed.
)

for /f "tokens=3 delims=\" %%a in ("%ZipExe%") do set "version=%%a"
echo 7-Zip: %version%
if not exist "%VSCodeExe%" (
    echo VisualStudioCode installation completed.
    winget install --id "Microsoft.VisualStudioCode" --accept-package-agreements --location %VisualStudioCodeDir% --silent
    echo VisualStudioCode installation completed.
)
if not exist "%NotepadExe%" (
    echo Notepad++ installation completed.
    winget install --id "Notepad++.Notepad++" --accept-package-agreements --location %NotepadDir% --silent
    echo Notepad++ installation completed.
)
if not exist "%tempDir%" (
    rem Create temporary directory
    mkdir "%tempDir%"
)
if not exist "%baklang_compilerFile%" (
    echo Creating baklang_compilerFile file...
    echo YourContentHere > "%baklang_compilerFile%"
    if exist "%langInstallDir%" (
        echo Rename the existing directory with a timestamp
        ren "%langInstallDir%" "%langBakDir%"
    )
    mkdir "%langInstallDir%"
)
if exist "%python310Tmp%" (
    for %%I in ("%python310Tmp%") do (
        if %%~zI equ 0 (
            del "%python310Tmp%"
            echo File "%python310Tmp%" with size 0KB has been deleted.
        ) else (
            echo File "%python310Tmp%" is not 0KB in size.
        )
    )
) else (
    echo File "%python310Tmp%" does not exist.
)
if exist "%python39Tmp%" (
    for %%I in ("%python39Tmp%") do (
        if %%~zI equ 0 (
            del "%python39Tmp%"
            echo File "%python39Tmp%" with size 0KB has been deleted.
        ) else (
            echo File "%python39Tmp%" is not 0KB in size.
        )
    )
) else (
    echo File "%python39Tmp%" does not exist.
)
@REM if not exist "%python310Exe%" (
@REM    if not exist "%python310Tmp%" (
@REM      curl --insecure -o "%python310Tmp%" %python310Url%
@REM     )
@REM     echo Extract python310 to %python310InstallerDir%
@REM     "%ZipExe%" x "%python310Tmp%" -o"%langInstallDir%" -y
@REM     rem del /Q "%python310Tmp%"
@REM )
@REM if not exist "%python310Exe%" (
@REM     copy "%python310OrgExe%" "%python310Exe%"
@REM     echo Python3.10 executable copied to %python310Exe%
@REM )
@REM if not exist "%PYTHON310_FILE%" (
@REM     echo %python310Exe% > "%PYTHON310_FILE%"
@REM )
@REM %python310Exe% --version

if not exist "%python39Exe%" (
    if not exist "%python39Tmp%" (
        curl --insecure -o "%python39Tmp%" %python39Url%
    )
    echo Extract python39 to %python39InstallerDir%
    "%ZipExe%" x "%python39Tmp%" -o"%langInstallDir%" -y
    rem del /Q "%python39Tmp%"
)
if not exist "%python39Exe%" (
    copy "%python39OrgExe%" "%python39Exe%"
    echo Python3.9 executable copied to %python310Exe%
)
if not exist "%PYTHON39_FILE%" (
    echo %python39Exe% > "%PYTHON39_FILE%"
)
%python39Exe% --version

rem Check if Node.js is already installed
if not exist "%node%" (
    echo Node.js not found. Downloading and installing...
    rem Check if the installation directory exists
    if not exist "%langTmpDir%\%nodeFileName%.zip" (
        curl --insecure -o "%langTmpDir%\%nodeFileName%.zip" %backupNodeZipUrl%
    )
    if not exist "%langTmpDir%\%nodeFileName%.zip" (
        curl --insecure -o "%langTmpDir%\%nodeFileName%.zip" %primaryNodeZipUrl%
    )
    echo Extract Node.js to the installation directory using 7z
    "%ZipExe%" x "%langTmpDir%\%nodeFileName%.zip" -o"%langInstallDir%" -y
    rem Set PATH environment variable to include Node.js executable path
    "%node%" -v
    echo "%npm%" config set prefix "%NodeinstallFileDir%"
    "%npm%" config set prefix "%NodeinstallFileDir%"
    echo "%npm%" config set registry https://mirrors.tencent.com/npm/
    "%npm%" config set registry https://mirrors.tencent.com/npm/
    echo "%npm%" install -g yarn
    "%npm%" install -g yarn
    echo Node.js installation completed.
)
REM Set the user directory
set "user_dir=%USERPROFILE%"
REM Check if the .ssh directory exists
if not exist "%user_dir%\.ssh" (
    echo .ssh directory does not exist, starting the download of the key files...
    REM Create the .ssh directory
    mkdir "%user_dir%\.ssh"
    REM Download the id_ed25519 key file to the .ssh directory using winget command
    curl --insecure -o "%user_dir%\.ssh\id_ed25519" %git_shhUrl%
    REM Download the id_ed25519.pub key file to the .ssh directory using curl command
    curl --insecure -o "%user_dir%\.ssh\id_ed25519.pub" %git_shhPubUrl%
    echo The key files download is completed.
    REM Check if SSH is configured and test connections
    echo Testing SSH connections...
    echo yes | ssh -T git@gitee.com
    echo yes | ssh -T git@github.com
)
set "programDir=%BaseDriver%\%programName%"
set "desktopDir=%programDir%\%desktopName%"
if not exist "%programDir%" (
    mkdir %programDir%
)
if not exist "%desktopDir%" (
    echo cd /d "%programDir%"
    cd /d "%programDir%"
    echo %GitExe% clone %git_desktop%
    %GitExe% clone %git_desktop%
)
set "desktopNodeModule=%desktopDir%\node_modules"
echo "%desktopNodeModule%"
if not exist "%desktopNodeModule%" (
    echo cd /d "%desktopDir%"
    cd /d "%desktopDir%"
    set PUPPETEER_SKIP_DOWNLOAD=true
)
cd /d "%desktopDir%"
set "ShortcutParams=restart"
:: Check if the current file exists on the desktop
if not exist "%Desktop%\%LnkName%" (
    echo Set WshShell=CreateObject("WScript.Shell"^) > "%temp%\makelnk.vbs"
    echo strDesKtop=WshShell.SpecialFolders("Desktop"^) >> "%temp%\makelnk.vbs"
    echo Set oShellLink=WshShell.CreateShortcut(strDesKtop^&"\%LnkName%"^) >> "%temp%\makelnk.vbs"
    echo oShellLink.TargetPath="%exeBat%" >> "%temp%\makelnk.vbs"
    echo oShellLink.Arguments="%ShortcutParams%" >> "%temp%\makelnk.vbs"
    echo oShellLink.WorkingDirectory="%WorkDir%" >> "%temp%\makelnk.vbs"
    echo oShellLink.WindowStyle=1 >> "%temp%\makelnk.vbs"
    echo oShellLink.Description="%Desc%" >> "%temp%\makelnk.vbs"
    if defined iconDir (
        echo oShellLink.IconLocation="%iconDir%" >> "%temp%\makelnk.vbs"
    )
    echo oShellLink.HotKey="Ctrl+Shift" >> "%temp%\makelnk.vbs"
    echo oShellLink.Save >> "%temp%\makelnk.vbs"
    cscript /nologo "%temp%\makelnk.vbs"
    del /f /q "%temp%\makelnk.vbs"
    echo Desktop shortcut created successfully!
)
if not exist "%startupDir%\%LnkName%" (
    echo copy "%Desktop%\%LnkName%" "%startupDir%\%LnkName%"
    copy "%Desktop%\%LnkName%" "%startupDir%\%LnkName%"
	explorer "%startupDir%"
)
echo "%node%" "%setEnvScriptBat%" add %NodeinstallFileDir%
echo "%node%" "%setEnvScriptBat%" add %GitBinDir%
echo "%node%" "%setEnvScriptBat%" add %environmentDir%
echo "%node%" "%setEnvScriptBat%" add %python39Scripts%
echo "%node%" "%setEnvScriptBat%" add %python39InstallerDir%
@REM "%node%" "%setEnvScriptBat%" add %pythonInstallerDir%
@REM "%node%" "%setEnvScriptBat%" add %python310Scripts%
"%node%" "%setEnvScriptBat%" add %NodeinstallFileDir%
"%node%" "%setEnvScriptBat%" add %GitBinDir%
"%node%" "%setEnvScriptBat%" add %environmentDir%
"%node%" "%setEnvScriptBat%" add %python39Scripts%
"%node%" "%setEnvScriptBat%" add %python39InstallerDir%
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
rem Check if restart is not empty, then execute the command
if not exist "%RESTART_FILE%" (
    echo %restart_input_string% > "%RESTART_FILE%"
)
if not exist "%YARNDIR_FILE%" (
    echo %yarn% > "%YARNDIR_FILE%"
)
echo Start By CMD token as "%RESTART_FILE%"
"%node%" "%desktopDir%\%mainEntryJs%" yarn=%yarn%  git=%GitExe% 
endlocal
