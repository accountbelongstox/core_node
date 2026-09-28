<#
.SYNOPSIS
    WSL Debian Management Menu
.DESCRIPTION
    Provides a menu interface for WSL Debian 13 installation, reinstallation, and restart operations
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "install_powershells"
$script:WSL_INSTALL_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step30_InstallWSLDebian13.ps1"
$script:DEBIAN_OS_UPGRADE_MAX_ATTEMPTS = 6
$script:DEBIAN_OS_UPGRADE_LOG_HINT = "/var/log/core_node-os-upgrade.log"
$script:DEBIAN_OS_UPGRADE_SCRIPT = ""

# Import required modules
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
# DockerWslBridge.ps1 is the existing Windows<->WSL bridge library (already
# used by the TTS Docker model runner): reused here for wsl.exe invocation
# (Invoke-DockerBridgeWsl), Windows->WSL path translation (Resolve-WslRepoPath,
# via `wslpath`) and distro termination (Stop-DockerModelWslDistro), instead of
# re-implementing them.
. (Join-Path $script:WIN_COMMON_DIR "DockerWslBridge.ps1")

# Debian OS upgrader (Linux side): scripts/shells/linux/debian/install_shells/
# upgrade_os_to_latest.sh (multi-hop, --status/--resume; the old single-hop
# upgrade_to_debian_13.sh was removed, no fallback). Presence is still checked
# with Test-Path on every run in Get-DebianOsUpgradeScriptPath (never assumed).
# Built only after $Global:CORE_NODE_DIR (from GlobalVars.ps1, imported above)
# is available.
$script:DEBIAN_OS_UPGRADE_SCRIPT = Join-Path (Join-Path (Join-Path (Join-Path (Join-Path $Global:CORE_NODE_DIR "scripts") "shells") "linux") "debian") (Join-Path "install_shells" "upgrade_os_to_latest.sh")

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

function Get-InstalledDebianDistros {
    try {
        $wslList = & wsl --list 2>&1
        if ($wslList) {
            $debianDistros = @()
            foreach ($line in $wslList) {
                $lineStr = $line.ToString()
                $cleanLine = $lineStr -replace '\x00', '' | ForEach-Object { $_.Trim() }

                if ($cleanLine.IndexOf("Debian") -ge 0) {
                    $distroName = ($cleanLine -split '\s+')[0]
                    if ($distroName -and $distroName -ne "" -and $distroName -ne "NAME") {
                        $debianDistros += $distroName
                    }
                }
            }
            return ,$debianDistros
        }
    } catch {
        Write-ColorMessage -Message "Error checking installed distros: $_" -Type "Warning"
    }
    return @()
}

function Show-WSLDebianStatusHeader {
    $installedDistros = @(Get-InstalledDebianDistros)
    Write-Host ""
    Write-ColorMessage -Message "WSL Debian 13 Management" -Type "Info"
    Write-Host ""

    if ($installedDistros -and $installedDistros.Count -gt 0) {
        Write-ColorMessage -Message "Currently installed Debian distributions:" -Type "Info"
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
        Write-ColorMessage -Message "No Debian 13 distributions currently installed" -Type "Warning"
    }

    Write-Host ""
    return $installedDistros
}

function Invoke-WSLDebian13Management {
    param(
        [Parameter(Mandatory=$true)] [string]$Action
    )

    if (-not (Test-Path $script:WSL_INSTALL_SCRIPT)) {
        Write-ColorMessage -Message "Error: WSL Debian installation script not found at: $script:WSL_INSTALL_SCRIPT" -Type "Error"
        Write-ColorMessage -Message "Please check if the installation scripts are properly configured" -Type "Info"
        return $false
    }

    if ($Action -eq "reinstall") {
        $installedDistros = @(Get-InstalledDebianDistros)
        if (-not $installedDistros -or $installedDistros.Count -eq 0) {
            Write-ColorMessage -Message "No Debian installations found. Use Install instead." -Type "Warning"
            return $false
        }

        Write-ColorMessage -Message "WARNING: This will completely remove and reinstall Debian 13!" -Type "Warning"
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

    Write-ColorMessage -Message "Executing WSL Debian 13 script with action: $Action" -Type "Info"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $script:WSL_INSTALL_SCRIPT -Action $Action
    return $true
}

function Get-DebianOsUpgradeScriptPath {
    if (Test-Path -LiteralPath $script:DEBIAN_OS_UPGRADE_SCRIPT -PathType Leaf) {
        return $script:DEBIAN_OS_UPGRADE_SCRIPT
    }
    return $null
}

# True when /etc/wsl.conf inside the distro has systemd=true under [boot].
# Informational only here -- when true, a Linux-side resume systemd unit (if
# the upgrader registers one) also continues the upgrade after the distro
# restarts; this menu still drives the retry loop explicitly either way, so
# the upgrade completes even when systemd is not enabled in WSL.
function Test-WslDistroSystemdEnabled {
    param([Parameter(Mandatory = $true)][string]$Distro)
    $lines = @()
    $inBootSection = $false

    $lines = Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'cat', '/etc/wsl.conf') -QuietErrors
    foreach ($rawLine in @($lines)) {
        $line = (ConvertFrom-DockerBridgeWslText $rawLine).Trim()
        if ($line -match '^\[(?<section>[^\]]+)\]$') {
            $inBootSection = ($Matches['section'] -ieq 'boot')
            continue
        }
        if ($inBootSection -and $line -match '^systemd\s*=\s*true\s*$') {
            return $true
        }
    }
    return $false
}

# Reads `bash upgrade_os_to_latest.sh --status` (read-only; prints raw
# key=value lines from /var/lib/core_node/os-upgrade/state, nothing when no
# upgrade is in progress) and returns it as a hashtable. Never inspects the
# wsl.exe exit code -- STATUS/CURRENT/TARGET/ATTEMPTS are the only contract.
function Get-DebianOsUpgradeStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Distro,
        [Parameter(Mandatory = $true)][string]$ScriptWslPath
    )
    $lines = @()
    $statusTable = @{}
    $separatorIndex = -1
    $key = ''
    $value = ''

    $lines = Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'bash', $ScriptWslPath, '--status') -QuietErrors
    foreach ($rawLine in @($lines)) {
        $line = (ConvertFrom-DockerBridgeWslText $rawLine).Trim()
        if (-not $line) { continue }
        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -lt 1) { continue }
        $key = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()
        $statusTable[$key] = $value
    }
    return $statusTable
}

# Runs the Linux Debian OS upgrader (Get-DebianOsUpgradeScriptPath) inside the
# given distro as root, then drives it to completion purely off its --status
# contract (STATUS=in-progress|reboot-required|failed|done, plus
# CURRENT/TARGET/ATTEMPTS) -- never off a wsl.exe exit code (AGENTS.md: exit
# codes are not a return-value contract).
#
# Flow: the first invocation is interactive and streamed to the console (the
# upgrader itself asks the user to type UPGRADE to confirm); after that this
# loop reads --status: reboot-required terminates the distro (WSL has no real
# reboot) and resumes with --resume; done, or no state at all (the upgrader
# cleans up its own state file on done), means finished; failed stops with an
# error. Capped at DEBIAN_OS_UPGRADE_MAX_ATTEMPTS resume hops.
function Invoke-WSLDebianOsUpgrade {
    param([Parameter(Mandatory = $true)][string]$Distro)

    $scriptWindowsPath = ''
    $scriptWslPath = $null
    $systemdEnabled = $false
    $hop = 0
    $statusTable = $null
    $upgradeStatus = ''
    $versionId = ''

    $scriptWindowsPath = Get-DebianOsUpgradeScriptPath
    if (-not $scriptWindowsPath) {
        Write-ColorMessage -Message "OS upgrade script not found: $script:DEBIAN_OS_UPGRADE_SCRIPT" -Type "Error"
        return $false
    }
    Write-ColorMessage -Message "Using Linux upgrader: $scriptWindowsPath" -Type "Info"

    $scriptWslPath = Resolve-WslRepoPath -Distro $Distro -WindowsPath $scriptWindowsPath
    if (-not $scriptWslPath) {
        Write-ColorMessage -Message "Failed to resolve the WSL path for the upgrader inside distro '$Distro' (is it running?)." -Type "Error"
        return $false
    }

    $systemdEnabled = Test-WslDistroSystemdEnabled -Distro $Distro
    if ($systemdEnabled) {
        Write-ColorMessage -Message "systemd=true in /etc/wsl.conf [boot]: a Linux-side resume unit (if registered) also continues the upgrade after a distro restart." -Type "Info"
    } else {
        Write-ColorMessage -Message "systemd is not enabled in /etc/wsl.conf [boot]; this menu drives the resume loop by re-running the upgrader with --resume." -Type "Info"
    }

    # First run: interactive, streamed straight to the console -- the
    # upgrader prompts the user to type UPGRADE before it touches anything.
    Write-ColorMessage -Message "wsl -d $Distro -u root -- bash $scriptWslPath" -Type "Info"
    Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'bash', $scriptWslPath) | Out-Host

    while ($true) {
        $statusTable = Get-DebianOsUpgradeStatus -Distro $Distro -ScriptWslPath $scriptWslPath
        $upgradeStatus = [string]$statusTable['STATUS']

        if (-not $upgradeStatus -or $upgradeStatus -eq 'done') {
            $versionId = Get-WslDistroVersionId -Distro $Distro
            Write-ColorMessage -Message "OS upgrade finished (distro '$Distro' VERSION_ID=$versionId)." -Type "Success"
            return $true
        }

        if ($upgradeStatus -eq 'failed') {
            Write-ColorMessage -Message "STATUS=failed (CURRENT=$($statusTable['CURRENT']) TARGET=$($statusTable['TARGET']) ATTEMPTS=$($statusTable['ATTEMPTS'])). Check $script:DEBIAN_OS_UPGRADE_LOG_HINT inside the distro." -Type "Error"
            return $false
        }

        if ($hop -ge $script:DEBIAN_OS_UPGRADE_MAX_ATTEMPTS) {
            Write-ColorMessage -Message "STATUS=$upgradeStatus after $($script:DEBIAN_OS_UPGRADE_MAX_ATTEMPTS) resume hop(s); giving up here. Check $script:DEBIAN_OS_UPGRADE_LOG_HINT inside the distro, then re-run this menu item to resume." -Type "Error"
            return $false
        }
        $hop++

        if ($upgradeStatus -eq 'reboot-required') {
            Write-ColorMessage -Message "STATUS=reboot-required (hop $hop/$($script:DEBIAN_OS_UPGRADE_MAX_ATTEMPTS), CURRENT=$($statusTable['CURRENT']) TARGET=$($statusTable['TARGET'])); terminating and resuming the distro..." -Type "Warning"
            Stop-DockerModelWslDistro -Distro $Distro -Prefix "[wsl-os-upgrade]"
        } else {
            Write-ColorMessage -Message "STATUS=$upgradeStatus (hop $hop/$($script:DEBIAN_OS_UPGRADE_MAX_ATTEMPTS)); resuming without a distro restart..." -Type "Warning"
        }

        Write-ColorMessage -Message "wsl -d $Distro -u root -- bash $scriptWslPath --resume" -Type "Info"
        Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'bash', $scriptWslPath, '--resume') | Out-Host
    }
}

function Show-WSLSubMenu {
    $subItems = @(
        @{
            Text = "Restart Debian 13 (Stop and start)"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                Write-ColorMessage -Message "Restarting Debian 13..." -Type "Info"
                Invoke-WSLDebian13Management -Action "restart"
            }
        },
        @{
            Text = "Install Debian 13 (Default installation)"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                Write-ColorMessage -Message "Starting Debian 13 installation..." -Type "Info"
                Invoke-WSLDebian13Management -Action "install"
            }
        },
        @{
            Text = "Reinstall Debian 13 (Complete reinstallation)"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                Write-ColorMessage -Message "Starting Debian 13 reinstallation..." -Type "Warning"
                Invoke-WSLDebian13Management -Action "reinstall"
            }
        },
        @{
            Text = "Upgrade WSL Debian -> latest"
            Values = @("default")
            CurrentValueIndex = 0
            Key = $null
            Action = {
                $upgradeDistros = @(Get-InstalledDebianDistros)
                $upgradeTargetDistro = ''

                if (-not $upgradeDistros -or $upgradeDistros.Count -eq 0) {
                    Write-ColorMessage -Message "No Debian distributions found. Install one first." -Type "Warning"
                    return
                }
                if ($upgradeDistros.Count -eq 1) {
                    $upgradeTargetDistro = $upgradeDistros[0]
                } else {
                    Write-ColorMessage -Message "Multiple Debian distributions found:" -Type "Info"
                    foreach ($distroOption in $upgradeDistros) { Write-Host "  - $distroOption" }
                    $upgradeTargetDistro = Read-Host "Distro to upgrade"
                    if ($upgradeDistros -notcontains $upgradeTargetDistro) {
                        Write-ColorMessage -Message "Unknown distro: $upgradeTargetDistro" -Type "Error"
                        return
                    }
                }

                Write-ColorMessage -Message "This runs the Linux OS upgrader inside '$upgradeTargetDistro' as root (in-place, official upgrade path)." -Type "Warning"
                $upgradeConfirmation = Read-Host "Type 'yes' to start the OS upgrade"
                if ($upgradeConfirmation -ne "yes") {
                    Write-ColorMessage -Message "OS upgrade cancelled." -Type "Info"
                    return
                }

                Invoke-WSLDebianOsUpgrade -Distro $upgradeTargetDistro | Out-Null
            }
        },
        @{ Text = "Back"; Values = @("default"); Key = $null; Action = { return } },
        @{ Text = "Quit"; Values = @("default"); Key = $null; Action = { exit } }
    )

    $selected = 0
    while ($true) {
        Clear-Host
        Show-WSLDebianStatusHeader | Out-Null
        Write-ColorMessage -Message "WSL Debian Menu (Up/Down to move, Enter to select)" -Type "Info"
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
