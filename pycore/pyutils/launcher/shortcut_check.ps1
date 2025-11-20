# -*- coding: utf-8 -*-
# Shortcut Manager PowerShell Script
# Checks if desktop shortcut exists and is correct, creates/fixes if needed

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPyPath = Join-Path $scriptDir "launcher.py"

# Check if launcher.py exists
if (-not (Test-Path $launcherPyPath)) {
    Write-Host "Warning: Launcher file not found: $launcherPyPath" -ForegroundColor Yellow
    exit 1
}

# Get Windows version (win10 or win11)
function Get-WindowsVersion {
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $buildNumber = [int]$osInfo.BuildNumber
    if ($buildNumber -ge 22000) {
        return "win11"
    } else {
        return "win10"
    }
}

# Get dev environment path
function Get-DevEnvPath {
    $winVersion = Get-WindowsVersion
    $devPath = Join-Path "D:\" ".dev_$winVersion\.winenvs"
    if (-not (Test-Path $devPath)) {
        New-Item -ItemType Directory -Path $devPath -Force | Out-Null
    }
    return $devPath
}

# Get desktop path
function Get-DesktopPath {
    try {
        $shell = New-Object -ComObject WScript.Shell
        $desktop = $shell.SpecialFolders.Item("Desktop")
        if (-not [string]::IsNullOrWhiteSpace($desktop)) {
            return $desktop
        }
    } catch {
        # COM object failed, try other methods
    }

    # Try USERPROFILE Desktop
    if ($env:USERPROFILE) {
        $desktop = Join-Path $env:USERPROFILE "Desktop"
        if (Test-Path $desktop) {
            return $desktop
        }
    }

    # Try PUBLIC Desktop
    if ($env:PUBLIC) {
        $desktop = Join-Path $env:PUBLIC "Desktop"
        if (Test-Path $desktop) {
            return $desktop
        }
    }

    # Last resort: create Desktop in USERPROFILE
    if ($env:USERPROFILE) {
        $desktop = Join-Path $env:USERPROFILE "Desktop"
        try {
            New-Item -ItemType Directory -Path $desktop -Force | Out-Null
            return $desktop
        } catch {
            # Failed to create, return null
        }
    }

    return $null
}

# Check if shortcut needs update
function Test-ShortcutNeedsUpdate {
    param(
        [string]$ShortcutPath,
        [string]$PythonExe,
        [string]$LauncherPyPath,
        [string]$IconPath,
        [string]$WorkingDir,
        [string]$Description
    )
    
    if (-not (Test-Path $ShortcutPath)) {
        return $true
    }
    
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($ShortcutPath)
        
        # Normalize paths for comparison
        $pythonExeNormalized = (Resolve-Path $PythonExe -ErrorAction SilentlyContinue).Path
        if (-not $pythonExeNormalized) {
            $pythonExeNormalized = $PythonExe
        }
        
        $shortcutTargetNormalized = (Resolve-Path $shortcut.TargetPath -ErrorAction SilentlyContinue).Path
        if (-not $shortcutTargetNormalized) {
            $shortcutTargetNormalized = $shortcut.TargetPath
        }
        
        # Compare Python executable
        if ($shortcutTargetNormalized -ne $pythonExeNormalized) {
            return $true
        }
        
        # Compare arguments (launcher.py path)
        $expectedArgs = "`"$LauncherPyPath`""
        if ($shortcut.Arguments -ne $expectedArgs) {
            return $true
        }
        
        $workingDirNormalized = (Resolve-Path $WorkingDir -ErrorAction SilentlyContinue).Path
        if (-not $workingDirNormalized) {
            $workingDirNormalized = $WorkingDir
        }
        
        $shortcutWorkingDirNormalized = (Resolve-Path $shortcut.WorkingDirectory -ErrorAction SilentlyContinue).Path
        if (-not $shortcutWorkingDirNormalized) {
            $shortcutWorkingDirNormalized = $shortcut.WorkingDirectory
        }
        
        if ($shortcutWorkingDirNormalized -ne $workingDirNormalized) {
            return $true
        }
        
        # Check icon (handle IconLocation format "path,index")
        $iconPathPart = ($IconPath -split ',')[0]
        $shortcutIconPart = ($shortcut.IconLocation -split ',')[0]
        
        $iconPathNormalized = (Resolve-Path $iconPathPart -ErrorAction SilentlyContinue).Path
        if (-not $iconPathNormalized) {
            $iconPathNormalized = $iconPathPart
        }
        
        $shortcutIconNormalized = (Resolve-Path $shortcutIconPart -ErrorAction SilentlyContinue).Path
        if (-not $shortcutIconNormalized) {
            $shortcutIconNormalized = $shortcutIconPart
        }
        
        if ($shortcutIconNormalized -ne $iconPathNormalized) {
            return $true
        }
        
        if ($shortcut.Description -ne $Description) {
            return $true
        }
        
        # All properties match, no update needed
        return $false
    } catch {
        Write-Host "Warning: Could not read shortcut info, will update: $_" -ForegroundColor Yellow
        return $true
    }
}

# Main function: Check and ensure shortcut
function Check-AndEnsureShortcut {
    $shortcutName = "Window Launcher"
    $launcherDir = $scriptDir
    
    # Get Python executable
    $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pythonExe) {
        if ($Global:PYTHON_EXE_PATH -and (Test-Path $Global:PYTHON_EXE_PATH)) {
            $pythonExe = $Global:PYTHON_EXE_PATH
        } else {
            Write-Host "Warning: Python executable not found" -ForegroundColor Yellow
            return $false
        }
    }
    
    # Use icon.ico if available, then icon.png, otherwise use Python icon
    $iconIcoPath = Join-Path $launcherDir "icon.ico"
    $iconPngPath = Join-Path $launcherDir "icon.png"
    if (Test-Path $iconIcoPath) {
        $iconPath = $iconIcoPath
    } elseif (Test-Path $iconPngPath) {
        $iconPath = $iconPngPath
    } else {
        $iconPath = $pythonExe
    }
    
    $workingDir = $launcherDir
    $description = "Launch Window Launcher - Multiple Terminal Windows"
    
    # Get desktop path and shortcut path
    $desktopPath = Get-DesktopPath

    if ([string]::IsNullOrWhiteSpace($desktopPath)) {
        Write-Host "Warning: Could not determine desktop path, skipping shortcut creation" -ForegroundColor Yellow
        return $false
    }

    $shortcutPath = Join-Path $desktopPath "$shortcutName.lnk"

    # Check if shortcut exists
    if (-not (Test-Path $shortcutPath)) {
        # Shortcut doesn't exist, create it
        try {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $pythonExe
            $shortcut.Arguments = "`"$launcherPyPath`""
            $shortcut.WorkingDirectory = $workingDir
            $shortcut.Description = $description
            $shortcut.IconLocation = $iconPath
            $shortcut.Save()
            Write-Host "Created desktop shortcut: $shortcutName" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "Warning: Failed to create desktop shortcut: $_" -ForegroundColor Yellow
            return $false
        }
    } else {
        # Shortcut exists, check if it's correct
        $needsUpdate = Test-ShortcutNeedsUpdate -ShortcutPath $shortcutPath -PythonExe $pythonExe -LauncherPyPath $launcherPyPath -IconPath $iconPath -WorkingDir $workingDir -Description $description
        
        if ($needsUpdate) {
            # Shortcut exists but is incorrect, fix it
            try {
                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($shortcutPath)
                $shortcut.TargetPath = $pythonExe
                $shortcut.Arguments = "`"$launcherPyPath`""
                $shortcut.WorkingDirectory = $workingDir
                $shortcut.Description = $description
                $shortcut.IconLocation = $iconPath
                $shortcut.Save()
                Write-Host "Fixed desktop shortcut: $shortcutName" -ForegroundColor Green
                return $true
            } catch {
                Write-Host "Warning: Failed to fix desktop shortcut: $_" -ForegroundColor Yellow
                return $false
            }
        } else {
            # Shortcut exists and is correct, skip
            Write-Host "Desktop shortcut already exists and is correct: $shortcutName" -ForegroundColor Cyan
            return $false
        }
    }
}

# Execute main function
Check-AndEnsureShortcut

