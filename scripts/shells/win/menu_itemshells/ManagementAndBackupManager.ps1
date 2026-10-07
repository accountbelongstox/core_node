<#
.SYNOPSIS
    Management & Backup Menu
.DESCRIPTION
    Numbered menu: remote control first, then Windows tools and core_node backup
    (BackupManager.ps1); every level uses Show-NumberedMenu (CommonFunc.ps1).
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:SHELLS_DIR = Split-Path (Split-Path $script:PS_CURRENT_DIR -Parent) -Parent
$script:INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "install_powershells"
$script:TOOLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "tools"
$script:ANDROID_STABLE_LAUNCHER = Join-Path $script:TOOLS_DIR "AndroidEmulatorStableLauncher.ps1"
$script:EXTEND_WINDOWS_UPDATE_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step15_ExtendWindowsUpdate.ps1"
$script:APP_INSTALL_MENU_SCRIPT = Join-Path $script:PS_CURRENT_DIR "AppInstallMenu.ps1"
$script:SCRIPTS_ROOT_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:CHROME_REPAIR_SCRIPT = Join-Path $script:SCRIPTS_ROOT_DIR "chromefix\repair-chrome-crash.ps1"
$script:USER_PROFILE_PATH_MAPPING_SCRIPT = Join-Path $script:PS_CURRENT_DIR "UserProfilePathMapping.ps1"
$script:WSL_DEBIAN_MANAGER_SCRIPT = Join-Path $script:PS_CURRENT_DIR "WSLDebianManager.ps1"
$script:DISK_REPAIR_SCRIPT = Join-Path $script:PS_CURRENT_DIR "DiskRepairManager.ps1"
$script:DUAL_BOOT_READINESS_SCRIPT = Join-Path $script:PS_CURRENT_DIR "DualBootReadinessManager.ps1"
$script:FILE_RECOVERY_SCRIPT = Join-Path $script:PS_CURRENT_DIR "FileRecoveryManager.ps1"
$script:DESKTOP_ICON_MANAGER_SCRIPT = Join-Path $script:WIN_COMMON_DIR "DesktopIconManager.ps1"
$script:DESKTOP_ICON_ACTIONS = @{ "organize" = "Organize"; "preview" = "Preview"; "undo" = "Undo" }
$script:TAILSCALE_COMMON_SCRIPT = Join-Path $script:WIN_COMMON_DIR "TailscaleCommon.ps1"
$script:BACKUP_ACTIONS_SCRIPT = Join-Path $script:PS_CURRENT_DIR "BackupManager.ps1"
$script:REMOTE_CONTROL_COMMON_SCRIPT = Join-Path $script:WIN_COMMON_DIR "RemoteControlCommon.ps1"
$script:REMOTE_CONTROL_HOST_PREINSTALL_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step72_InstallRemoteControlHost.ps1"
$script:NETWORK_ROUTER_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step73_InstallNetworkRouter.ps1"

# Import required modules
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. $script:BACKUP_ACTIONS_SCRIPT
# Dot-sourced (not subprocess-invoked) so the "[T] Tailscale" quick entry can
# show live state in its label and open Show-TailscaleQuickMenu in-process,
# same as the "Path Mapping" entry below reuses UserProfilePathMapping.ps1.
. $script:TAILSCALE_COMMON_SCRIPT
$script:CHROME_REPAIR_SCRIPT_FALLBACK = Join-Path (Join-Path $Global:CORE_NODE_DATA_DIR 'scripts\chromefix') 'repair-chrome-crash.ps1'
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
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
        $prefix = "[-] "
    }

    Write-Host "$prefix$Message" -ForegroundColor $color
}

# Child PowerShell in the same console. Start-Process keeps the child's stderr
# out of this process, so ErrorActionPreference=Stop cannot abort the menu.
function Invoke-ConsoleScript {
    param(
        [Parameter(Mandatory=$true)] [string]$ScriptPath,
        [Parameter()] [string[]]$ScriptArguments = @()
    )

    Start-Process -FilePath "powershell.exe" -ArgumentList (@("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $ScriptPath)) + $ScriptArguments) -NoNewWindow -Wait
}

function Show-WindowsSystemInfoHeader {
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $computerInfo = Get-CimInstance Win32_ComputerSystem

    Write-ColorMessage -Message ("{0} {1} (Build {2}, {3}) | {4} | {5} GB RAM | {6} {7}" -f $osInfo.Caption, $osInfo.Version, $osInfo.BuildNumber, $osInfo.OSArchitecture, $computerInfo.Name, [math]::Round($computerInfo.TotalPhysicalMemory / 1GB, 2), $computerInfo.Manufacturer, $computerInfo.Model) -Type "Info"
}
function Show-DetailedSystemInfo {
    $os = $null
    $cs = $null

    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $cs = Get-CimInstance Win32_ComputerSystem
        Write-Host "OS Name:                   $($os.Caption)"
        Write-Host "OS Version:                $($os.Version) Build $($os.BuildNumber)"
        Write-Host "System Type:               $($os.OSArchitecture)"
        Write-Host "Computer Name:             $($cs.Name)"
        Write-Host "Total Physical Memory:     $([math]::Round($cs.TotalPhysicalMemory / 1MB, 2)) MB"
        Write-Host "Available Physical Memory: $([math]::Round($os.FreePhysicalMemory / 1KB, 2)) MB"
    } catch {
        Write-ColorMessage -Message "Failed to get system info: $_" -Type "Error"
    }
}

function Invoke-ChromeRepair {
    $repairScript = $script:CHROME_REPAIR_SCRIPT

    if (-not (Test-Path $repairScript)) { $repairScript = $script:CHROME_REPAIR_SCRIPT_FALLBACK }
    if (Test-Path $repairScript) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $repairScript
    } else {
        Write-ColorMessage -Message "Chrome repair script not found: $repairScript" -Type "Error"
    }
}

function Invoke-DesktopIconAction {
    param([Parameter(Mandatory = $true)][string]$DesktopIconMode)

    & powershell -NoProfile -ExecutionPolicy Bypass -File $script:DESKTOP_ICON_MANAGER_SCRIPT -DesktopIconAction $script:DESKTOP_ICON_ACTIONS[$DesktopIconMode]
}
#endregion

#region Menu System
function Show-SystemToolsMenu {
    Show-NumberedMenu -Title "Management & Backup > System Tools" -Items @(
        @{ Text = "Display system information"; Action = { Show-DetailedSystemInfo } },
        @{ Text = "One-click: organize desktop icons"; Action = { Invoke-DesktopIconAction -DesktopIconMode "organize" } },
        @{ Text = "Extend Windows Update pause days"; Action = {
                if (Test-Path $script:EXTEND_WINDOWS_UPDATE_SCRIPT) { & $script:EXTEND_WINDOWS_UPDATE_SCRIPT } else { Write-ColorMessage -Message "Step15 script not found at: $script:EXTEND_WINDOWS_UPDATE_SCRIPT" -Type "Error" }
            } },
        @{ Text = "Repair disk (chkdsk /f)"; Action = { Invoke-ConsoleScript -ScriptPath $script:DISK_REPAIR_SCRIPT } },
        @{ Text = "File recovery (winfr / DMDE)"; Submenu = $true; Action = { Invoke-ConsoleScript -ScriptPath $script:FILE_RECOVERY_SCRIPT } },
        @{ Text = "Repair Chrome crash (PUP + compat shim / 0xC0000409)"; Action = { Invoke-ChromeRepair } },
        @{ Text = "Linux dual boot readiness (Fast Startup)"; Action = { Invoke-ConsoleScript -ScriptPath $script:DUAL_BOOT_READINESS_SCRIPT } },
        @{ Text = "Network router (USB uplink NAT gateway / ICS)"; Submenu = $true; Action = { Invoke-ConsoleScript -ScriptPath $script:NETWORK_ROUTER_SCRIPT -ScriptArguments @("menu") } }
    )
}

function Show-AppsAndEnvironmentMenu {
    Show-NumberedMenu -Title "Management & Backup > Apps & Environment" -Items @(
        @{ Text = "App install"; Submenu = $true; Action = { & $script:APP_INSTALL_MENU_SCRIPT } },
        @{ Text = "WSL Debian management"; Submenu = $true; Action = { & powershell -NoProfile -ExecutionPolicy Bypass -File $script:WSL_DEBIAN_MANAGER_SCRIPT } },
        @{ Text = "Start Android emulator (stable)"; Action = { & powershell -NoProfile -ExecutionPolicy Bypass -File $script:ANDROID_STABLE_LAUNCHER } },
        @{ Text = "Path mapping (.cursor / .devin)"; Submenu = $true; Action = { . $script:USER_PROFILE_PATH_MAPPING_SCRIPT; Show-UserProfilePathMappingMenu } },
        @{ Text = "Organize desktop icons"; Submenu = $true; Action = { Show-DesktopIconMenu } }
    )
}

function Show-DesktopIconMenu {
    Show-NumberedMenu -Title "Management & Backup > Apps & Environment > Organize Desktop Icons" -Items @(
        @{ Text = "Organize"; Action = { Invoke-DesktopIconAction -DesktopIconMode "organize" } },
        @{ Text = "Preview (no changes)"; Action = { Invoke-DesktopIconAction -DesktopIconMode "preview" } },
        @{ Text = "Undo last organize"; Action = { Invoke-DesktopIconAction -DesktopIconMode "undo" } }
    )
}

function Show-CoreNodeBackupMenu {
    Show-NumberedMenu -Title "Management & Backup > Backup core_node" -Items @(
        @{ Text = "Backup core_node"; NoPause = $true; Action = { Backup-CurrentProject } },
        @{ Text = "List core_node backups"; NoPause = $true; Action = { List-CurrentProjectBackups } },
        @{ Text = "Restore core_node backup"; NoPause = $true; Action = { Restore-CurrentProject } }
    )
}

function Show-ManagementAndBackupMenu {
    Show-NumberedMenu -Title "Management & Backup" -AllowQuit -Header { Show-WindowsSystemInfoHeader } -Items @(
        @{ Text = "-- Remote control (Linux <-> this PC) --"; IsHeader = $true },
        @{ Text = "One-click: allow Linux to control this PC (VNC shared desktop)"; Action = { Invoke-ConsoleScript -ScriptPath $script:REMOTE_CONTROL_HOST_PREINSTALL_SCRIPT } },
        @{ Text = "Remote control (connect, status, diagnostics, help)"; Submenu = $true; Action = { Invoke-ConsoleScript -ScriptPath $script:REMOTE_CONTROL_COMMON_SCRIPT -ScriptArguments @("-Action", "Menu") } },
        @{ Label = { "Tailscale [{0}]" -f (Get-TailscaleQuickEntryLabel) }; Submenu = $true; Action = { Show-TailscaleQuickMenu } },
        @{ Text = "Claude peer link (Tailscale)"; Action = { Invoke-ConsoleScript -ScriptPath $script:REMOTE_CONTROL_COMMON_SCRIPT -ScriptArguments @("-Action", "ClaudePeer") } },
        @{ Text = "-- Windows --"; IsHeader = $true },
        @{ Text = "System tools"; Submenu = $true; Action = { Show-SystemToolsMenu } },
        @{ Text = "Apps & environment"; Submenu = $true; Action = { Show-AppsAndEnvironmentMenu } },
        @{ Text = "-- Backup --"; IsHeader = $true },
        @{ Text = "Backup core_node"; Submenu = $true; Action = { Show-CoreNodeBackupMenu } }
    )
}
#endregion

#region Main Execution
Show-ManagementAndBackupMenu
#endregion
