# -*- coding: utf-8 -*-
# Window Launcher shortcut check (called by scripts/shells/win/dd.ps1). The shortcut lives on the
# user desktop; the organizer pins it there (DesktopIconManager.ps1 DESKTOP_ORGANIZATION_KEEP_ON_DESKTOP).
# Writes exactly the .lnk that pycore/pyutils/launcher/desktop_integration.py
# ensure_desktop_shortcut writes, so neither writer rewrites the other:
#   TargetPath = GlobalVars.ps1 PYTHON_EXE_PATH, Arguments = -m pycore.pyutils.launcher,
#   WorkingDirectory = repo root, IconLocation = icon.ico (icon.png, python.exe).

$ScriptDir = $PSScriptRoot
$PyutilsDir = Split-Path -Parent $ScriptDir
$PycoreDir = Split-Path -Parent $PyutilsDir
$RepoRootDir = Split-Path -Parent $PycoreDir
$GlobalVarsScript = Join-Path $RepoRootDir "scripts\shells\win\win_common\GlobalVars.ps1"
$LauncherEntryPath = Join-Path $ScriptDir "__main__.py"
$ShortcutName = "Window Launcher"
$ShortcutDescription = "Launch Window Launcher - Multiple Terminal Windows"
$ShortcutArguments = "-m pycore.pyutils.launcher"
$ShortcutFileName = "{0}.lnk" -f $ShortcutName
$IconIcoPath = Join-Path $ScriptDir "icon.ico"
$IconPngPath = Join-Path $ScriptDir "icon.png"
$PythonExe = $null
$IconPath = $null
$ShortcutDirectory = $null
$ShortcutPath = $null
$ShortcutMatches = $false

. $GlobalVarsScript
$PythonExe = $Global:PYTHON_EXE_PATH


function Get-ComparablePath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
    return [System.IO.Path]::GetFullPath($Path)
}

function Test-LauncherShortcutMatches {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$IconLocation,
        [Parameter(Mandatory = $true)][string]$Description
    )
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcutIcon = ([string]$shortcut.IconLocation -split ',')[0]
    return ((Get-ComparablePath $shortcut.TargetPath) -eq (Get-ComparablePath $TargetPath)) -and
        ([string]$shortcut.Arguments -eq $Arguments) -and
        ((Get-ComparablePath $shortcut.WorkingDirectory) -eq (Get-ComparablePath $WorkingDirectory)) -and
        ((Get-ComparablePath $shortcutIcon) -eq (Get-ComparablePath $IconLocation)) -and
        ([string]$shortcut.Description -eq $Description)
}

function Set-LauncherShortcut {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$IconLocation,
        [Parameter(Mandatory = $true)][string]$Description
    )
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.IconLocation = $IconLocation
    $shortcut.Description = $Description
    $shortcut.Save()
}

if (-not (Test-Path -LiteralPath $LauncherEntryPath -PathType Leaf)) {
    Write-Host "Warning: Launcher entry not found: $LauncherEntryPath" -ForegroundColor Yellow
    return
}
# desktop_integration.py falls back to the running interpreter until this one exists;
# writing a dangling target here would make the two writers fight.
if ([string]::IsNullOrWhiteSpace([string]$PythonExe) -or -not (Test-Path -LiteralPath $PythonExe -PathType Leaf)) {
    Write-Host "Python not installed yet ($PythonExe); skipping the $ShortcutName shortcut." -ForegroundColor Yellow
    return
}

if (Test-Path -LiteralPath $IconIcoPath -PathType Leaf) {
    $IconPath = $IconIcoPath
} elseif (Test-Path -LiteralPath $IconPngPath -PathType Leaf) {
    $IconPath = $IconPngPath
} else {
    $IconPath = $PythonExe
}

$ShortcutDirectory = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $ShortcutDirectory $ShortcutFileName

try {
    if (Test-Path -LiteralPath $ShortcutPath) {
        $ShortcutMatches = Test-LauncherShortcutMatches -Path $ShortcutPath -TargetPath $PythonExe `
            -Arguments $ShortcutArguments -WorkingDirectory $RepoRootDir -IconLocation $IconPath `
            -Description $ShortcutDescription
    }
    if ($ShortcutMatches) {
        Write-Host "Shortcut already exists and is correct: $ShortcutPath" -ForegroundColor Cyan
    } else {
        Set-LauncherShortcut -Path $ShortcutPath -TargetPath $PythonExe -Arguments $ShortcutArguments `
            -WorkingDirectory $RepoRootDir -IconLocation $IconPath -Description $ShortcutDescription
        Write-Host "Created/updated shortcut: $ShortcutPath" -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Failed to write shortcut ${ShortcutPath}: $($_.Exception.Message)" -ForegroundColor Yellow
}
