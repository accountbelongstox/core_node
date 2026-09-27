<#
.SYNOPSIS
    Tailscale management common library: install check, status summary, device table,
    service restart, and opening the two documented panels.

.DESCRIPTION
    Windows counterpart of the Linux Tailscale helpers (`is_tailscale_installed()` in
    scripts/shells/linux/debian/install_shells/97_install_tailscale.sh and
    `net_detect_tailscale_ipv4()` in scripts/shells/linux/common/network_detect_common.sh).
    Read-only status/device queries plus a service restart and opening the admin console /
    local device web interface. Never installs Tailscale -- when it is not present, every
    action here only reports that and points at the official install docs.

    Sources (official docs, checked 2026-09-27):
      https://tailscale.com/kb/1189/install-windows-msi   (Windows install dir / CLI location)
      https://tailscale.com/kb/1278/tailscaled             (service name 'Tailscale', net stop/start)
      https://tailscale.com/docs/reference/tailscale-cli   (status --json, ip, exit-node, ...)
      https://pkg.go.dev/tailscale.com/ipn/ipnstate        (status --json field names, PeerStatus)
      https://tailscale.com/docs/how-to/quickstart         (admin console Machines page URL)
      https://tailscale.com/kb/1325/device-web-interface   (local web UI at 100.100.100.100)
      https://tailscale.com/kb/1381/what-is-quad100        (Quad100 explainer)
      https://tailscale.com/docs/reference/connection-types (direct / relay / peer-relay)

.NOTES
    Direct run (also wired into the Windows Management menu):
    powershell -File TailscaleCommon.ps1 -Action Status|Devices|Restart|Panel|Help [-PanelTarget Admin|Local|Both]
#>
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('', 'Status', 'Devices', 'Restart', 'Panel', 'Help')]
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
    Write-ColorMessage -Message 'This menu does not install Tailscale; install it first, then reopen this entry.' -Type 'Info'
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
# Dispatcher
# ---------------------------------------------------------------------------

function Show-TailscaleHelp {
    Write-ColorMessage -Message 'TailscaleCommon.ps1 -Action Status|Devices|Restart|Panel|Help [-PanelTarget Admin|Local|Both]' -Type 'Info'
    Write-ColorMessage -Message '  Status  - installed check + backend state + this node Tailscale IPs' -Type 'Info'
    Write-ColorMessage -Message '  Devices - table of every tailnet device (self + peers)' -Type 'Info'
    Write-ColorMessage -Message '  Restart - restart the Tailscale service (elevates if needed)' -Type 'Info'
    Write-ColorMessage -Message '  Panel   - open the admin console, and the local web UI when connected' -Type 'Info'
}

switch ($Action) {
    '' { if ($MyInvocation.InvocationName -ne '.') { Show-TailscaleHelp } }
    'Status'  { Show-TailscaleStatus }
    'Devices' { Show-TailscaleDevices }
    'Restart' { [void](Restart-TailscaleServiceElevated) }
    'Panel'   { Show-TailscalePanel -PanelTarget $PanelTarget }
    'Help'    { Show-TailscaleHelp }
    default   { Write-ColorMessage -Message "Unknown -Action '$Action' (use Status, Devices, Restart, Panel or Help)" -Type 'Error' }
}
