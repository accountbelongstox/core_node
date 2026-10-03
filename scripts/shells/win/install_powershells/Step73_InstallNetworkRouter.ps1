# NAT gateway (network router): when a USB network adapter is the uplink, Internet Connection
# Sharing relays it (NAT + DHCP) through an onboard port to another computer or router.
# Installed as the ncore-natgateway NSSM service; this script is also the CLI and menu.
# Windows counterpart of scripts/shells/linux/debian/install_shells/113_natgateway.sh.
# Engine: win_common/NatGatewayCommon.ps1; service body: win_common/NatGatewayMonitor.ps1.
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Command = '',
    [Parameter(Position = 1)][string]$Value = '',
    [Parameter(Position = 2)][string]$Ports = '',
    [switch]$Yes,
    [switch]$PauseAtEnd
)

$STEP73_SCRIPT_INDEX = '[Step73-NetworkRouter]'
$STEP73_SCRIPT_PATH = $PSCommandPath
$STEP73_WIN_COMMON_DIR = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$STEP73_REPO_ROOT_DIR = Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent
$STEP73_MONITOR_SCRIPT = Join-Path $STEP73_WIN_COMMON_DIR 'NatGatewayMonitor.ps1'
$STEP73_POWERSHELL_EXE = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$STEP73_INSTALL_FLAG_KEY = 'INSTALL_NETWORK_ROUTER'
$STEP73_MENU_PATH_HINT = 'dd.cmd > Management & Backup > System Tools > Network router'
$STEP73_NO_ADMIN_COMMANDS = @('help', 'status', 'ports', 'logs', 'set-wan', 'set-lan', 'set-address', 'set-dhcp')
$STEP73_LOG_TAIL_LINES = 80
$STEP73_CONFIG_FILE = ''
$STEP73_LOG_FILE = ''
$STEP73_MENU_PICK = ''

. (Join-Path $STEP73_WIN_COMMON_DIR 'GlobalVars.ps1')
. (Join-Path $STEP73_WIN_COMMON_DIR 'CommonFunc.ps1')
. (Join-Path $STEP73_WIN_COMMON_DIR 'NssmServiceManager.ps1')
. (Join-Path $STEP73_WIN_COMMON_DIR 'NatGatewayCommon.ps1')

$STEP73_CONFIG_FILE = Join-Path (Join-Path $Global:CORE_NODE_DATA_DIR 'natgateway') 'router.conf'
$STEP73_LOG_FILE = Join-Path $Global:LOGS_DIR 'ncore-natgateway.log'
Initialize-NatGateway -ConfigFile $STEP73_CONFIG_FILE

function Show-NetworkRouterUsage {
    Write-Host @"
Usage: Step73_InstallNetworkRouter.ps1 [command] [value] [ports] [-Yes]

  (no command)               Install chain step (governed by $STEP73_INSTALL_FLAG_KEY)
  menu                       Interactive menu
  install [-Yes]             Install/repair the $script:NatGwServiceName background service
  uninstall [-Yes]           Stop and remove the service, disable sharing (configuration is kept)
  status                     Configuration, service state, ICS pair and relay clients
  ports                      Detected ports and their current role
  set-wan usb|<adapter>      Uplink: any USB adapter (default) or a named adapter
  set-lan all                Relay on the first onboard wired port with link (a Network Bridge first)
  set-lan one <adapter>      Relay on one port
  set-lan list "<a1>,<a2>"   Relay on the first listed port with link
  set-address <a.b.c.d/24>   Gateway address of the relay network (default $script:NatGwDefaultAddress)
  set-dhcp on|off            ICS always serves DHCP/DNS; off is not available on Windows
  start | stop | restart     Control the background service (stop also disables sharing)
  logs                       Recent service logs

Changes are picked up by the running service within $script:NatGwPollSeconds seconds.
Menu: $STEP73_MENU_PATH_HINT
"@
}

function Confirm-NetworkRouter {
    param([string]$Question, [bool]$DefaultYes)
    if ($Yes) { return $true }
    if ($DefaultYes) { return (Read-YesNoDefaultYes -Message $Question) }
    return (Read-YesNoDefaultNo -Message $Question)
}

function Get-NetworkRouterServiceState {
    return (Get-ServiceRunState -ServiceName $script:NatGwServiceName)
}

function Test-NetworkRouterServiceCurrent {
    $parametersKey = Join-Path (Join-Path 'HKLM:\SYSTEM\CurrentControlSet\Services' $script:NatGwServiceName) 'Parameters'
    $parameters = Get-ItemProperty -LiteralPath $parametersKey -Name 'AppParameters' -ErrorAction SilentlyContinue
    if (-not $parameters) { return $false }
    return ([string]$parameters.AppParameters -like "*$STEP73_MONITOR_SCRIPT*" -and
        [string]$parameters.AppParameters -like "*$STEP73_CONFIG_FILE*" -and
        (Get-NetworkRouterServiceState) -eq 'running')
}

function Save-NetworkRouterConfig {
    Save-NatGwConfig
    Write-ColorMessage ('Saved: WAN_SELECT={0} LAN_MODE={1} LAN_PORTS={2} LAN_ADDRESS={3}' -f $script:NatGwConfig.WAN_SELECT,
        $script:NatGwConfig.LAN_MODE, $(if ($script:NatGwConfig.LAN_PORTS) { $script:NatGwConfig.LAN_PORTS } else { '-' }), $script:NatGwConfig.LAN_ADDRESS) -Type 'Success'
    if ((Get-NetworkRouterServiceState) -eq 'running') {
        Write-ColorMessage "The running service applies it within $script:NatGwPollSeconds seconds." -Type 'Info'
    } else {
        Write-ColorMessage "Service is not running: run 'install' or 'start'." -Type 'Warning'
    }
}

function Install-NetworkRouter {
    $nssmPath = $null
    $arguments = ''
    Write-ColorMessage "$STEP73_SCRIPT_INDEX NAT gateway: install as background service" -Type 'Info'
    Write-Host "Uplink: USB network adapter (auto). Relay: onboard wired port (ICS NAT + DHCP on $script:NatGwDefaultAddress)."
    Write-Host "Ports carrying this machine's own default route are never taken."
    if (-not (Confirm-NetworkRouter -Question 'Install and start the ncore-natgateway background service?' -DefaultYes $true)) {
        Write-ColorMessage 'Installation cancelled' -Type 'Info'
        return
    }
    if (-not (Test-Path -LiteralPath $STEP73_CONFIG_FILE)) {
        Read-NatGwConfig
        Save-NatGwConfig
        Write-ColorMessage "Configuration created: $STEP73_CONFIG_FILE" -Type 'Info'
    }
    Enable-NatGwIcsPersistence

    if (Test-NetworkRouterServiceCurrent) {
        Write-ColorMessage "Service $script:NatGwServiceName already installed and running" -Type 'Success'
    } else {
        $nssmPath = Ensure-Nssm -RepoRootDir $STEP73_REPO_ROOT_DIR
        if (-not $nssmPath) {
            Write-ColorMessage "$STEP73_SCRIPT_INDEX NSSM is required for the background service" -Type 'Error'
            return
        }
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -ConfigFile "{1}"' -f $STEP73_MONITOR_SCRIPT, $STEP73_CONFIG_FILE
        Register-NssmService -NssmPath $nssmPath -ServiceName $script:NatGwServiceName -DisplayName $script:NatGwServiceName `
            -Description 'NAT Gateway (USB uplink relay via Internet Connection Sharing)' -ExePath $STEP73_POWERSHELL_EXE `
            -Arguments $arguments -WorkingDirectory $STEP73_WIN_COMMON_DIR -StdoutLog $STEP73_LOG_FILE -StderrLog $STEP73_LOG_FILE | Out-Null
        if ((Get-NetworkRouterServiceState) -ne 'running') {
            Write-ColorMessage "Service $script:NatGwServiceName failed to start: see $STEP73_LOG_FILE" -Type 'Error'
            return
        }
    }
    Set-GlobalVar -key $STEP73_INSTALL_FLAG_KEY -value 'true' | Out-Null
    Write-ColorMessage "Installed. Use 'status' or 'help' (menu: $STEP73_MENU_PATH_HINT)." -Type 'Success'
}

function Uninstall-NetworkRouter {
    if (-not (Confirm-NetworkRouter -Question 'Remove the ncore-natgateway service and disable sharing?' -DefaultYes $false)) {
        Write-ColorMessage 'Uninstall cancelled' -Type 'Info'
        return
    }
    Remove-NssmService -ServiceName $script:NatGwServiceName | Out-Null
    Clear-NatGwSharing -Reason 'uninstalled'
    Set-GlobalVar -key $STEP73_INSTALL_FLAG_KEY -value 'false' | Out-Null
    Write-ColorMessage "Uninstalled (configuration kept: $STEP73_CONFIG_FILE)" -Type 'Success'
}

function Set-NetworkRouterWan {
    param([string]$Selection)
    if ([string]::IsNullOrWhiteSpace($Selection)) {
        Write-ColorMessage 'Usage: set-wan usb|<adapter>' -Type 'Error'
        return
    }
    Read-NatGwConfig
    $script:NatGwConfig.WAN_SELECT = $Selection.Trim()
    Save-NetworkRouterConfig
}

function Set-NetworkRouterLan {
    param([string]$Mode, [string]$PortList)
    $entries = @()
    $known = @()
    switch ($Mode) {
        'all' { $PortList = '' }
        { $_ -eq 'one' -or $_ -eq 'list' } {
            $entries = @($PortList.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
            if ($entries.Count -eq 0) {
                Write-ColorMessage "Usage: set-lan $Mode <adapter>[,<adapter>...]" -Type 'Error'
                return
            }
            $known = @(Get-NatGwAdapters | ForEach-Object { $_.Name })
            foreach ($entry in $entries) {
                if ($known -notcontains $entry) { Write-ColorMessage "Not present now (used when plugged in): $entry" -Type 'Warning' }
            }
            if ($Mode -eq 'one') { $entries = @($entries[0]) }
            $PortList = $entries -join ','
        }
        default {
            Write-ColorMessage 'Usage: set-lan all | one <adapter> | list "<a1>,<a2>"' -Type 'Error'
            return
        }
    }
    Read-NatGwConfig
    $script:NatGwConfig.LAN_MODE = $Mode
    $script:NatGwConfig.LAN_PORTS = $PortList
    Save-NetworkRouterConfig
}

function Set-NetworkRouterAddress {
    param([string]$Address)
    if (-not (Test-NatGwAddressValid -Address $Address)) {
        Write-ColorMessage 'Usage: set-address a.b.c.d/24 (host part 1-254)' -Type 'Error'
        return
    }
    Read-NatGwConfig
    $script:NatGwConfig.LAN_ADDRESS = $Address
    Save-NetworkRouterConfig
}

function Set-NetworkRouterDhcp {
    param([string]$State)
    switch ($State) {
        'on' { Write-ColorMessage 'DHCP is always on with Internet Connection Sharing' -Type 'Success' }
        'off' { Write-ColorMessage 'Not available on Windows: Internet Connection Sharing always serves DHCP/DNS on the relay port' -Type 'Warning' }
        default { Write-ColorMessage 'Usage: set-dhcp on|off' -Type 'Error' }
    }
}

function Invoke-NetworkRouterService {
    param([string]$Action)
    if ((Get-NetworkRouterServiceState) -eq 'absent') {
        Write-ColorMessage "Service not installed: run 'install'" -Type 'Error'
        return
    }
    switch ($Action) {
        'start' { Start-Service -Name $script:NatGwServiceName -ErrorAction SilentlyContinue }
        'restart' { Restart-Service -Name $script:NatGwServiceName -Force -ErrorAction SilentlyContinue }
        'stop' {
            Stop-Service -Name $script:NatGwServiceName -Force -ErrorAction SilentlyContinue
            Clear-NatGwSharing -Reason 'service stopped'
        }
    }
    Write-ColorMessage "$($script:NatGwServiceName): $(Get-NetworkRouterServiceState)" -Type 'Info'
}

function Show-NetworkRouterLogs {
    if (-not (Test-Path -LiteralPath $STEP73_LOG_FILE)) {
        Write-ColorMessage "No log yet: $STEP73_LOG_FILE" -Type 'Warning'
        return
    }
    Get-Content -LiteralPath $STEP73_LOG_FILE -Tail $STEP73_LOG_TAIL_LINES
}

# Install chain (no command): governed by the INSTALL_NETWORK_ROUTER flag; an existing install is repaired.
function Invoke-NetworkRouterInstallChain {
    $flag = [string](Get-GlobalVar -key $STEP73_INSTALL_FLAG_KEY)
    if ($flag -eq 'true' -or (Get-NetworkRouterServiceState) -ne 'absent') {
        $script:Yes = $true
        Install-NetworkRouter
        return
    }
    Write-ColorMessage "$STEP73_SCRIPT_INDEX Skipping NAT gateway ($STEP73_INSTALL_FLAG_KEY=false). Enable: $STEP73_MENU_PATH_HINT, or run 'install'." -Type 'Info'
}

# ------------------------------------------------------------------ menu ----

function Show-NetworkRouterMenuHeader {
    $applied = Get-NatGwAppliedState -Entries @(Get-NatGwSharingEntries)
    Read-NatGwConfig
    Write-Host ('Service: {0} | State: {1}' -f (Get-NetworkRouterServiceState),
        $(if ($applied.PublicName -and $applied.PrivateName) { "ACTIVE ($($applied.PublicName) -> $($applied.PrivateName))" } else { 'IDLE' }))
    Write-Host ('Uplink: {0} | Relay: {1}{2} | Gateway: {3} | DHCP: always (ICS)' -f $script:NatGwConfig.WAN_SELECT, $script:NatGwConfig.LAN_MODE,
        $(if ($script:NatGwConfig.LAN_PORTS) { " ($($script:NatGwConfig.LAN_PORTS))" } else { '' }), $script:NatGwConfig.LAN_ADDRESS)
}

# Wired ports that can relay (the current uplink is excluded).
function Get-NetworkRouterRelayCandidates {
    $adapters = Get-NatGwAdapters
    Read-NatGwConfig
    Resolve-NatGwWan -Adapters $adapters
    return @($adapters | Where-Object { Test-NatGwLanEligible -Adapter $_ })
}

function Read-NetworkRouterPick {
    param([object[]]$Adapters, [string]$Prompt, [switch]$Multiple)
    $index = 0
    $reply = ''
    $picked = @()
    $script:STEP73_MENU_PICK = ''
    if ($Adapters.Count -eq 0) {
        Write-ColorMessage 'No wired port available' -Type 'Warning'
        return $false
    }
    foreach ($adapter in $Adapters) {
        $index++
        Write-Host ('  {0}) {1} ({2}, link {3}) {4}' -f $index, $adapter.Name, $(if (Test-NatGwUsb -Adapter $adapter) { 'usb' } else { 'onboard' }), $adapter.Status, $adapter.InterfaceDescription)
    }
    $reply = ([string](Read-Host $Prompt)).Trim()
    foreach ($token in @($reply.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
        if ($token -match '^\d+$' -and [int]$token -ge 1 -and [int]$token -le $Adapters.Count) {
            $picked += $Adapters[[int]$token - 1].Name
        } else {
            $picked += $token
        }
        if (-not $Multiple) { break }
    }
    if ($picked.Count -eq 0) { return $false }
    $script:STEP73_MENU_PICK = $picked -join ','
    return $true
}

function Read-NetworkRouterWanPick {
    $adapters = @(Get-NatGwAdapters | Where-Object { -not (Test-NatGwBridge -Adapter $_) })
    $index = 0
    $reply = ''
    $script:STEP73_MENU_PICK = ''
    Write-Host '  0) USB network adapter (auto-detect)'
    foreach ($adapter in $adapters) {
        $index++
        Write-Host ('  {0}) {1} ({2}, {3}, {4}) {5}' -f $index, $adapter.Name, $(if (Test-NatGwUsb -Adapter $adapter) { 'usb' } else { 'onboard' }),
            $(if (Test-NatGwWireless -Adapter $adapter) { 'wifi' } else { 'wired' }), (Get-NatGwIPv4 -InterfaceIndex $adapter.ifIndex), $adapter.InterfaceDescription)
    }
    $reply = ([string](Read-Host 'Uplink (WAN) number, Enter cancels')).Trim()
    if ($reply -eq '0') { $script:STEP73_MENU_PICK = 'usb'; return $true }
    if ($reply -match '^\d+$' -and [int]$reply -ge 1 -and [int]$reply -le $adapters.Count) {
        $script:STEP73_MENU_PICK = $adapters[[int]$reply - 1].Name
        return $true
    }
    return $false
}

function Edit-NetworkRouterAddress {
    $reply = ''
    Read-NatGwConfig
    $reply = ([string](Read-Host "Gateway address [$($script:NatGwConfig.LAN_ADDRESS)]")).Trim()
    if ($reply -and $reply -ne $script:NatGwConfig.LAN_ADDRESS) { Set-NetworkRouterAddress -Address $reply }
}

function Show-NetworkRouterMenu {
    Show-NumberedMenu -Title 'Network Router (NAT Gateway / ICS)' -Header { Show-NetworkRouterMenuHeader } -Items @(
        @{ Text = 'Quick Install / Repair (background service)'; Action = { Install-NetworkRouter } },
        @{ Text = 'Status'; Action = { Show-NatGwStatus -ServiceState (Get-NetworkRouterServiceState) } },
        @{ Text = 'Detected Ports'; Action = { Show-NatGwPorts } },
        @{ Text = 'Relay: All onboard ports (first with link)'; Action = { Set-NetworkRouterLan -Mode 'all' -PortList '' } },
        @{ Text = 'Relay: One port...'; Action = { if (Read-NetworkRouterPick -Adapters (Get-NetworkRouterRelayCandidates) -Prompt 'Port number or name') { Set-NetworkRouterLan -Mode 'one' -PortList $script:STEP73_MENU_PICK } } },
        @{ Text = 'Relay: Selected ports...'; Action = { if (Read-NetworkRouterPick -Adapters (Get-NetworkRouterRelayCandidates) -Prompt 'Ports (numbers or names, comma separated)' -Multiple) { Set-NetworkRouterLan -Mode 'list' -PortList $script:STEP73_MENU_PICK } } },
        @{ Text = 'Uplink (WAN): USB auto / specific...'; Action = { if (Read-NetworkRouterWanPick) { Set-NetworkRouterWan -Selection $script:STEP73_MENU_PICK } } },
        @{ Text = 'Gateway Address...'; Action = { Edit-NetworkRouterAddress } },
        @{ Text = 'Restart Service'; Action = { Invoke-NetworkRouterService -Action 'restart' } },
        @{ Text = 'Stop Service'; Action = { Invoke-NetworkRouterService -Action 'stop' } },
        @{ Text = 'View Logs'; Action = { Show-NetworkRouterLogs } },
        @{ Text = 'Uninstall'; Action = { Uninstall-NetworkRouter } }
    )
}

# ------------------------------------------------------------------ main ----

function Invoke-NetworkRouterElevated {
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $STEP73_SCRIPT_PATH),
        ('"{0}"' -f $Command), ('"{0}"' -f $Value), ('"{0}"' -f $Ports))
    if ($Yes) { $arguments += '-Yes' }
    if ($Command) { $arguments += '-PauseAtEnd' }
    Write-ColorMessage "$STEP73_SCRIPT_INDEX Administrator rights are required; relaunching elevated..." -Type 'Warning'
    try {
        Start-Process -FilePath $STEP73_POWERSHELL_EXE -Verb RunAs -Wait -ArgumentList $arguments | Out-Null
    } catch {
        Write-ColorMessage "$STEP73_SCRIPT_INDEX Elevation declined or failed: $($_.Exception.Message)" -Type 'Error'
    }
}

if ($STEP73_NO_ADMIN_COMMANDS -notcontains $Command -and -not $Global:IS_RUN_ADMIN) {
    if ($Command -eq '' -and ([string](Get-GlobalVar -key $STEP73_INSTALL_FLAG_KEY)) -ne 'true' -and (Get-NetworkRouterServiceState) -eq 'absent') {
        Invoke-NetworkRouterInstallChain
        return
    }
    Invoke-NetworkRouterElevated
    return
}

switch ($Command) {
    '' { Invoke-NetworkRouterInstallChain }
    'help' { Show-NetworkRouterUsage }
    'status' { Show-NatGwStatus -ServiceState (Get-NetworkRouterServiceState) }
    'ports' { Show-NatGwPorts }
    'logs' { Show-NetworkRouterLogs }
    'menu' { Show-NetworkRouterMenu }
    'install' { Install-NetworkRouter }
    'uninstall' { Uninstall-NetworkRouter }
    'set-wan' { Set-NetworkRouterWan -Selection $Value }
    'set-lan' { Set-NetworkRouterLan -Mode $Value -PortList $Ports }
    'set-address' { Set-NetworkRouterAddress -Address $Value }
    'set-dhcp' { Set-NetworkRouterDhcp -State $Value }
    { @('start', 'stop', 'restart') -contains $_ } { Invoke-NetworkRouterService -Action $Command }
    default { Show-NetworkRouterUsage }
}
if ($PauseAtEnd) { Wait-MenuContinue }
