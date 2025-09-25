# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    WSL Ubuntu Management Menu
.DESCRIPTION
    Provides a menu interface for WSL Ubuntu 24 installation, reinstallation, and restart operations
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "install_powershells"

# Import required modules
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommanFunc.ps1")

$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
#endregion

#region Helper Functions
function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter()] [string]$Type = "Info"
    )
    
    $color = $script:COLOR_INFO
    $prefix = "[*] "
    
    if ($Type -eq "Success") {
        $color = $script:COLOR_SUCCESS
        $prefix = "[+] "
    } elseif ($Type -eq "Warning") {
        $color = $script:COLOR_WARNING
        $prefix = "[!] "
    } elseif ($Type -eq "Error") {
        $color = $script:COLOR_ERROR
        $prefix = "[X] "
    } elseif ($Type -eq "Info") {
        $prefix = "[*] "
    } else {
        $prefix = "[*] "
    }
    
    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Get-InstalledUbuntuDistros {
    try {
        $wslList = & wsl --list 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ubuntuDistros = @()
            foreach ($line in $wslList) {
                # Convert to string and handle UTF-16 encoding issues
                $lineStr = $line.ToString()

                # Remove null characters and trim
                $cleanLine = $lineStr -replace '\x00', '' | ForEach-Object { $_.Trim() }

                # Match Ubuntu 24 patterns
                if ($cleanLine.IndexOf("Ubuntu") -ge 0 -and $cleanLine.IndexOf("24") -ge 0) {
                    # Extract just the distribution name (first word)
                    $distroName = ($cleanLine -split '\s+')[0]
                    if ($distroName -and $distroName -ne "" -and $distroName -ne "NAME") {
                        $ubuntuDistros += $distroName
                    }
                }
            }
            return ,$ubuntuDistros  # Force return as array
        }
    } catch {
        Write-ColorMessage -Message "Error checking installed distros: $_" -Type "Warning"
    }
    return @()
}

function Show-WSLSubMenu {
    Clear-Host
    Write-ColorMessage -Message "WSL Ubuntu 24 Management" -Type "Info"
    Write-Host ""

    # Check current Ubuntu installations
    $installedDistros = @(Get-InstalledUbuntuDistros)
    if ($installedDistros -and $installedDistros.Count -gt 0) {
        Write-ColorMessage -Message "Currently installed Ubuntu distributions:" -Type "Info"
        foreach ($distro in $installedDistros) {
            if ($distro -and $distro.Trim() -ne "") {
                Write-Host "  - $distro" -ForegroundColor Green
            }
        }

        Write-Host ""
        Write-ColorMessage -Message "Quick start command for Windows Terminal:" -Type "Info"

        # Convert Windows path to WSL path (D:\programing\core_node -> /mnt/d/programing/core_node)
        $coreNodePath = $Global:CORE_NODE_DIR -replace '\\', '/'
        $coreNodePath = $coreNodePath -replace '^([A-Z]):', '/mnt/$1'
        $coreNodePath = $coreNodePath.ToLower()

        foreach ($distro in $installedDistros) {
            if ($distro -and $distro.Trim() -ne "") {
                $quickStartCmd = "wsl.exe -d $distro --cd `"$coreNodePath`""
                Write-Host "  $quickStartCmd" -ForegroundColor Yellow
            }
        }

        Write-Host "  (Add this command to Windows Terminal for quick access)" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-ColorMessage -Message "No Ubuntu 24 distributions currently installed" -Type "Warning"
        Write-Host ""
    }

    Write-Host "1. Restart Ubuntu 24 (Stop and start)"
    Write-Host "2. Install Ubuntu 24 (Default installation)"
    Write-Host "3. Reinstall Ubuntu 24 (Complete reinstallation)"
    Write-Host "4. Return to main menu"
    Write-Host ""

    $userChoice = Read-Host "Please select an option (1-4)"

    switch ($userChoice) {
        "1" {
            Write-ColorMessage -Message "Restarting Ubuntu 24..." -Type "Info"
            Invoke-WSLInstallScript -Action "restart"
        }
        "2" {
            Write-ColorMessage -Message "Starting Ubuntu 24 installation..." -Type "Info"
            Invoke-WSLInstallScript -Action "install"
        }
        "3" {
            if ($installedDistros -and $installedDistros.Count -gt 0) {
                Write-ColorMessage -Message "WARNING: This will completely remove and reinstall Ubuntu 24!" -Type "Warning"
                Write-ColorMessage -Message "Currently installed distributions will be removed:" -Type "Warning"
                foreach ($distro in $installedDistros) {
                    if ($distro -and $distro.Trim() -ne "") {
                        Write-Host "  - $distro" -ForegroundColor Red
                    }
                }
                Write-Host ""
                $confirmation = Read-Host "Type 'yes' to confirm reinstallation"
                if ($confirmation -eq "yes") {
                    Write-ColorMessage -Message "Starting Ubuntu 24 reinstallation..." -Type "Warning"
                    Invoke-WSLInstallScript -Action "reinstall"
                } else {
                    Write-ColorMessage -Message "Reinstallation cancelled." -Type "Info"
                    Start-Sleep -Seconds 2
                    Show-WSLSubMenu
                }
            } else {
                Write-ColorMessage -Message "No Ubuntu installations found. Use 'Install' instead." -Type "Warning"
                Start-Sleep -Seconds 2
                Show-WSLSubMenu
            }
        }
        "4" {
            Write-ColorMessage -Message "Returning to main menu..." -Type "Info"
            return
        }
        default {
            Write-ColorMessage -Message "Invalid selection. Please try again." -Type "Error"
            Start-Sleep -Seconds 2
            Show-WSLSubMenu
        }
    }
}

function Invoke-WSLInstallScript {
    param(
        [Parameter(Mandatory=$true)] [string]$Action
    )
    
    $installScript = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step81_InstallWSLUbuntu24.ps1"
    
    if (Test-Path $installScript) {
        Write-ColorMessage -Message "Executing WSL Ubuntu 24 script with action: $Action" -Type "Info"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $installScript -Action $Action
    } else {
        Write-ColorMessage -Message "Error: WSL Ubuntu installation script not found at: $installScript" -Type "Error"
        Write-ColorMessage -Message "Please check if the installation scripts are properly configured" -Type "Info"
    }
    
    Write-Host ""
    Read-Host "Press Enter to return to WSL menu"
    Show-WSLSubMenu
}
#endregion

#region Main Execution
try {
    Show-WSLSubMenu
} catch {
    Write-ColorMessage -Message "An error occurred: $_" -Type "Error"
    Read-Host "Press Enter to exit"
}
#endregion
