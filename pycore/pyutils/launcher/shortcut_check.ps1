# -*- coding: utf-8 -*-
# Window Launcher desktop shortcut check (called by scripts/shells/win/dd.ps1).
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
$DesktopPath = $null
$ShortcutPath = $null
$ShortcutMatches = $false

. $GlobalVarsScript
$PythonExe = $Global:PYTHON_EXE_PATH

function Get-DesktopPath {
    $shell = $null
    $desktop = $null
    try {
        $shell = New-Object -ComObject WScript.Shell
        $desktop = $shell.SpecialFolders.Item("Desktop")
        if (-not [string]::IsNullOrWhiteSpace($desktop)) {
            return $desktop
        }
    } catch {
        $desktop = $null
    }

    if ($env:USERPROFILE) {
        $desktop = Join-Path $env:USERPROFILE "Desktop"
        if (Test-Path -LiteralPath $desktop) {
            return $desktop
        }
    }
    if ($env:PUBLIC) {
        $desktop = Join-Path $env:PUBLIC "Desktop"
        if (Test-Path -LiteralPath $desktop) {
            return $desktop
        }
    }
    if ($env:USERPROFILE) {
        $desktop = Join-Path $env:USERPROFILE "Desktop"
        New-Item -ItemType Directory -Path $desktop -Force | Out-Null
        return $desktop
    }
    return $null
}

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

$DesktopPath = Get-DesktopPath
if ([string]::IsNullOrWhiteSpace([string]$DesktopPath)) {
    Write-Host "Warning: Could not determine desktop path, skipping shortcut creation" -ForegroundColor Yellow
    return
}
$ShortcutPath = Join-Path $DesktopPath $ShortcutFileName

try {
    if (Test-Path -LiteralPath $ShortcutPath) {
        $ShortcutMatches = Test-LauncherShortcutMatches -Path $ShortcutPath -TargetPath $PythonExe `
            -Arguments $ShortcutArguments -WorkingDirectory $RepoRootDir -IconLocation $IconPath `
            -Description $ShortcutDescription
    }
    if ($ShortcutMatches) {
        Write-Host "Desktop shortcut already exists and is correct: $ShortcutName" -ForegroundColor Cyan
    } else {
        Set-LauncherShortcut -Path $ShortcutPath -TargetPath $PythonExe -Arguments $ShortcutArguments `
            -WorkingDirectory $RepoRootDir -IconLocation $IconPath -Description $ShortcutDescription
        Write-Host "Created/updated desktop shortcut: $ShortcutName" -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Failed to write desktop shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
}
