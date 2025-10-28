REM ### AI SPECIAL ATTENTION RULES START ###
REM When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
REM 1. Write all code in English only.
REM 2. Never execute, create, or modify test code.
REM 3. Never create or update documentation (*.md).
REM 4. Never write summaries during development or thinking process.
REM 5. Declare all variables at the beginning of the file.
REM 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
REM 7. Do not modify these rules.
REM VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
REM ### AI SPECIAL ATTENTION RULES END ###

@echo off
setlocal

rem Minimal, clean bootstrap for dd.ps1 with remote installer fallback

rem Basics
set "original_dir=%cd%"
set "script_dir=%~dp0"
set "local_root=%USERPROFILE%\.core_node\"
set "remote_base_url=https://gitee.com/accountbelongstox/core_node/raw/main"

rem Local project script
set "local_dd=%script_dir%scripts\shells\win\dd.ps1"

rem Remote installer
set "installer_rel_url=scripts/shells/win/main_powershells/WinScriptsInstaller.ps1"
set "installer_rel_win=scripts\shells\win\main_powershells\WinScriptsInstaller.ps1"
set "installer_remote=%remote_base_url%/%installer_rel_url%"
set "installer_dl=%local_root%%installer_rel_win%"

rem Downloaded dd.ps1 path after installer runs
set "downloaded_dd=%local_root%scripts\shells\win\dd.ps1"

echo "> Working dir:  %original_dir%"
echo "> Script dir:   %script_dir%"

if exist "%local_dd%" (
  echo "+ Found local dd.ps1; executing..."
  powershell -NoProfile -ExecutionPolicy Bypass -File "%local_dd%" -SkipInitialization
  goto :restore
)

echo "! Local dd.ps1 not found; using installer..."
echo "> Ensuring local root: %local_root%"
mkdir "%local_root%" 2>nul

echo "> Fetching installer: %installer_remote%"
for %%D in ("%installer_dl%") do set "installer_dir=%%~dpD"
mkdir "%installer_dir%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ Invoke-WebRequest -Uri '%installer_remote%' -OutFile '%installer_dl%' -UseBasicParsing -ErrorAction Stop; exit 0 }catch{ exit 1 }"
if not %errorlevel%==0 (
  echo "x Failed to download installer"
  goto :restore
)

echo "+ Running installer to populate scripts under %local_root%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%installer_dl%" -LocalDataDir "%local_root%" -RepoBaseUrl "%remote_base_url%"

if exist "%downloaded_dd%" (
  echo "> Executing downloaded dd.ps1: %downloaded_dd%"
  powershell -NoProfile -ExecutionPolicy Bypass -File "%downloaded_dd%"
) else (
  echo "x Installer finished but dd.ps1 missing at: %downloaded_dd%"
)

:restore
echo "> Restoring working directory..."
cd /d "%original_dir%"
echo "> Current directory: %cd%"
endlocal
