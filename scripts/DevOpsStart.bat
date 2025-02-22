@echo off
setlocal enabledelayedexpansion
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

REM Define the absolute path for PowerShell
SET "PowerShellPath=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

REM Alternatively, use PowerShell Core if available
REM SET "PowerShellPath=C:\Program Files\PowerShell\7\pwsh.exe"

@REM for /f "tokens=2*" %%A in ('c:/windows/system32/reg.exe query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path') do set machinePath=%%B
@REM for /f "tokens=2*" %%A in ('c:/windows/system32/reg.exe query "HKCU\Environment" /v Path') do set userPath=%%B
@REM set combinedPath=%machinePath%;%userPath%
@REM set PATH=%combinedPath% 
@REM echo %PATH%
@REM echo PATH environment variable has been refreshed successfully for the current session.

"%PowerShellPath%" -Command "Set-ExecutionPolicy RemoteSigned"
cd /d "%~dp0"

:: Set the version and directory variables
set NODE_VERSION=v20.16.0
set NODE_DIR=node-%NODE_VERSION%-win-x64
set INSTALL_DIR=D:\lang_compiler
set TEMP_DIR=%INSTALL_DIR%\tmp
set NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_DIR%.zip
set NODE_PATH=%INSTALL_DIR%\%NODE_DIR%\node.exe
set NPM_PATH=%INSTALL_DIR%\%NODE_DIR%\npm.cmd
set USER_DIR=%USERPROFILE%\.DevOps
set USER_CACHE_DIR=%USER_DIR%\.cache
set WINGET_FLAG_FILE=%USER_DIR%\.winget_set
set GIT_EXE=C:\Program Files\Git\bin\git.exe
set BASE_DIR=D:\programing
set PROJECT_DIR=%BASE_DIR%\core_node
set "REG_KEY=HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
set "REG_TYPE=REG_SZ"
for /f "tokens=2 delims==" %%a in ('"wmic os get localdatetime /value"') do set datetime=%%a
set datetime=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set BACKUP_FILE=%USER_CACHE_DIR%\env_backup_%datetime%.txt
set "VAR_7Z_TEMP_DIR=%TEMP_DIR%"
set "VAR_7Z_INSTALL_DIR=%INSTALL_DIR%\7z"
set "VAR_7Z_DOWNLOAD_URL=https://www.7-zip.org/a/7z2408-x64.exe"
set "VAR_7Z_EXE_PATH=%VAR_7Z_INSTALL_DIR%\7z.exe"
set "VAR_7Z_TMP_NAME=7z2408-x64.exe"
set "VAR_7Z_TMP_PATH=%VAR_7Z_TEMP_DIR%\%VAR_7Z_TMP_NAME%"

if not exist %USER_DIR% (
    mkdir %USER_DIR%
)
:: Check if node is installed
if exist %NODE_PATH% (
    echo Node.js is already installed.
    %NODE_PATH% -v
)

:: Ensure the install directory exists
if not exist %INSTALL_DIR% (
    mkdir %INSTALL_DIR%
)

if not exist %USER_CACHE_DIR% (
    mkdir %USER_CACHE_DIR%
)

:: Ensure the temporary directory exists
if not exist %TEMP_DIR% (
    mkdir %TEMP_DIR%
)

:: Clean up old downloads
if exist %TEMP_DIR%\%NODE_DIR%.zip (
    del /f /q %TEMP_DIR%\%NODE_DIR%.zip
)

:: Download and extract Node.js if not already installed
if not exist %INSTALL_DIR%\%NODE_DIR% (
    echo Downloading Node.js...
    curl -o %TEMP_DIR%\%NODE_DIR%.zip %NODE_URL%
    echo Extracting Node.js...
    tar -xf %TEMP_DIR%\%NODE_DIR%.zip -C %INSTALL_DIR%
)

:: Verify node and npm installation
if exist %NODE_PATH% (
    echo Node.js version:
    %NODE_PATH% -v
) else (
    echo Node.js installation failed.
    goto :end
)
goto check_winget

:SHOW_ENV_PATH
for /f "tokens=2,*" %%a in ('reg query "%REG_KEY%" /v Path 2^>nul') do (
    set "currentPath=%%b"
)

for %%p in (%currentPath%) do (
    echo %%p
)
exit /b


:ADD_ENV_PATH
set "NEW_PATH=%1"
if "%NEW_PATH%"=="" (
    echo No path provided. Please specify a path to add.
    exit /b
)

for /f "tokens=2,*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do (
    set "CURRENT_PATH=%%b"
)

echo Backing up current Path environment to "%BACKUP_FILE%"...
echo !CURRENT_PATH! > "%BACKUP_FILE%"

echo Backup successful. The backup file is saved at: %BACKUP_FILE%

echo !CURRENT_PATH! | findstr /i "%NEW_PATH%" >nul
if !errorlevel! equ 0 (
    echo The path "%NEW_PATH%" already exists in the environment.
    exit /b
)

set "NEW_PATH=!CURRENT_PATH!;%NEW_PATH%"

echo Adding new path to the environment...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path /t REG_SZ /d "!NEW_PATH!" /f

echo Path updated successfully.
exit /b

:InstallV7
if not exist "%VAR_7Z_TEMP_DIR%" (
    mkdir "%VAR_7Z_TEMP_DIR%"
)
if exist "%VAR_7Z_EXE_PATH%" (
    echo 7-Zip installer already exists. Skipping installation.
    exit /b
)
if exist "%VAR_7Z_TMP_PATH%" (
    del /f /q "%VAR_7Z_TMP_PATH%"
    echo Deleted old 7-Zip installer.
)
echo Downloading 7-Zip installer...
curl -L "%VAR_7Z_DOWNLOAD_URL%" -o "%VAR_7Z_TMP_PATH%"
if not exist "%VAR_7Z_TMP_PATH%" (
    echo Failed to download 7-Zip installer. Exiting...
    exit /b
)
echo Installing 7-Zip to %VAR_7Z_INSTALL_DIR%...
"%VAR_7Z_TMP_PATH%" /S /D=%VAR_7Z_INSTALL_DIR%
if exist "%VAR_7Z_EXE_PATH%" (
    echo 7-Zip installed successfully.
) else (
    echo Installation failed. Please check the logs for errors.
)
exit /b

:check_winget
@REM :: Check if winget has been set up
if not exist %WINGET_FLAG_FILE% (
    echo Setting up winget source...
    winget source remove winget
    winget source add winget https://mirrors.ustc.edu.cn/winget-source
    echo Winget source has been set up. > %WINGET_FLAG_FILE%
)

:: Install VSCode, Chrome, Git, Notepad++, and Bandizip if not installed
echo Checking for VSCode, Chrome, Git, Notepad++, and Bandizip installation...

:: Check for VSCode
if not exist "%USER_DIR%\.vscode_installed_marker_file" (
    echo Installing Visual Studio Code...
    winget install --id Microsoft.VisualStudioCode --silent --accept-package-agreements --accept-source-agreements
    @REM if %ERRORLEVEL% == 0 (
    echo VSCode installation successful. > "%USER_DIR%\.vscode_installed_marker_file"
    @REM )
) else (
    echo VSCode is already installed.
)

if not exist "%USER_DIR%\.cursor_installed_marker_file" (
    echo Installing Cursor...
    winget install --id Anysphere.Cursor --silent --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% == 0 (
        echo Cursor installation successful. > "%USER_DIR%\.cursor_installed_marker_file"
    ) else (
        echo Cursor installation failed. Please check the installation process.
    )
) else (
    echo Cursor is already installed.
)

:: Check for Bandizip
if not exist "%USER_DIR%\.bandizip_installed_marker_file" (
    echo Installing Bandizip...
    winget install --id Bandisoft.Bandizip --silent --accept-package-agreements --accept-source-agreements
    echo Bandizip installation successful. > "%USER_DIR%\.bandizip_installed_marker_file"
) else (
    echo Bandizip is already installed.
)

:: Check for Chrome
if not exist "%USER_DIR%\.chrome_installed_marker_file" (
    echo Installing Google Chrome...
    winget install --id Google.Chrome --silent --accept-package-agreements --accept-source-agreements
    @REM if %ERRORLEVEL% == 0 (
    echo Chrome installation successful. > "%USER_DIR%\.chrome_installed_marker_file"
    @REM )
) else (
    echo Chrome is already installed.
)

:: Check for Git
if not exist "%USER_DIR%\.git_installed_marker_file" (
    echo Installing Git...
    winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
    @REM if %ERRORLEVEL% == 0 (
    echo Git installation successful. > "%USER_DIR%\.git_installed_marker_file"
    @REM )
) else (
    echo Git is already installed.
)

:: Check for Notepad++
if not exist "%USER_DIR%\.notepadpp_installed_marker_file" (
    echo Installing Notepad++...
    winget install --id Notepad++.Notepad++ --silent --accept-package-agreements --accept-source-agreements
    @REM if %ERRORLEVEL% == 0 (
    echo Notepad++ installation successful. > "%USER_DIR%\.notepadpp_installed_marker_file"
    @REM )
) else (
    echo Notepad++ is already installed.
)

:: Check for Bandizip
if not exist "%USER_DIR%\.bandizip_installed_marker_file" (
    echo Installing Bandizip...
    winget install --id Bandisoft.Bandizip --silent --accept-package-agreements --accept-source-agreements
    @REM if %ERRORLEVEL% == 0 (
    echo Bandizip installation successful. > "%USER_DIR%\.bandizip_installed_marker_file"
    @REM )
) else (
    echo Bandizip is already installed.
)


:run_script
if exist "%VAR_7Z_EXE_PATH%" (
    echo 7-Zip is already installed. Skipping installation.
    echo 7-Zip version:
    "%VAR_7Z_EXE_PATH%" | findstr /i "7-Zip"
)
if not exist "%VAR_7Z_EXE_PATH%" (
    call :InstallV7
)
:: Check if in project directory, if not, ensure the base directory exists and switch to it
if not "%CD%"=="%PROJECT_DIR%" (
    if not exist %BASE_DIR% (
        mkdir %BASE_DIR%
    )
    cd /d %BASE_DIR%
    :: Clone the repository if the project directory does not exist
    if not exist %PROJECT_DIR% (
        echo Cloning the repository...
        @REM "%GIT_EXE%" clone ssh://git@git.local.12gm.com:5022/adminroot/core_node.git
        "%GIT_EXE%" config --global --unset http.proxy
        echo "%GIT_EXE%" clone https://gitee.com/accountbelongstox/core_node.git
        "%GIT_EXE%" clone https://gitee.com/accountbelongstox/core_node.git
        
    )
    cd /d %PROJECT_DIR%
)

:: Execute the main.js script with the specified parameters
echo Running main.js with parameters...
echo %NODE_PATH% %PROJECT_DIR%\main.js app=DevOps
%NODE_PATH% %PROJECT_DIR%\main.js app=DevOps
exit /b

REM Execute the PowerShell command to update PATH
"%PowerShellPath%" -command "$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')"

REM Confirm the update
echo PATH environment variable updated.

echo The Terminal Environment variable PATH refreshed.

for /f "tokens=2*" %%A in ('c:/windows/system32/reg.exe query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path') do set machinePath=%%B
for /f "tokens=2*" %%A in ('c:/windows/system32/reg.exe query "HKCU\Environment" /v Path') do set userPath=%%B
set combinedPath=%machinePath%;%userPath%
set PATH=%combinedPath%
echo %PATH%
echo PATH environment variable has been refreshed successfully for the current session.

REM Configure Git settings
echo Configuring Git settings...

REM Generate a random username and email for Git
set /a randomNum=%random%

set gitUsername=Gmdev%randomNum%
set gitEmail=Gmdev%randomNum%@devlop.com

REM Configure Git with random username and email
REM Check if Git user.name is set
for /f "tokens=*" %%i in ('"%GIT_EXE%" config --global user.name') do set gitUserNameCurrent=%%i
if "%gitUserNameCurrent%"=="" (
    "%GIT_EXE%" config --global user.name "%gitUsername%"
    echo Git user.name set to %gitUsername%
) else (
    echo Git user.name already set to %gitUserNameCurrent%
)

REM Check if Git user.email is set
for /f "tokens=*" %%i in ('"%GIT_EXE%" config --global user.email') do set gitEmailCurrent=%%i
if "%gitEmailCurrent%"=="" (
    "%GIT_EXE%" config --global user.email "%gitEmail%"
    echo Git user.email set to %gitEmail%
) else (
    echo Git user.email already set to %gitEmailCurrent%
)

REM Check and set Git http.sslVerify
for /f "tokens=*" %%i in ('"%GIT_EXE%" config --global http.sslVerify') do set gitSslVerifyCurrent=%%i
if "%gitSslVerifyCurrent%"=="" (
    "%GIT_EXE%" config --global http.sslVerify false
    echo Git http.sslVerify set to false
) else (
    echo Git http.sslVerify already set to %gitSslVerifyCurrent%
)

REM Check and set Git http.postBuffer
for /f "tokens=*" %%i in ('"%GIT_EXE%" config --global http.postBuffer') do set gitPostBufferCurrent=%%i
if "%gitPostBufferCurrent%"=="" (
    "%GIT_EXE%" config --global http.postBuffer 524288000
    echo Git http.postBuffer set to 524288000
) else (
    echo Git http.postBuffer already set to %gitPostBufferCurrent%
)

REM Display Git configuration
echo Git configuration:
"%GIT_EXE%" config --global --list

echo Git setup complete.

:end
endlocal

pause