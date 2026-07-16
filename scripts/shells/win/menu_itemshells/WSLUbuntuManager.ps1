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
$script:WSL_INSTALL_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step30_InstallWSLUbuntu24.ps1"

# Import required modules
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")

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
    }

    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Get-InstalledUbuntuDistros {
    try {
        $wslList = & wsl --list 2>&1
        if ($wslList) {
            $ubuntuDistros = @()
            foreach ($line in $wslList) {
                $lineStr = $line.ToString()
                $cleanLine = $lineStr -replace '\x00', '' | ForEach-Object { $_.Trim() }

                if ($cleanLine.IndexOf("Ubuntu") -ge 0 -and $cleanLine.IndexOf("24") -ge 0) {
                    $distroName = ($cleanLine -split '\s+')[0]
                    if ($distroName -and $distroName -ne "" -and $distroName -ne "NAME") {
                        $ubuntuDistros += $distroName
                    }
                }
            }
            return ,$ubuntuDistros
        }
    } catch {
        Write-ColorMessage -Message "Error checking installed distros: $_" -Type "Warning"
    }
    return @()
}

function Show-WSLUbuntuStatusHeader {
    $installedDistros = @(Get-InstalledUbuntuDistros)
    Write-Host ""
    Write-ColorMessage -Message "WSL Ubuntu 24 Management" -Type "Info"
    Write-Host ""

    if ($installedDistros -and $installedDistros.Count -gt 0) {
        Write-ColorMessage -Message "Currently installed Ubuntu distributions:" -Type "Info"
        foreach ($distro in $installedDistros) {
            if ($distro -and $distro.Trim() -ne "") {
                Write-Host "  - $distro" -ForegroundColor Green
            }
        }

        Write-Host ""
        Write-ColorMessage -Message "Quick start command for Windows Terminal:" -Type "Info"

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
    } else {
        Write-ColorMessage -Message "No Ubuntu 24 distributions currently installed" -Type "Warning"
    }

    Write-Host ""
    return $installedDistros
}

function Invoke-WSLUbuntu24Management {
    param(
        [Parameter(Mandatory=$true)] [string]$Action
    )

    if (-not (Test-Path $script:WSL_INSTALL_SCRIPT)) {
        Write-ColorMessage -Message "Error: WSL Ubuntu installation script not found at: $script:WSL_INSTALL_SCRIPT" -Type "Error"
        Write-ColorMessage -Message "Please check if the installation scripts are properly configured" -Type "Info"
        return $false
    }

    if ($Action -eq "reinstall") {
        $installedDistros = @(Get-InstalledUbuntuDistros)
        if (-not $installedDistros -or $installedDistros.Count -eq 0) {
            Write-ColorMessage -Message "No Ubuntu installations found. Use Install instead." -Type "Warning"
            return $false
        }

        Write-ColorMessage -Message "WARNING: This will completely remove and reinstall Ubuntu 24!" -Type "Warning"
        Write-ColorMessage -Message "Currently installed distributions will be removed:" -Type "Warning"
        foreach ($distro in $installedDistros) {
            if ($distro -and $distro.Trim() -ne "") {
                Write-Host "  - $distro" -ForegroundColor Red
            }
        }
        Write-Host ""
        $confirmation = Read-Host "Type 'yes' to confirm reinstallation"
        if ($confirmation -ne "yes") {
            Write-ColorMessage -Message "Reinstallation cancelled." -Type "Info"
            return $false
        }
    }

    Write-ColorMessage -Message "Executing WSL Ubuntu 24 script with action: $Action" -Type "Info"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $script:WSL_INSTALL_SCRIPT -Action $Action
    return $true
}

function Show-WSLSubMenu {
    $subItems = @(
        @{
            Text = "Restart Ubuntu 24 (Stop and start)"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                Write-ColorMessage -Message "Restarting Ubuntu 24..." -Type "Info"
                Invoke-WSLUbuntu24Management -Action "restart"
            }
        },
        @{
            Text = "Install Ubuntu 24 (Default installation)"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                Write-ColorMessage -Message "Starting Ubuntu 24 installation..." -Type "Info"
                Invoke-WSLUbuntu24Management -Action "install"
            }
        },
        @{
            Text = "Reinstall Ubuntu 24 (Complete reinstallation)"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                Write-ColorMessage -Message "Starting Ubuntu 24 reinstallation..." -Type "Warning"
                Invoke-WSLUbuntu24Management -Action "reinstall"
            }
        },
        @{ Text = "Back"; Values = @("default"); Key = $null; Action = { return } },
        @{ Text = "Quit"; Values = @("default"); Key = $null; Action = { exit } }
    )

    $selected = 0
    while ($true) {
        Clear-Host
        Show-WSLUbuntuStatusHeader | Out-Null
        Write-ColorMessage -Message "WSL Ubuntu Menu (Up/Down to move, Enter to select)" -Type "Info"
        for ($i = 0; $i -lt $subItems.Count; $i++) {
            $it = $subItems[$i]
            if ($i -eq $selected) {
                Write-Host -NoNewline ">"
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-45}" -f $it.Text)
                Write-Host ""
            } else {
                Write-Host ("  {0,-45}" -f $it.Text)
            }
        }

        try {
            $key = [Console]::ReadKey($true).Key
        } catch {
            Write-ColorMessage -Message "Error: Cannot read console input in this environment, using fallback" -Type "Warning"
            Write-Host "Press Enter to continue or type 'q' to quit: " -NoNewline
            $userInput = Read-Host
            if ($userInput -eq 'q') {
                return
            }
            continue
        }

        switch ($key) {
            'UpArrow'   { if ($selected -gt 0) { $selected-- } else { $selected = $subItems.Count - 1 } }
            'DownArrow' { if ($selected -lt $subItems.Count - 1) { $selected++ } else { $selected = 0 } }
            'Enter' {
                $selectedItem = $subItems[$selected]
                $selectedText = $selectedItem.Text

                if ($selectedText -eq "Back") {
                    $selectedItem.Action.Invoke()
                    return
                }
                if ($selectedText -eq "Quit") {
                    $selectedItem.Action.Invoke()
                    exit
                }

                Clear-Host
                $selectedItem.Action.Invoke()
                Wait-MenuContinue
            }
            'Q' { return }
            'Escape' { return }
        }
    }
}
#endregion

#region Main Execution
if ($MyInvocation.InvocationName -ne '.') {
    try {
        Show-WSLSubMenu
    } catch {
        Write-ColorMessage -Message "An error occurred: $_" -Type "Error"
        Read-Host "Press Enter to exit"
    }
}
#endregion
