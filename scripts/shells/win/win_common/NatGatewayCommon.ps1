# NAT gateway engine on Windows, shared by the CLI/menu (install_powershells/Step73_InstallNetworkRouter.ps1)
# and the monitor service (NatGatewayMonitor.ps1). Windows counterpart of
# scripts/shells/linux/common/natgateway_engine_common.sh with the same router.conf keys.
#
# Uplink (WAN): a USB network adapter (auto) or a named adapter.
# Relay port (LAN): Internet Connection Sharing (ICS) NATs one public connection to ONE private
# connection and always serves DHCP/DNS on it, so all/list modes relay on the first suitable port
# (a "Network Bridge" adapter is preferred: bridging several ports relays on all of them).
# The private address comes from the ICS ScopeAddress registry value (/24).
#
# References: INetSharingManager / INetSharingConfiguration
# (learn.microsoft.com/windows/win32/api/netcon), ICS reboot persistence
# (learn.microsoft.com/troubleshoot/windows-server/networking/internet-connection-sharing-fails).

$script:NatGwConfigFile = ''
$script:NatGwServiceName = 'ncore-natgateway'
$script:NatGwDefaultAddress = '192.168.50.1/24'
$script:NatGwPollSeconds = 5
$script:NatGwConfigKeys = @('WAN_SELECT', 'LAN_MODE', 'LAN_PORTS', 'LAN_ADDRESS', 'DHCP_ENABLED')
$script:NatGwLanModes = @('all', 'one', 'list')
$script:NatGwIcsServiceName = 'SharedAccess'
$script:NatGwIcsParametersKey = 'HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters'
$script:NatGwIcsPersistKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\SharedAccess'
$script:NatGwIcsPersistValue = 'EnableRebootPersistConnection'
$script:NatGwSharingPublic = 0
$script:NatGwSharingPrivate = 1
$script:NatGwWirelessMedium = 9
$script:NatGwBridgeDescription = '*MAC Bridge*'
$script:NatGwApipaPrefix = '169.254.*'
$script:NatGwDefaultRoute = '0.0.0.0/0'

$script:NatGwConfig = @{}
$script:NatGwGatewayIp = ''
$script:NatGwWan = $null
$script:NatGwLan = $null
$script:NatGwLanCandidates = @()
$script:NatGwLanSkipped = @()
$script:NatGwLastState = ''

function Initialize-NatGateway {
    param([Parameter(Mandatory = $true)][string]$ConfigFile)
    $script:NatGwConfigFile = $ConfigFile
}

function Write-NatGwLog {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ('[{0}][NATGATEWAY] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

# ---------------------------------------------------------------- config ----

function Test-NatGwAddressValid {
    param([string]$Address)
    $octets = @()
    if ($Address -notmatch '^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/24$') { return $false }
    $octets = @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3], [int]$Matches[4])
    foreach ($octet in $octets) { if ($octet -gt 255) { return $false } }
    return ($octets[3] -ge 1 -and $octets[3] -le 254)
}

# key=value parser (never dot-sourced: the file lives in a shared data dir).
function Read-NatGwConfig {
    $line = ''
    $key = ''
    $value = ''
    $script:NatGwConfig = @{
        WAN_SELECT   = 'usb'
        LAN_MODE     = 'all'
        LAN_PORTS    = ''
        LAN_ADDRESS  = $script:NatGwDefaultAddress
        DHCP_ENABLED = 'yes'
    }
    if ($script:NatGwConfigFile -and (Test-Path -LiteralPath $script:NatGwConfigFile)) {
        foreach ($line in @(Get-Content -LiteralPath $script:NatGwConfigFile -ErrorAction SilentlyContinue)) {
            if ($line -notmatch '^\s*([A-Z_]+)\s*=(.*)$') { continue }
            $key = $Matches[1]
            $value = $Matches[2].Trim().Trim('"')
            if ($script:NatGwConfigKeys -contains $key) { $script:NatGwConfig[$key] = $value }
        }
    }
    if ($script:NatGwLanModes -notcontains $script:NatGwConfig.LAN_MODE) { $script:NatGwConfig.LAN_MODE = 'all' }
    if ([string]::IsNullOrWhiteSpace($script:NatGwConfig.WAN_SELECT)) { $script:NatGwConfig.WAN_SELECT = 'usb' }
    if (-not (Test-NatGwAddressValid -Address $script:NatGwConfig.LAN_ADDRESS)) { $script:NatGwConfig.LAN_ADDRESS = $script:NatGwDefaultAddress }
    $script:NatGwConfig.DHCP_ENABLED = 'yes'
    $script:NatGwGatewayIp = $script:NatGwConfig.LAN_ADDRESS.Split('/')[0]
}

function Save-NatGwConfig {
    $configDir = Split-Path -Parent $script:NatGwConfigFile
    $tmpFile = Join-Path $configDir ('.router.conf.{0}' -f [guid]::NewGuid().ToString('N'))
    $lines = @('# NAT gateway configuration (natgateway set-wan / set-lan / set-address / set-dhcp)')
    foreach ($key in $script:NatGwConfigKeys) { $lines += ('{0}="{1}"' -f $key, $script:NatGwConfig[$key]) }
    if (-not (Test-Path -LiteralPath $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
    Set-Content -LiteralPath $tmpFile -Value $lines -Encoding ASCII
    Move-Item -LiteralPath $tmpFile -Destination $script:NatGwConfigFile -Force
}

# ------------------------------------------------------------- detection ----

function Test-NatGwUsb {
    param($Adapter)
    return ([string]$Adapter.PnPDeviceID -like 'USB\*')
}

function Test-NatGwWireless {
    param($Adapter)
    return ([int]$Adapter.NdisPhysicalMedium -eq $script:NatGwWirelessMedium)
}

function Test-NatGwBridge {
    param($Adapter)
    return ([string]$Adapter.InterfaceDescription -like $script:NatGwBridgeDescription)
}

# Physical adapters plus an existing Network Bridge (never Hyper-V/WSL virtual switches).
function Get-NatGwAdapters {
    $physical = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue)
    $bridges = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { Test-NatGwBridge -Adapter $_ })
    return @($physical + $bridges | Sort-Object -Property ifIndex)
}

function Get-NatGwIPv4 {
    param([int]$InterfaceIndex)
    $address = Get-NetIPAddress -InterfaceIndex $InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike $script:NatGwApipaPrefix } | Select-Object -First 1
    if ($address) { return ('{0}/{1}' -f $address.IPAddress, $address.PrefixLength) }
    return ''
}

function Get-NatGwDefaultRouteIndexes {
    return @(Get-NetRoute -DestinationPrefix $script:NatGwDefaultRoute -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        ForEach-Object { [int]$_.InterfaceIndex } | Select-Object -Unique)
}

# Exact adapter name first, then the first adapter whose name or description contains it.
function Resolve-NatGwAdapterName {
    param([string]$Wanted, [object[]]$Adapters)
    $match = $Adapters | Where-Object { $_.Name -eq $Wanted } | Select-Object -First 1
    if ($match) { return $match }
    return ($Adapters | Where-Object { $_.Name -like "*$Wanted*" -or $_.InterfaceDescription -like "*$Wanted*" } | Select-Object -First 1)
}

function Test-NatGwWanReady {
    param($Adapter)
    if (-not $Adapter) { return $false }
    if (Test-NatGwBridge -Adapter $Adapter) { return $false }
    return ([string]$Adapter.Status -eq 'Up' -and (Get-NatGwIPv4 -InterfaceIndex $Adapter.ifIndex) -ne '')
}

# usb: a USB adapter with link + IPv4, preferring the one holding a default route.
function Resolve-NatGwWan {
    param([object[]]$Adapters)
    $defaultIndexes = @()
    $fallback = $null
    $candidate = $null
    $script:NatGwWan = $null
    if ($script:NatGwConfig.WAN_SELECT -ne 'usb') {
        $candidate = Resolve-NatGwAdapterName -Wanted $script:NatGwConfig.WAN_SELECT -Adapters $Adapters
        if (Test-NatGwWanReady -Adapter $candidate) { $script:NatGwWan = $candidate }
        return
    }
    $defaultIndexes = Get-NatGwDefaultRouteIndexes
    foreach ($adapter in $Adapters) {
        if (-not (Test-NatGwUsb -Adapter $adapter)) { continue }
        if (-not (Test-NatGwWanReady -Adapter $adapter)) { continue }
        if ($defaultIndexes -contains [int]$adapter.ifIndex) {
            $script:NatGwWan = $adapter
            return
        }
        if (-not $fallback) { $fallback = $adapter }
    }
    $script:NatGwWan = $fallback
}

function Test-NatGwLanEligible {
    param($Adapter)
    if (-not $Adapter) { return $false }
    if (Test-NatGwWireless -Adapter $Adapter) { return $false }
    if ($script:NatGwWan -and $Adapter.InterfaceGuid -eq $script:NatGwWan.InterfaceGuid) { return $false }
    return $true
}

# all: every onboard wired port (a Network Bridge first), except ports carrying this host's own
# default route that are not already relaying. one/list: the named ports, in order.
# ICS relays on one port: the first candidate with link wins, else the first candidate.
function Resolve-NatGwLan {
    param([object[]]$Adapters, [string]$AppliedPrivateGuid = '')
    $defaultIndexes = @()
    $entries = @()
    $candidates = @()
    $adapter = $null
    $script:NatGwLan = $null
    $script:NatGwLanCandidates = @()
    $script:NatGwLanSkipped = @()
    if (-not $script:NatGwWan) { return }

    if ($script:NatGwConfig.LAN_MODE -eq 'all') {
        $defaultIndexes = Get-NatGwDefaultRouteIndexes
        foreach ($adapter in @(@($Adapters | Where-Object { Test-NatGwBridge -Adapter $_ }) + @($Adapters | Where-Object { -not (Test-NatGwBridge -Adapter $_) }))) {
            if (-not (Test-NatGwLanEligible -Adapter $adapter)) { continue }
            if (Test-NatGwUsb -Adapter $adapter) { continue }
            if (($defaultIndexes -contains [int]$adapter.ifIndex) -and $adapter.InterfaceGuid -ne $AppliedPrivateGuid) {
                $script:NatGwLanSkipped += ('{0}(default-route)' -f $adapter.Name)
                continue
            }
            $candidates += $adapter
        }
    } else {
        $entries = @($script:NatGwConfig.LAN_PORTS.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        foreach ($entry in $entries) {
            $adapter = Resolve-NatGwAdapterName -Wanted $entry -Adapters $Adapters
            if (-not (Test-NatGwLanEligible -Adapter $adapter)) {
                $script:NatGwLanSkipped += ('{0}(unavailable)' -f $entry)
                continue
            }
            if (@($candidates | Where-Object { $_.InterfaceGuid -eq $adapter.InterfaceGuid }).Count -gt 0) { continue }
            $candidates += $adapter
            if ($script:NatGwConfig.LAN_MODE -eq 'one') { break }
        }
    }
    $script:NatGwLanCandidates = $candidates
    $script:NatGwLan = $candidates | Where-Object { [string]$_.Status -eq 'Up' } | Select-Object -First 1
    if (-not $script:NatGwLan) { $script:NatGwLan = $candidates | Select-Object -First 1 }
}

# ------------------------------------------------------------------- ICS ----

function Get-NatGwSharingEntries {
    $manager = New-Object -ComObject HNetCfg.HNetShare
    $entries = @()
    foreach ($connection in @($manager.EnumEveryConnection)) {
        $props = $manager.NetConnectionProps.Invoke($connection)
        $config = $manager.INetSharingConfigurationForINetConnection.Invoke($connection)
        $entries += [pscustomobject]@{
            Guid    = [string]$props.Guid
            Name    = [string]$props.Name
            Config  = $config
            Enabled = [bool]$config.SharingEnabled
            Type    = [int]$config.SharingConnectionType
        }
    }
    return $entries
}

function Get-NatGwAppliedState {
    param([object[]]$Entries)
    $public = $Entries | Where-Object { $_.Enabled -and $_.Type -eq $script:NatGwSharingPublic } | Select-Object -First 1
    $private = $Entries | Where-Object { $_.Enabled -and $_.Type -eq $script:NatGwSharingPrivate } | Select-Object -First 1
    return [pscustomobject]@{
        PublicGuid  = $(if ($public) { $public.Guid } else { '' })
        PublicName  = $(if ($public) { $public.Name } else { '' })
        PrivateGuid = $(if ($private) { $private.Guid } else { '' })
        PrivateName = $(if ($private) { $private.Name } else { '' })
    }
}

function Get-NatGwScopeAddress {
    $item = Get-ItemProperty -LiteralPath $script:NatGwIcsParametersKey -Name 'ScopeAddress' -ErrorAction SilentlyContinue
    if ($item) { return [string]$item.ScopeAddress }
    return ''
}

# ICS reads ScopeAddress when sharing is enabled, so callers disable sharing first.
function Set-NatGwScopeAddress {
    param([Parameter(Mandatory = $true)][string]$GatewayIp)
    if (-not (Test-Path -LiteralPath $script:NatGwIcsParametersKey)) { New-Item -Path $script:NatGwIcsParametersKey -Force | Out-Null }
    Set-ItemProperty -LiteralPath $script:NatGwIcsParametersKey -Name 'ScopeAddress' -Value $GatewayIp -Type String
    Set-ItemProperty -LiteralPath $script:NatGwIcsParametersKey -Name 'ScopeAddressBackup' -Value $GatewayIp -Type String
    Restart-Service -Name $script:NatGwIcsServiceName -Force -ErrorAction SilentlyContinue
}

# Only sharing on physical/bridge adapters is ours; Hyper-V/WSL switches are never touched.
function Clear-NatGwSharing {
    param([string]$Reason = '')
    $ownGuids = @(Get-NatGwAdapters | ForEach-Object { [string]$_.InterfaceGuid })
    foreach ($entry in @(Get-NatGwSharingEntries)) {
        if (-not $entry.Enabled -or $ownGuids -notcontains $entry.Guid) { continue }
        $entry.Config.DisableSharing()
        Write-NatGwLog ('Sharing disabled on {0}{1}' -f $entry.Name, $(if ($Reason) { " ($Reason)" } else { '' }))
    }
}

function Set-NatGwSharing {
    param([Parameter(Mandatory = $true)][string]$WanGuid, [Parameter(Mandatory = $true)][string]$LanGuid)
    $entries = @(Get-NatGwSharingEntries)
    foreach ($entry in $entries) {
        if (-not $entry.Enabled) { continue }
        if ($entry.Guid -eq $WanGuid -and $entry.Type -eq $script:NatGwSharingPublic) { continue }
        if ($entry.Guid -eq $LanGuid -and $entry.Type -eq $script:NatGwSharingPrivate) { continue }
        $entry.Config.DisableSharing()
        Write-NatGwLog "Sharing disabled on $($entry.Name) (replaced)"
    }
    foreach ($entry in $entries) {
        if ($entry.Guid -eq $WanGuid -and -not ($entry.Enabled -and $entry.Type -eq $script:NatGwSharingPublic)) {
            $entry.Config.EnableSharing($script:NatGwSharingPublic)
            Write-NatGwLog "Uplink (public): $($entry.Name)"
        }
    }
    foreach ($entry in $entries) {
        if ($entry.Guid -eq $LanGuid -and -not ($entry.Enabled -and $entry.Type -eq $script:NatGwSharingPrivate)) {
            $entry.Config.EnableSharing($script:NatGwSharingPrivate)
            Write-NatGwLog "Relay (private): $($entry.Name)"
        }
    }
}

# ICS must survive reboots (SharedAccess automatic + EnableRebootPersistConnection).
function Enable-NatGwIcsPersistence {
    if (-not (Test-Path -LiteralPath $script:NatGwIcsPersistKey)) { New-Item -Path $script:NatGwIcsPersistKey -Force | Out-Null }
    Set-ItemProperty -LiteralPath $script:NatGwIcsPersistKey -Name $script:NatGwIcsPersistValue -Value 1 -Type DWord
    Set-Service -Name $script:NatGwIcsServiceName -StartupType Automatic -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------- reconcile ----

# Desired state from router.conf + live adapters, compared with the applied ICS pair; only a
# difference changes anything. A failure is logged once per distinct state.
function Invoke-NatGwReconcile {
    $adapters = @()
    $entries = @()
    $applied = $null
    $state = ''
    $addressChanged = $false

    Read-NatGwConfig
    $adapters = Get-NatGwAdapters
    $entries = @(Get-NatGwSharingEntries)
    $applied = Get-NatGwAppliedState -Entries $entries
    Resolve-NatGwWan -Adapters $adapters
    Resolve-NatGwLan -Adapters $adapters -AppliedPrivateGuid $applied.PrivateGuid

    if (-not $script:NatGwWan -or -not $script:NatGwLan) {
        $state = $(if (-not $script:NatGwWan) { 'idle: no uplink ready' } else { 'idle: no relay port' })
        if ($script:NatGwLanSkipped.Count -gt 0) { $state = '{0} (skipped: {1})' -f $state, ($script:NatGwLanSkipped -join ' ') }
        if ($state -ne $script:NatGwLastState) {
            Write-NatGwLog $state
            Clear-NatGwSharing -Reason $state
            $script:NatGwLastState = $state
        }
        return
    }

    $addressChanged = (Get-NatGwScopeAddress) -ne $script:NatGwGatewayIp
    $state = 'active: {0} -> {1} ({2})' -f $script:NatGwWan.Name, $script:NatGwLan.Name, $script:NatGwConfig.LAN_ADDRESS
    if (-not $addressChanged -and $applied.PublicGuid -eq $script:NatGwWan.InterfaceGuid -and $applied.PrivateGuid -eq $script:NatGwLan.InterfaceGuid) {
        $script:NatGwLastState = $state
        return
    }
    try {
        if ($addressChanged) {
            Clear-NatGwSharing -Reason 'gateway address change'
            Set-NatGwScopeAddress -GatewayIp $script:NatGwGatewayIp
        }
        Set-NatGwSharing -WanGuid $script:NatGwWan.InterfaceGuid -LanGuid $script:NatGwLan.InterfaceGuid
        Write-NatGwLog $state
        $script:NatGwLastState = $state
    } catch {
        $state = 'failed: {0}' -f $_.Exception.Message
        if ($state -ne $script:NatGwLastState) { Write-NatGwLog $state }
        $script:NatGwLastState = $state
    }
}

# ---------------------------------------------------------------- report ----

function Get-NatGwPortRole {
    param($Adapter, $Applied, [int[]]$DefaultIndexes)
    if ($Adapter.InterfaceGuid -eq $Applied.PublicGuid) { return 'uplink (shared)' }
    if ($Adapter.InterfaceGuid -eq $Applied.PrivateGuid) { return 'relay (ICS private)' }
    if ($script:NatGwWan -and $Adapter.InterfaceGuid -eq $script:NatGwWan.InterfaceGuid) { return 'uplink (pending)' }
    if (@($script:NatGwLanCandidates | Where-Object { $_.InterfaceGuid -eq $Adapter.InterfaceGuid }).Count -gt 0) { return 'relay candidate' }
    if ($DefaultIndexes -contains [int]$Adapter.ifIndex) { return 'default route' }
    return 'idle'
}

function Show-NatGwPorts {
    $adapters = Get-NatGwAdapters
    $applied = Get-NatGwAppliedState -Entries @(Get-NatGwSharingEntries)
    $defaultIndexes = Get-NatGwDefaultRouteIndexes
    Read-NatGwConfig
    Resolve-NatGwWan -Adapters $adapters
    Resolve-NatGwLan -Adapters $adapters -AppliedPrivateGuid $applied.PrivateGuid
    $adapters | ForEach-Object {
        [pscustomobject]@{
            Name   = $_.Name
            Bus    = $(if (Test-NatGwBridge -Adapter $_) { 'bridge' } elseif (Test-NatGwUsb -Adapter $_) { 'usb' } else { 'onboard' })
            Medium = $(if (Test-NatGwWireless -Adapter $_) { 'wifi' } else { 'wired' })
            Link   = [string]$_.Status
            IPv4   = Get-NatGwIPv4 -InterfaceIndex $_.ifIndex
            Role   = Get-NatGwPortRole -Adapter $_ -Applied $applied -DefaultIndexes $defaultIndexes
            Device = $_.InterfaceDescription
        }
    } | Format-Table -AutoSize | Out-Host
}

function Show-NatGwStatus {
    param([string]$ServiceState = '')
    $adapters = Get-NatGwAdapters
    $applied = Get-NatGwAppliedState -Entries @(Get-NatGwSharingEntries)
    $lanIndex = 0
    $lanAdapter = $null
    $icsService = Get-Service -Name $script:NatGwIcsServiceName -ErrorAction SilentlyContinue
    $icsState = $(if ($icsService) { [string]$icsService.Status } else { 'absent' })
    Read-NatGwConfig
    Resolve-NatGwWan -Adapters $adapters
    Resolve-NatGwLan -Adapters $adapters -AppliedPrivateGuid $applied.PrivateGuid

    Write-Host "Config:   $script:NatGwConfigFile"
    Write-Host ('Settings: uplink={0} relay={1}{2} gateway={3} dhcp=always (ICS)' -f $script:NatGwConfig.WAN_SELECT, $script:NatGwConfig.LAN_MODE,
        $(if ($script:NatGwConfig.LAN_PORTS) { " ($($script:NatGwConfig.LAN_PORTS))" } else { '' }), $script:NatGwConfig.LAN_ADDRESS)
    Write-Host "Service:  $script:NatGwServiceName $ServiceState | ICS service: $icsState"
    Write-Host ('Desired:  {0} -> {1}' -f $(if ($script:NatGwWan) { $script:NatGwWan.Name } else { '(no uplink ready)' }), $(if ($script:NatGwLan) { $script:NatGwLan.Name } else { '(no relay port)' }))
    if ($script:NatGwLanSkipped.Count -gt 0) { Write-Host "Skipped:  $($script:NatGwLanSkipped -join ' ')" }
    Write-Host ('Applied:  public={0} private={1} scope={2}' -f $(if ($applied.PublicName) { $applied.PublicName } else { '-' }), $(if ($applied.PrivateName) { $applied.PrivateName } else { '-' }), (Get-NatGwScopeAddress))
    if (-not $applied.PrivateGuid) { return }
    $lanAdapter = $adapters | Where-Object { $_.InterfaceGuid -eq $applied.PrivateGuid } | Select-Object -First 1
    if (-not $lanAdapter) { return }
    $lanIndex = [int]$lanAdapter.ifIndex
    Write-Host "Relay IP: $(Get-NatGwIPv4 -InterfaceIndex $lanIndex)"
    Write-Host 'Clients:'
    Get-NetNeighbor -InterfaceIndex $lanIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { @('Reachable', 'Stale', 'Delay', 'Probe') -contains [string]$_.State -and $_.LinkLayerAddress -notmatch '^(ff-){5}ff$|^01-00-5e' } |
        Select-Object IPAddress, LinkLayerAddress, State | Format-Table -AutoSize | Out-Host
}
