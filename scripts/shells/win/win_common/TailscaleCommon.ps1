<#
.SYNOPSIS
    Tailscale management common library: install check, status summary, device table,
    service restart, and opening the two documented panels.

.DESCRIPTION
    Windows counterpart of the Linux Tailscale helpers (`is_tailscale_installed()` /
    `ts_show_status` / `ts_show_devices` in scripts/shells/linux/common/tailscale_common.sh
    and scripts/shells/linux/menu_itemshells/tailscale_menu.sh). Status/device queries, an
    idempotent winget install/repair, `tailscale set` settings, All-IPs (self + every peer),
    service restart, login/logout and opening the admin console / local device web UI. Every
    action detects "not installed" and points at the official install docs instead of failing.

    Sources (official docs, checked 2026-09-27/28):
      https://tailscale.com/kb/1189/install-windows-msi   (Windows install dir / CLI location)
      https://tailscale.com/kb/1278/tailscaled             (service name 'Tailscale', net stop/start)
      https://tailscale.com/docs/reference/tailscale-cli   (status --json, set, login, logout, ...)
      https://pkg.go.dev/tailscale.com/ipn/ipnstate        (status --json field names, PeerStatus)
      https://pkg.go.dev/tailscale.com/ipn#Prefs           (debug prefs field names: RouteAll,
                                                             AdvertiseRoutes, ExitNodeIP, ShieldsUp,
                                                             Hostname, RunSSH -- RunSSH/--ssh is
                                                             not applicable on the Windows client)
      https://tailscale.com/docs/how-to/quickstart         (admin console Machines page URL)
      https://tailscale.com/kb/1325/device-web-interface   (local web UI at 100.100.100.100)
      https://tailscale.com/kb/1381/what-is-quad100        (Quad100 explainer)
      https://tailscale.com/docs/reference/connection-types (direct / relay / peer-relay)
      https://community.chocolatey.org/packages (n/a)      winget id verified via `winget show
                                                             --id Tailscale.Tailscale -e`

.NOTES
    Direct run (also wired into the Windows Management menu via Show-TailscaleQuickMenu):
    powershell -File TailscaleCommon.ps1 -Action Status|Devices|Restart|Panel|OpenUI|AllIps|
                                                   Install|Settings|Login|Logout|Menu|Help
                                          [-PanelTarget Admin|Local|Both]
#>
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('', 'Status', 'Devices', 'Restart', 'Panel', 'OpenUI', 'AllIps', 'Install', 'Settings', 'Login', 'Logout', 'Menu', 'Help')]
    [string]$Action = '',

    [Parameter(Mandatory = $false)]
    [ValidateSet('Admin', 'Local', 'Both')]
    [string]$PanelTarget = 'Both'
)

# Import required modules (also loads GlobalVars.ps1: $Global:IS_RUN_ADMIN, StrictMode Latest)
$script:TAILSCALE_COMMON_DIR = $PSScriptRoot
. (Join-Path $script:TAILSCALE_COMMON_DIR 'CommonFunc.ps1')

# Constants (defined once here; reused by every function below)
$script:TailscaleServiceName = 'Tailscale'
$script:TailscaleDefaultInstallDir = Join-Path $env:ProgramFiles 'Tailscale'
$script:TailscaleDefaultExePath = Join-Path $script:TailscaleDefaultInstallDir 'tailscale.exe'
$script:TailscaleLogsDir = Join-Path (Join-Path $env:ProgramData 'Tailscale') 'Logs'
$script:TailscaleAdminConsoleUrl = 'https://console.tailscale.com/admin/machines'
$script:TailscaleLocalWebUrl = 'http://100.100.100.100'
$script:TailscaleInstallDocUrl = 'https://tailscale.com/kb/1189/install-windows-msi'
$script:TailscaleWingetId = 'Tailscale.Tailscale'
$script:TailscaleRunningState = 'Running'
$script:TailscaleNeedsLoginState = 'NeedsLogin'
$script:TailscaleStoppedState = 'Stopped'
$script:TailscaleStatusWebListen = '127.0.0.1:8384'
$script:TailscaleWebListenDefault = 'localhost:8088'
$script:TailscaleExitNodeRouteV4 = '0.0.0.0/0'
$script:TailscaleExitNodeRouteV6 = '::/0'

# ---------------------------------------------------------------------------
# Install / service detection
# ---------------------------------------------------------------------------

# Win32_Service.PathName ("ImagePath") is either a quoted executable path
# optionally followed by arguments (`"C:\Program Files\Tailscale\tailscaled.exe" --foo`)
# or, for a path with no spaces, an unquoted executable optionally followed by
# arguments. A plain Trim('"') breaks the quoted case whenever arguments follow
# the closing quote, so the quoted token is parsed out explicitly.
function Get-ServiceImageExecutablePath {
    param([Parameter(Mandatory = $true)][string]$ImagePath)
    $trimmed = ''
    $closingQuoteIndex = -1
    $spaceIndex = -1

    $trimmed = $ImagePath.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return ''
    }
    if ($trimmed.StartsWith('"')) {
        $closingQuoteIndex = $trimmed.IndexOf('"', 1)
        if ($closingQuoteIndex -gt 0) {
            return $trimmed.Substring(1, $closingQuoteIndex - 1)
        }
        return $trimmed.Trim('"')
    }
    $spaceIndex = $trimmed.IndexOf(' ')
    if ($spaceIndex -gt 0) {
        return $trimmed.Substring(0, $spaceIndex)
    }
    return $trimmed
}

# Resolve tailscale.exe: documented default install dir -> PATH -> the Tailscale
# service's own binary directory (tailscaled.exe sits next to tailscale.exe).
# Returns $null when none of the three resolve.
function Find-TailscaleExecutable {
    $tsCommand = $null
    $serviceInfo = $null
    $daemonPath = ''
    $daemonDir = ''
    $siblingExe = ''

    if (Test-Path -LiteralPath $script:TailscaleDefaultExePath -PathType Leaf) {
        return $script:TailscaleDefaultExePath
    }

    $tsCommand = Get-Command -Name 'tailscale.exe' -ErrorAction SilentlyContinue
    if ($null -ne $tsCommand) {
        return $tsCommand.Source
    }

    try {
        $serviceInfo = Get-CimInstance -ClassName Win32_Service -Filter "Name='$script:TailscaleServiceName'" -ErrorAction SilentlyContinue
    } catch {
        $serviceInfo = $null
    }
    if ($null -ne $serviceInfo -and -not [string]::IsNullOrWhiteSpace([string]$serviceInfo.PathName)) {
        $daemonPath = Get-ServiceImageExecutablePath -ImagePath ([string]$serviceInfo.PathName)
        $daemonDir = Split-Path -Path $daemonPath -Parent
        if (-not [string]::IsNullOrWhiteSpace($daemonDir)) {
            $siblingExe = Join-Path $daemonDir 'tailscale.exe'
            if (Test-Path -LiteralPath $siblingExe -PathType Leaf) {
                return $siblingExe
            }
        }
    }
    return $null
}

# Read-only service query: presence, Status/StartType (Get-Service) and the
# service binary path (Win32_Service.PathName -> tailscaled.exe). No elevation needed.
function Get-TailscaleServiceInfo {
    $service = $null
    $cimService = $null
    $imagePath = ''

    $service = Get-Service -Name $script:TailscaleServiceName -ErrorAction SilentlyContinue
    try {
        $cimService = Get-CimInstance -ClassName Win32_Service -Filter "Name='$script:TailscaleServiceName'" -ErrorAction SilentlyContinue
    } catch {
        $cimService = $null
    }
    if ($null -ne $cimService) {
        $imagePath = [string]$cimService.PathName
    }

    return [pscustomobject]@{
        Present   = ($null -ne $service)
        Status    = if ($null -ne $service) { $service.Status.ToString() } else { '' }
        StartType = if ($null -ne $service) { $service.StartType.ToString() } else { '' }
        ImagePath = $imagePath
    }
}

# Installed only when BOTH the CLI and the service are present (mirrors the
# spec's install-detection rule; a leftover service with no CLI, or vice versa,
# is not a usable install).
function Get-TailscaleInstallInfo {
    $exePath = ''
    $serviceInfo = $null

    $exePath = Find-TailscaleExecutable
    $serviceInfo = Get-TailscaleServiceInfo

    return [pscustomobject]@{
        ExePath     = $exePath
        HasExe      = (-not [string]::IsNullOrWhiteSpace([string]$exePath))
        ServiceInfo = $serviceInfo
        Installed   = ((-not [string]::IsNullOrWhiteSpace([string]$exePath)) -and $serviceInfo.Present)
    }
}

# ---------------------------------------------------------------------------
# Status (tailscale status --json)
# ---------------------------------------------------------------------------

# Strict-mode-safe property read: ConvertFrom-Json objects vary by Tailscale
# version (e.g. PeerRelay, ExitNodeOption), and GlobalVars.ps1 enables
# Set-StrictMode Latest, so a plain $obj.Field on a missing field would throw.
function Get-TailscaleJsonProperty {
    param(
        [Parameter(Mandatory = $true)][AllowNull()]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        $Default = $null
    )
    $value = $null

    if ($null -eq $Object) { return $Default }
    if ($Object.PSObject.Properties.Name -contains $Name) {
        $value = $Object.PSObject.Properties[$Name].Value
        if ($null -ne $value) { return $value }
    }
    return $Default
}

# `tailscale status --json`, parsed. Never throws: any failure (not installed,
# daemon not reachable, malformed output) returns $null, per the "don't use
# exit codes as return values" rule -- callers branch on the parsed object.
function Get-TailscaleStatusJson {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $rawJson = ''
    $parsed = $null

    if ([string]::IsNullOrWhiteSpace($TailscaleExe) -or -not (Test-Path -LiteralPath $TailscaleExe -PathType Leaf)) {
        return $null
    }
    try {
        $rawJson = [string](& $TailscaleExe 'status' '--json' 2>$null | Out-String)
        if ([string]::IsNullOrWhiteSpace($rawJson)) {
            return $null
        }
        $parsed = $rawJson | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return $null
    }
    return $parsed
}

# Summary used by the Status action: BackendState, Version, this node's IPs,
# tailnet name, peer count, health warnings, and AuthURL when logged out.
function Get-TailscaleStatusSummary {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $status = $null
    $currentTailnet = $null
    $peerMap = $null

    $status = Get-TailscaleStatusJson -TailscaleExe $TailscaleExe
    $currentTailnet = Get-TailscaleJsonProperty -Object $status -Name 'CurrentTailnet' -Default $null
    $peerMap = Get-TailscaleJsonProperty -Object $status -Name 'Peer' -Default $null

    return [pscustomobject]@{
        BackendState = [string](Get-TailscaleJsonProperty -Object $status -Name 'BackendState' -Default 'Unknown')
        Version      = [string](Get-TailscaleJsonProperty -Object $status -Name 'Version' -Default '')
        TailscaleIPs = @(Get-TailscaleJsonProperty -Object $status -Name 'TailscaleIPs' -Default @())
        AuthURL      = [string](Get-TailscaleJsonProperty -Object $status -Name 'AuthURL' -Default '')
        Health       = @(Get-TailscaleJsonProperty -Object $status -Name 'Health' -Default @())
        TailnetName  = [string](Get-TailscaleJsonProperty -Object $currentTailnet -Name 'Name' -Default '')
        PeerCount    = if ($null -ne $peerMap) { @($peerMap.PSObject.Properties).Count } else { 0 }
        Raw          = $status
    }
}

# ---------------------------------------------------------------------------
# Device table (Self + every Peer)
# ---------------------------------------------------------------------------

# Per docs/reference/connection-types: direct (CurAddr set) -> peer-relay
# (PeerRelay set) -> relay "<region>" (Relay set) -> "-" (no path yet).
function Get-TailscaleConnectionLabel {
    param([Parameter(Mandatory = $true)]$Peer)
    $curAddr = ''
    $peerRelay = ''
    $relay = ''

    $curAddr = [string](Get-TailscaleJsonProperty -Object $Peer -Name 'CurAddr' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($curAddr)) {
        return "direct $curAddr"
    }
    $peerRelay = [string](Get-TailscaleJsonProperty -Object $Peer -Name 'PeerRelay' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($peerRelay)) {
        return "peer-relay $peerRelay"
    }
    $relay = [string](Get-TailscaleJsonProperty -Object $Peer -Name 'Relay' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($relay)) {
        return "relay `"$relay`""
    }
    return '-'
}

# One row for Self or one Peer. IPv4/IPv6 are classified by ':' rather than by
# array index (TailscaleIPs order is not guaranteed by the JSON schema).
function Get-TailscaleDeviceRow {
    param(
        [Parameter(Mandatory = $true)]$Peer,
        $UserMap = $null,
        [switch]$IsSelf
    )
    $ips = @()
    $ipv4 = ''
    $ipv6 = ''
    $userId = $null
    $userEntry = $null
    $owner = ''

    $ips = @(Get-TailscaleJsonProperty -Object $Peer -Name 'TailscaleIPs' -Default @())
    $ipv4 = [string](($ips | Where-Object { $_ -notmatch ':' } | Select-Object -First 1))
    $ipv6 = [string](($ips | Where-Object { $_ -match ':' } | Select-Object -First 1))

    $userId = Get-TailscaleJsonProperty -Object $Peer -Name 'UserID' -Default $null
    if ($null -ne $UserMap -and $null -ne $userId) {
        $userEntry = Get-TailscaleJsonProperty -Object $UserMap -Name ([string]$userId) -Default $null
        if ($null -ne $userEntry) {
            $owner = [string](Get-TailscaleJsonProperty -Object $userEntry -Name 'LoginName' -Default '')
        }
    }

    return [pscustomobject]@{
        Self           = [bool]$IsSelf
        HostName       = [string](Get-TailscaleJsonProperty -Object $Peer -Name 'HostName' -Default '')
        DNSName        = ([string](Get-TailscaleJsonProperty -Object $Peer -Name 'DNSName' -Default '')).TrimEnd('.')
        OS             = [string](Get-TailscaleJsonProperty -Object $Peer -Name 'OS' -Default '')
        Owner          = $owner
        IPv4           = $ipv4
        IPv6           = $ipv6
        Online         = [bool](Get-TailscaleJsonProperty -Object $Peer -Name 'Online' -Default $IsSelf.IsPresent)
        LastSeen       = [string](Get-TailscaleJsonProperty -Object $Peer -Name 'LastSeen' -Default '')
        ExitNode       = [bool](Get-TailscaleJsonProperty -Object $Peer -Name 'ExitNode' -Default $false)
        ExitNodeOption = [bool](Get-TailscaleJsonProperty -Object $Peer -Name 'ExitNodeOption' -Default $false)
        Connection     = Get-TailscaleConnectionLabel -Peer $Peer
    }
}

# Full device table: Self first, then every Peer (Peer is a map keyed by node
# public key -> enumerate via .PSObject.Properties, PS 5.1 turns the JSON map
# into a PSCustomObject rather than a hashtable).
function Get-TailscaleDeviceTable {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $status = $null
    $userMap = $null
    $selfNode = $null
    $peerMap = $null
    $rows = $null

    $status = Get-TailscaleStatusJson -TailscaleExe $TailscaleExe
    if ($null -eq $status) {
        return @()
    }

    $userMap = Get-TailscaleJsonProperty -Object $status -Name 'User' -Default $null
    $rows = New-Object System.Collections.Generic.List[object]

    $selfNode = Get-TailscaleJsonProperty -Object $status -Name 'Self' -Default $null
    if ($null -ne $selfNode) {
        $rows.Add((Get-TailscaleDeviceRow -Peer $selfNode -UserMap $userMap -IsSelf))
    }

    $peerMap = Get-TailscaleJsonProperty -Object $status -Name 'Peer' -Default $null
    if ($null -ne $peerMap) {
        foreach ($peerProperty in $peerMap.PSObject.Properties) {
            $rows.Add((Get-TailscaleDeviceRow -Peer $peerProperty.Value -UserMap $userMap))
        }
    }

    return $rows.ToArray()
}

# ---------------------------------------------------------------------------
# Console output (Status / Devices / not-installed messaging)
# ---------------------------------------------------------------------------

function Show-TailscaleNotInstalledMessage {
    Write-ColorMessage -Message 'Tailscale is not installed on this machine (no tailscale.exe and/or no Tailscale service found).' -Type 'Warning'
    Write-ColorMessage -Message "Official install docs: $script:TailscaleInstallDocUrl" -Type 'Info'
    Write-ColorMessage -Message "Winget package id: $script:TailscaleWingetId  ->  winget install --id $script:TailscaleWingetId -e" -Type 'Info'
    Write-ColorMessage -Message "Use the 'Install / Repair' entry (-Action Install) to install it from here." -Type 'Info'
}

# ---------------------------------------------------------------------------
# Install / Repair (winget)
# ---------------------------------------------------------------------------

# Refresh this process's PATH from the registry: tailscale.exe just installed by
# winget is otherwise invisible to Get-Command until a new shell starts. Not
# strictly required for Find-TailscaleExecutable (it checks the documented
# default install dir first), but keeps a bare `tailscale` call working in the
# same console session right after install.
function Update-TailscaleSessionPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machinePath, $userPath) -join ';'
}

# Idempotent install/repair: skips the winget call entirely when Tailscale is
# already installed (CLI + service both present, per Get-TailscaleInstallInfo).
# Installing the Tailscale service requires an elevated token, so this
# relaunches winget elevated when the current process is not already admin
# (same UAC pattern as Restart-TailscaleServiceElevated).
function Install-TailscaleWinget {
    $installInfo = $null
    $wingetArgs = @()

    $installInfo = Get-TailscaleInstallInfo
    if ($installInfo.Installed) {
        Write-ColorMessage -Message "Tailscale is already installed ($($installInfo.ExePath)); skipping winget install." -Type 'Success'
        return $true
    }

    if (-not (Get-Command -Name 'winget' -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "winget was not found on PATH; install Tailscale manually: $script:TailscaleInstallDocUrl" -Type 'Error'
        return $false
    }

    $wingetArgs = @('install', '--id', $script:TailscaleWingetId, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements')
    Write-ColorMessage -Message "Installing Tailscale via winget (id: $script:TailscaleWingetId)..." -Type 'Info'

    if (-not $Global:IS_RUN_ADMIN) {
        Write-ColorMessage -Message 'Administrator rights are required to install the Tailscale service; relaunching elevated...' -Type 'Warning'
        try {
            Start-Process -FilePath 'winget.exe' -Verb RunAs -Wait -ArgumentList $wingetArgs | Out-Null
        } catch {
            Write-ColorMessage -Message "Elevation declined or failed: $($_.Exception.Message)" -Type 'Error'
            return $false
        }
    } else {
        try {
            Start-Process -FilePath 'winget.exe' -ArgumentList $wingetArgs -NoNewWindow -Wait | Out-Null
        } catch {
            Write-ColorMessage -Message "winget install failed to start: $($_.Exception.Message)" -Type 'Error'
            return $false
        }
    }

    Start-Sleep -Seconds 3
    Update-TailscaleSessionPath
    $installInfo = Get-TailscaleInstallInfo
    if ($installInfo.Installed) {
        Write-ColorMessage -Message "Tailscale installed successfully ($($installInfo.ExePath))." -Type 'Success'
        return $true
    }

    Write-ColorMessage -Message "Tailscale install did not complete (CLI and/or service not found afterwards). Retry, or install manually: $script:TailscaleInstallDocUrl" -Type 'Error'
    return $false
}

function Show-TailscaleStatus {
    $installInfo = $null
    $summary = $null
    $warningLine = ''

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return
    }

    $summary = Get-TailscaleStatusSummary -TailscaleExe $installInfo.ExePath
    Write-ColorMessage -Message "Executable: $($installInfo.ExePath)" -Type 'Info'
    Write-ColorMessage -Message "Service '$script:TailscaleServiceName': $($installInfo.ServiceInfo.Status) (StartType: $($installInfo.ServiceInfo.StartType))" -Type 'Info'
    Write-ColorMessage -Message "Backend state: $($summary.BackendState)" -Type 'Info'
    if (-not [string]::IsNullOrWhiteSpace($summary.Version)) {
        Write-ColorMessage -Message "Version: $($summary.Version)" -Type 'Info'
    }
    if (-not [string]::IsNullOrWhiteSpace($summary.TailnetName)) {
        Write-ColorMessage -Message "Tailnet: $($summary.TailnetName)" -Type 'Info'
    }
    if (@($summary.TailscaleIPs).Count -gt 0) {
        Write-ColorMessage -Message "This node's Tailscale IPs: $($summary.TailscaleIPs -join ', ')" -Type 'Info'
    }
    Write-ColorMessage -Message "Peers on tailnet: $($summary.PeerCount)" -Type 'Info'
    if ($summary.BackendState -eq $script:TailscaleNeedsLoginState) {
        if (-not [string]::IsNullOrWhiteSpace($summary.AuthURL)) {
            Write-ColorMessage -Message "Login required: $($summary.AuthURL)" -Type 'Warning'
        }
        Write-ColorMessage -Message 'Node is not authenticated. Connect with: tailscale up' -Type 'Warning'
    } elseif ($summary.BackendState -eq $script:TailscaleStoppedState) {
        Write-ColorMessage -Message 'Node is stopped. Reconnect with: tailscale up' -Type 'Warning'
    }
    foreach ($warningLine in @($summary.Health)) {
        Write-ColorMessage -Message "Health: $warningLine" -Type 'Warning'
    }
    Write-ColorMessage -Message "Logs: $script:TailscaleLogsDir" -Type 'Info'
}

function Show-TailscaleDevices {
    $installInfo = $null
    $devices = @()
    $columns = @()

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return
    }

    $devices = @(Get-TailscaleDeviceTable -TailscaleExe $installInfo.ExePath)
    if ($devices.Count -eq 0) {
        Write-ColorMessage -Message 'No device data yet (daemon not running or not authenticated).' -Type 'Warning'
        return
    }

    $columns = @(
        @{ Label = 'Self'; Expression = { if ($_.Self) { '*' } else { '' } } },
        'HostName',
        'DNSName',
        'Owner',
        'OS',
        'IPv4',
        'IPv6',
        @{ Label = 'Online'; Expression = { if ($_.Online) { 'yes' } else { 'no' } } },
        'LastSeen',
        @{ Label = 'ExitNode'; Expression = { if ($_.ExitNode) { 'in-use' } elseif ($_.ExitNodeOption) { 'offered' } else { '' } } },
        'Connection'
    )

    $devices |
        Sort-Object -Property @{ Expression = 'Self'; Descending = $true }, 'HostName' |
        Format-Table -AutoSize -Property $columns |
        Out-String |
        Write-Host
}

# ---------------------------------------------------------------------------
# Settings (tailscale set)
# ---------------------------------------------------------------------------

# `tailscale debug prefs`, parsed. Never throws (same contract as
# Get-TailscaleStatusJson): a failure returns $null and callers show blanks.
function Get-TailscalePrefsJson {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $rawJson = ''
    $parsed = $null

    try {
        $rawJson = [string](& $TailscaleExe 'debug' 'prefs' 2>$null | Out-String)
        if ([string]::IsNullOrWhiteSpace($rawJson)) {
            return $null
        }
        $parsed = $rawJson | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return $null
    }
    return $parsed
}

# Interactive `tailscale set` wrapper: shows the current value of every
# setting (from `tailscale debug prefs`) and prompts for a new one, Enter
# keeps it unchanged. Only the flags the user actually answered are passed to
# `tailscale set`, so this never resets unrelated preferences. Tailscale SSH
# (--ssh) and --operator are Unix-only (operator is "a Unix username"; SSH
# server mode targets Linux/macOS nodes) and are intentionally not offered
# here, per https://tailscale.com/docs/reference/tailscale-cli.
function Show-TailscaleSettings {
    $installInfo = $null
    $prefs = $null
    $setArgs = New-Object System.Collections.Generic.List[string]
    $currentHostname = ''
    $currentAcceptRoutes = $false
    $currentAdvertiseRoutes = @()
    $currentAdvertiseExitNode = $false
    $currentExitNode = ''
    $currentShieldsUp = $false
    $response = ''

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return
    }

    $prefs = Get-TailscalePrefsJson -TailscaleExe $installInfo.ExePath
    $currentHostname = [string](Get-TailscaleJsonProperty -Object $prefs -Name 'Hostname' -Default '')
    $currentAcceptRoutes = [bool](Get-TailscaleJsonProperty -Object $prefs -Name 'RouteAll' -Default $false)
    $currentAdvertiseRoutes = @(Get-TailscaleJsonProperty -Object $prefs -Name 'AdvertiseRoutes' -Default @())
    $currentAdvertiseExitNode = (($currentAdvertiseRoutes -contains $script:TailscaleExitNodeRouteV4) -or ($currentAdvertiseRoutes -contains $script:TailscaleExitNodeRouteV6))
    $currentExitNode = [string](Get-TailscaleJsonProperty -Object $prefs -Name 'ExitNodeIP' -Default '')
    $currentShieldsUp = [bool](Get-TailscaleJsonProperty -Object $prefs -Name 'ShieldsUp' -Default $false)

    Write-ColorMessage -Message 'Tailscale settings (tailscale set). Press Enter to keep the current value.' -Type 'Info'
    Write-ColorMessage -Message 'Tailscale SSH (--ssh) is Linux/macOS only and is not offered here.' -Type 'Info'
    Write-Host ''

    $response = Read-Host "Hostname [$currentHostname]"
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        $setArgs.Add("--hostname=$response")
    }

    $response = Read-Host "Accept subnet routes from other nodes? y/n [$(if ($currentAcceptRoutes) { 'y' } else { 'n' })]"
    if ($response -match '^(?i)y') { $setArgs.Add('--accept-routes') }
    elseif ($response -match '^(?i)n') { $setArgs.Add('--accept-routes=false') }

    $response = Read-Host "Advertise this device as an exit node? y/n [$(if ($currentAdvertiseExitNode) { 'y' } else { 'n' })]"
    if ($response -match '^(?i)y') { $setArgs.Add('--advertise-exit-node') }
    elseif ($response -match '^(?i)n') { $setArgs.Add('--advertise-exit-node=false') }

    $response = Read-Host "Use exit node (Tailscale IP or name; '-' to clear) [$currentExitNode]"
    if ($response.Trim() -eq '-') { $setArgs.Add('--exit-node=') }
    elseif (-not [string]::IsNullOrWhiteSpace($response)) { $setArgs.Add("--exit-node=$response") }

    $response = Read-Host "Shields up (block incoming connections)? y/n [$(if ($currentShieldsUp) { 'y' } else { 'n' })]"
    if ($response -match '^(?i)y') { $setArgs.Add('--shields-up') }
    elseif ($response -match '^(?i)n') { $setArgs.Add('--shields-up=false') }

    if ($setArgs.Count -eq 0) {
        Write-ColorMessage -Message 'No changes requested.' -Type 'Info'
        return
    }

    Write-ColorMessage -Message "Running: tailscale set $($setArgs -join ' ')" -Type 'Info'
    try {
        & $installInfo.ExePath 'set' @($setArgs.ToArray()) 2>&1 | ForEach-Object { Write-Host $_ }
        Write-ColorMessage -Message 'Settings applied.' -Type 'Success'
    } catch {
        Write-ColorMessage -Message "tailscale set failed: $($_.Exception.Message)" -Type 'Error'
    }
}

# ---------------------------------------------------------------------------
# All IPs (this machine + every peer)
# ---------------------------------------------------------------------------

# LAN-side IPv4 addresses of this machine (excludes the Tailscale adapter,
# loopback and link-local/APIPA). Best-effort: an empty array on failure.
function Get-LocalLanIPv4Addresses {
    $addresses = @()
    try {
        $addresses = @(
            Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.InterfaceAlias -notmatch 'Tailscale' -and
                    $_.IPAddress -ne '127.0.0.1' -and
                    -not $_.IPAddress.StartsWith('169.254.')
                } |
                Select-Object -ExpandProperty IPAddress
        )
    } catch {
        $addresses = @()
    }
    return $addresses
}

# This machine (Tailscale IPv4/IPv6, MagicDNS name, LAN IPs) + every peer
# (hostname, OS, online, TailscaleIPs, exit-node/relay), from
# `tailscale status --json`, per the design's "All IPs" requirement.
function Show-TailscaleAllIps {
    $installInfo = $null
    $status = $null
    $selfNode = $null
    $peerMap = $null
    $lanIps = @()
    $selfRow = $null

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return
    }

    $status = Get-TailscaleStatusJson -TailscaleExe $installInfo.ExePath
    if ($null -eq $status) {
        Write-ColorMessage -Message 'No status data yet (daemon not running or not authenticated).' -Type 'Warning'
        return
    }

    $lanIps = @(Get-LocalLanIPv4Addresses)
    Write-ColorMessage -Message '== This machine ==' -Type 'Info'
    $selfNode = Get-TailscaleJsonProperty -Object $status -Name 'Self' -Default $null
    if ($null -ne $selfNode) {
        $selfRow = Get-TailscaleDeviceRow -Peer $selfNode -IsSelf
        Write-ColorMessage -Message "  HostName:       $($selfRow.HostName)" -Type 'Info'
        Write-ColorMessage -Message "  MagicDNS name:  $($selfRow.DNSName)" -Type 'Info'
        Write-ColorMessage -Message "  Tailscale IPv4: $($selfRow.IPv4)" -Type 'Info'
        Write-ColorMessage -Message "  Tailscale IPv6: $($selfRow.IPv6)" -Type 'Info'
    }
    Write-ColorMessage -Message "  LAN IPv4:       $(if ($lanIps.Count -gt 0) { $lanIps -join ', ' } else { 'none detected' })" -Type 'Info'

    Write-Host ''
    Write-ColorMessage -Message '== Peers ==' -Type 'Info'
    $peerMap = Get-TailscaleJsonProperty -Object $status -Name 'Peer' -Default $null
    if ($null -eq $peerMap -or @($peerMap.PSObject.Properties).Count -eq 0) {
        Write-ColorMessage -Message '  (no peers)' -Type 'Info'
        return
    }
    foreach ($peerProperty in $peerMap.PSObject.Properties) {
        $peerRow = Get-TailscaleDeviceRow -Peer $peerProperty.Value
        $exitLabel = if ($peerRow.ExitNode) { 'in-use' } elseif ($peerRow.ExitNodeOption) { 'offered' } else { 'no' }
        $ipList = @($peerRow.IPv4, $peerRow.IPv6) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        Write-ColorMessage -Message "  $($peerRow.HostName)  [$($peerRow.OS)]  online=$($peerRow.Online)  IPs=$($ipList -join ', ')  exit-node=$exitLabel  via=$($peerRow.Connection)" -Type 'Info'
    }
}

# ---------------------------------------------------------------------------
# Login / Logout
# ---------------------------------------------------------------------------

function Invoke-TailscaleLogin {
    $installInfo = $null

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return $false
    }

    Write-ColorMessage -Message 'Starting Tailscale login (tailscale login)...' -Type 'Info'
    try {
        & $installInfo.ExePath 'login'
        return $true
    } catch {
        Write-ColorMessage -Message "tailscale login failed: $($_.Exception.Message)" -Type 'Error'
        return $false
    }
}

function Invoke-TailscaleLogout {
    $installInfo = $null

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return $false
    }

    Write-ColorMessage -Message 'Logging out (tailscale logout)...' -Type 'Warning'
    try {
        & $installInfo.ExePath 'logout'
        Write-ColorMessage -Message 'Logged out.' -Type 'Success'
        return $true
    } catch {
        Write-ColorMessage -Message "tailscale logout failed: $($_.Exception.Message)" -Type 'Error'
        return $false
    }
}

# ---------------------------------------------------------------------------
# Service restart (elevation handling)
# ---------------------------------------------------------------------------

# Documented control is 'net stop Tailscale' / 'net start Tailscale' or the
# Service Manager; Restart-Service is the PowerShell equivalent. Requires an
# elevated Administrator token -- when this process is not elevated, relaunch
# a minimal elevated PowerShell that only restarts the service.
function Restart-TailscaleServiceElevated {
    $installInfo = $null
    $afterStatus = $null

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return $false
    }

    if (-not $Global:IS_RUN_ADMIN) {
        Write-ColorMessage -Message 'Administrator rights are required to restart the Tailscale service; relaunching elevated...' -Type 'Warning'
        try {
            Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @(
                '-NoProfile', '-Command', "Restart-Service -Name '$script:TailscaleServiceName'"
            ) | Out-Null
            $afterStatus = Get-Service -Name $script:TailscaleServiceName -ErrorAction SilentlyContinue
            Write-ColorMessage -Message "Elevated restart finished (Status: $($afterStatus.Status))." -Type 'Success'
            return $true
        } catch {
            Write-ColorMessage -Message "Elevation declined or failed: $($_.Exception.Message)" -Type 'Error'
            return $false
        }
    }

    try {
        Restart-Service -Name $script:TailscaleServiceName -ErrorAction Stop
        $afterStatus = Get-Service -Name $script:TailscaleServiceName -ErrorAction SilentlyContinue
        Write-ColorMessage -Message "Tailscale service restarted (Status: $($afterStatus.Status))." -Type 'Success'
        return $true
    } catch {
        Write-ColorMessage -Message "Failed to restart the Tailscale service: $($_.Exception.Message)" -Type 'Error'
        return $false
    }
}

# ---------------------------------------------------------------------------
# Panels
# ---------------------------------------------------------------------------

# Admin console (cloud, every tailnet device) always opens; the local device
# web interface (Quad100, this device only) opens only once the daemon is
# Running/connected, per https://tailscale.com/kb/1325/device-web-interface.
# Not installed -> only the not-installed message (mirrors Show-TailscaleStatus
# / Show-TailscaleDevices; matches the Linux counterpart's ts_show_panel, which
# still prints the panel URLs but gates opening them the same way).
function Show-TailscalePanel {
    param([ValidateSet('Admin', 'Local', 'Both')][string]$PanelTarget = 'Both')
    $installInfo = $null
    $backendState = 'Unknown'

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        return
    }

    if ($PanelTarget -eq 'Admin' -or $PanelTarget -eq 'Both') {
        Write-ColorMessage -Message "Opening the admin console (all tailnet devices): $script:TailscaleAdminConsoleUrl" -Type 'Info'
        try {
            Start-Process -FilePath $script:TailscaleAdminConsoleUrl | Out-Null
        } catch {
            Write-ColorMessage -Message "Failed to open the admin console: $($_.Exception.Message)" -Type 'Error'
        }
    }

    if ($PanelTarget -eq 'Local' -or $PanelTarget -eq 'Both') {
        $backendState = (Get-TailscaleStatusSummary -TailscaleExe $installInfo.ExePath).BackendState
        if ($backendState -eq $script:TailscaleRunningState) {
            Write-ColorMessage -Message "Opening the local device web interface: $script:TailscaleLocalWebUrl" -Type 'Info'
            try {
                Start-Process -FilePath $script:TailscaleLocalWebUrl | Out-Null
            } catch {
                Write-ColorMessage -Message "Failed to open the local device web interface: $($_.Exception.Message)" -Type 'Error'
            }
        } else {
            Write-ColorMessage -Message "Local device web interface needs the daemon connected (state: $backendState); skipped. It serves $script:TailscaleLocalWebUrl once Tailscale is Running (v1.56.0+)." -Type 'Warning'
        }
    }

    Write-ColorMessage -Message 'Other panels documented by Tailscale:' -Type 'Info'
    Write-ColorMessage -Message "  tailscale.exe status --web --listen $script:TailscaleStatusWebListen   (local read-only HTML status page)" -Type 'Info'
    Write-ColorMessage -Message "  tailscale.exe web --listen $script:TailscaleWebListenDefault           (foreground web UI; Ctrl+C to stop)" -Type 'Info'
    Write-ColorMessage -Message '  tailscale.exe set --webclient                                          (expose the web UI at <TailscaleIP>:5252)' -Type 'Info'
}

# ---------------------------------------------------------------------------
# Quick menu ("[T] Tailscale" entry, wired into WindowsManagementManager.ps1)
# ---------------------------------------------------------------------------

# Short state word for the "[T] Tailscale" quick-entry label: "not installed",
# or the backend state (Running/NeedsLogin/Stopped/...) when installed.
function Get-TailscaleQuickStateLabel {
    $installInfo = $null
    $summary = $null
    $label = ''

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) {
        return 'not installed'
    }
    $summary = Get-TailscaleStatusSummary -TailscaleExe $installInfo.ExePath
    $label = [string]$summary.BackendState
    if ([string]::IsNullOrWhiteSpace($label)) { $label = 'Unknown' }
    return $label
}

# Same item list as the Linux Tailscale menu (scripts/shells/linux/menu_itemshells/
# tailscale_menu.sh): Install/Repair, Settings, Open UI, All IPs, Status, Restart
# service, Login, Logout, Help. Every item calls a shared function above --
# no logic is duplicated in this loop.
function Show-TailscaleQuickMenu {
    $menuItems = @(
        @{ Text = 'Install / Repair (winget)';               Action = { [void](Install-TailscaleWinget) } },
        @{ Text = 'Settings (tailscale set)';                 Action = { Show-TailscaleSettings } },
        @{ Text = 'Open UI (admin console + local web UI)';   Action = { Show-TailscalePanel -PanelTarget Both } },
        @{ Text = 'All IPs (this machine + every peer)';      Action = { Show-TailscaleAllIps } },
        @{ Text = 'Status';                                   Action = { Show-TailscaleStatus } },
        @{ Text = 'Restart service';                          Action = { [void](Restart-TailscaleServiceElevated) } },
        @{ Text = 'Login';                                    Action = { [void](Invoke-TailscaleLogin) } },
        @{ Text = 'Logout';                                   Action = { [void](Invoke-TailscaleLogout) } },
        @{ Text = 'Help';                                     Action = { Show-TailscaleHelp } },
        @{ Text = 'Back';                                     Action = { return } }
    )

    $selected = 0
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message ("Tailscale ({0})" -f (Get-TailscaleQuickStateLabel)) -Type 'Info'
        Write-ColorMessage -Message 'Up/Down to move, Enter to select, Q/Escape to go back' -Type 'Info'
        Write-Host ''
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selected) {
                Write-Host -NoNewline '>'
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-45}" -f $menuItems[$i].Text)
                Write-Host ''
            } else {
                Write-Host ("  {0,-45}" -f $menuItems[$i].Text)
            }
        }

        try {
            $key = [Console]::ReadKey($true).Key
        } catch {
            Write-ColorMessage -Message 'Cannot read console input in this environment; enter a number, or q to go back' -Type 'Warning'
            $numeric = Read-Host 'Selection'
            if ($numeric -eq 'q') { return }
            if ($numeric -match '^\d+$' -and [int]$numeric -ge 1 -and [int]$numeric -le $menuItems.Count) {
                $chosenItem = $menuItems[[int]$numeric - 1]
                if ($chosenItem.Text -eq 'Back') { return }
                Clear-Host
                & $chosenItem.Action
                Wait-MenuContinue
            }
            continue
        }

        switch ($key) {
            'UpArrow'   { if ($selected -gt 0) { $selected-- } else { $selected = $menuItems.Count - 1 } }
            'DownArrow' { if ($selected -lt $menuItems.Count - 1) { $selected++ } else { $selected = 0 } }
            'Enter' {
                $chosenItem = $menuItems[$selected]
                if ($chosenItem.Text -eq 'Back') { return }
                Clear-Host
                & $chosenItem.Action
                Wait-MenuContinue
            }
            'Q' { return }
            'Escape' { return }
        }
    }
}

# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

function Show-TailscaleHelp {
    Write-ColorMessage -Message 'TailscaleCommon.ps1 -Action Status|Devices|Restart|Panel|OpenUI|AllIps|Install|Settings|Login|Logout|Menu|Help [-PanelTarget Admin|Local|Both]' -Type 'Info'
    Write-ColorMessage -Message '  Status   - installed check + backend state + this node Tailscale IPs' -Type 'Info'
    Write-ColorMessage -Message '  Devices  - table of every tailnet device (self + peers)' -Type 'Info'
    Write-ColorMessage -Message '  Install  - idempotent winget install/repair (skips when already installed)' -Type 'Info'
    Write-ColorMessage -Message '  Settings - interactive tailscale set (hostname, accept-routes, advertise-exit-node, exit-node, shields-up)' -Type 'Info'
    Write-ColorMessage -Message '  AllIps   - this machine (Tailscale IPv4/IPv6, MagicDNS, LAN IPs) + every peer' -Type 'Info'
    Write-ColorMessage -Message '  Restart  - restart the Tailscale service (elevates if needed)' -Type 'Info'
    Write-ColorMessage -Message '  Panel/OpenUI - open the admin console, and the local web UI when connected' -Type 'Info'
    Write-ColorMessage -Message '  Login/Logout - tailscale login / tailscale logout' -Type 'Info'
    Write-ColorMessage -Message '  Menu     - the same arrow-key quick menu as "[T] Tailscale" in Windows Management' -Type 'Info'
}

switch ($Action) {
    '' { if ($MyInvocation.InvocationName -ne '.') { Show-TailscaleHelp } }
    'Status'   { Show-TailscaleStatus }
    'Devices'  { Show-TailscaleDevices }
    'Restart'  { [void](Restart-TailscaleServiceElevated) }
    'Panel'    { Show-TailscalePanel -PanelTarget $PanelTarget }
    'OpenUI'   { Show-TailscalePanel -PanelTarget $PanelTarget }
    'AllIps'   { Show-TailscaleAllIps }
    'Install'  { [void](Install-TailscaleWinget) }
    'Settings' { Show-TailscaleSettings }
    'Login'    { [void](Invoke-TailscaleLogin) }
    'Logout'   { [void](Invoke-TailscaleLogout) }
    'Menu'     { Show-TailscaleQuickMenu }
    'Help'     { Show-TailscaleHelp }
    default    { Write-ColorMessage -Message "Unknown -Action '$Action' (use Status, Devices, Restart, Panel, OpenUI, AllIps, Install, Settings, Login, Logout, Menu or Help)" -Type 'Error' }
}
