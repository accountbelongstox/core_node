# Mesh VPN provider resolver (headscale | tailscale | none). Windows twin of
# scripts/shells/linux/common/mesh_common.sh; every value comes from the service
# contract `access.mesh` and the shared gvars, nothing is hardcoded here.
$script:MeshCommonDirectory = Split-Path -Parent $PSCommandPath
$script:MeshServiceContractPath = Join-Path $script:MeshCommonDirectory 'ServiceContract.ps1'
$script:MeshProviderVarKey = 'MESH_VPN_PROVIDER'
$script:MeshRegionVarKey = 'DOMAIN_API_REGION_PREFIX'
$script:MeshProviderHeadscale = 'headscale'
$script:MeshProviderTailscale = 'tailscale'
$script:MeshProviderNone = 'none'
$script:MeshAppliedProviderVarKey = 'MESH_VPN_APPLIED_PROVIDER'
$script:MeshTailscaleControlUrl = 'https://controlplane.tailscale.com'

if (-not (Get-Command -Name 'Get-ServiceContractValue' -ErrorAction SilentlyContinue)) {
    . $script:MeshServiceContractPath
}

function Get-MeshStoredVar {
    param(
        [Parameter(Mandatory = $true)][string]$Key,
        [string]$DefaultValue = ''
    )
    $stored = ''

    if (-not (Get-Command -Name 'Get-GlobalVar' -ErrorAction SilentlyContinue)) {
        return $DefaultValue
    }
    $stored = [string](Get-GlobalVar -key $Key -defaultValue $DefaultValue)
    if ([string]::IsNullOrWhiteSpace($stored)) {
        return $DefaultValue
    }
    return $stored.Trim()
}

function Get-MeshProviderList {
    return @((Get-ServiceContractValue -ContractPath 'access.mesh.providers') | ForEach-Object { [string]$_ })
}

function Get-MeshVpnProvider {
    $defaultProvider = [string](Get-ServiceContractValue -ContractPath 'access.mesh.provider_default')
    $providerKey = [string](Get-ServiceContractValue -ContractPath 'access.mesh.provider_key')
    $provider = ''

    $provider = (Get-MeshStoredVar -Key $providerKey -DefaultValue $defaultProvider).ToLowerInvariant()
    if ((Get-MeshProviderList) -contains $provider) {
        return $provider
    }
    return $defaultProvider
}

function Set-MeshVpnProvider {
    param([Parameter(Mandatory = $true)][string]$Provider)
    $providerKey = [string](Get-ServiceContractValue -ContractPath 'access.mesh.provider_key')
    $normalized = $Provider.Trim().ToLowerInvariant()

    if ((Get-MeshProviderList) -notcontains $normalized) {
        return $false
    }
    Set-GlobalVar -key $providerKey -value $normalized
    return $true
}

function Get-MeshNextProvider {
    param([Parameter(Mandatory = $true)][string]$Current)
    $providers = @(Get-MeshProviderList)
    $index = [array]::IndexOf($providers, $Current)

    if ($index -lt 0) {
        return $providers[0]
    }
    return $providers[($index + 1) % $providers.Count]
}

function Get-MeshRegionPrefix {
    $defaultRegion = [string](Get-ServiceContractValue -ContractPath 'access.default_api_region_prefix')

    return (Get-MeshStoredVar -Key $script:MeshRegionVarKey -DefaultValue $defaultRegion).ToLowerInvariant()
}

function Get-MeshRootDomain {
    $roots = @((Get-ServiceContractValue -ContractPath 'access.root_domains') | ForEach-Object { [string]$_ })
    $rootIndex = [int](Get-ServiceContractValue -ContractPath 'access.mesh.headscale.root_domain_index')

    if ($rootIndex -lt 0 -or $rootIndex -ge $roots.Count) {
        $rootIndex = 0
    }
    return $roots[$rootIndex]
}

function Get-MeshLoginServerHost {
    $region = Get-MeshRegionPrefix
    $labels = @((Get-ServiceContractValue -ContractPath 'access.mesh.headscale.server_labels') | ForEach-Object { ([string]$_).Replace('{region}', $region) })

    return ((@($labels) + @(Get-MeshRootDomain)) -join '.')
}

function Get-MeshLoginServerUrl {
    if ((Get-MeshVpnProvider) -ne $script:MeshProviderHeadscale) {
        return [string](Get-ServiceContractValue -ContractPath 'access.mesh.tailscale.login_server')
    }
    return ('https://{0}' -f (Get-MeshLoginServerHost))
}

function Get-MeshHeadscaleBaseDomain {
    $labels = @((Get-ServiceContractValue -ContractPath 'access.mesh.headscale.base_domain_labels') | ForEach-Object { [string]$_ })

    return ((@($labels) + @(Get-MeshRootDomain)) -join '.')
}

function Get-MeshBaseDomain {
    if ((Get-MeshVpnProvider) -ne $script:MeshProviderHeadscale) {
        return [string](Get-ServiceContractValue -ContractPath 'access.mesh.tailscale.dns_suffix')
    }
    return (Get-MeshHeadscaleBaseDomain)
}

function Get-MeshDnsSuffix {
    return (Get-MeshBaseDomain)
}

function Get-MeshCertSource {
    $provider = Get-MeshVpnProvider

    if ($provider -eq $script:MeshProviderHeadscale) {
        return [string](Get-ServiceContractValue -ContractPath 'access.mesh.headscale.cert_source')
    }
    if ($provider -eq $script:MeshProviderTailscale) {
        return [string](Get-ServiceContractValue -ContractPath 'access.mesh.tailscale.cert_source')
    }
    return ''
}

# True only when the control server answers: Headscale needs GET <url>/health whose body contains
# "pass" (a wildcard site can return an empty 200); for the
# Tailscale control plane any HTTP response counts as reachable.
function Test-MeshControlServerReachable {
    param([Parameter(Mandatory = $true)][string]$Url)
    $probeUrl = $Url.TrimEnd('/')
    $response = $null
    $isHeadscaleUrl = ($probeUrl -ne $script:MeshTailscaleControlUrl)

    if ($isHeadscaleUrl) {
        $probeUrl = '{0}/health' -f $probeUrl
    }
    try {
        $response = Invoke-WebRequest -Uri $probeUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($isHeadscaleUrl) {
            return ([string]$response.Content).Contains('pass')
        }
        return $true
    } catch {
        if (-not $isHeadscaleUrl -and $null -ne $_.Exception.PSObject.Properties['Response'] -and $null -ne $_.Exception.Response) {
            return $true
        }
        return $false
    }
}

# Control URL the active provider wants the client to use.
function Get-MeshDesiredControlUrl {
    $provider = Get-MeshVpnProvider

    if ($provider -eq $script:MeshProviderHeadscale) {
        return (Get-MeshLoginServerUrl).TrimEnd('/')
    }
    return $script:MeshTailscaleControlUrl
}

# Live control URL of this node (`tailscale debug prefs` ControlURL); an empty value is the SaaS default.
function Get-MeshActualControlUrl {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $actualUrl = ''

    if (Get-Command -Name 'Get-HeadscaleCurrentControlUrl' -ErrorAction SilentlyContinue) {
        $actualUrl = Get-HeadscaleCurrentControlUrl -TailscaleExe $TailscaleExe
    }
    if ([string]::IsNullOrWhiteSpace($actualUrl)) {
        return $script:MeshTailscaleControlUrl
    }
    return $actualUrl.TrimEnd('/')
}

function Set-MeshServiceEnabled {
    param([Parameter(Mandatory = $true)][bool]$Enabled)
    $serviceName = [string]$script:TailscaleServiceName
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if ($null -eq $service) {
        return $true
    }
    try {
        if ($Enabled) {
            Set-Service -Name $serviceName -StartupType Automatic -ErrorAction Stop
            if ($service.Status -ne 'Running') { Start-Service -Name $serviceName -ErrorAction Stop }
        } else {
            if ($service.Status -ne 'Stopped') { Stop-Service -Name $serviceName -Force -ErrorAction Stop }
            Set-Service -Name $serviceName -StartupType Disabled -ErrorAction Stop
        }
    } catch {
        Write-ColorMessage -Message "Could not change the '$serviceName' service (run elevated): $($_.Exception.Message)" -Type 'Warning'
        return $false
    }
    return $true
}

# Re-render the tailnet HTTPS site for the active suffix (certificates + Caddy route); no-op without FrankenPHP.
function Update-MeshTailnetSite {
    if (-not (Get-Command -Name 'Ensure-FrankenPhpLanLocalRoute' -ErrorAction SilentlyContinue)) {
        return $true
    }
    if ($null -eq (Get-Service -Name (Get-FrankenPhpServiceName) -ErrorAction SilentlyContinue)) {
        return $true
    }
    [void](Ensure-FrankenPhpLanLocalCertificates)
    [void](Ensure-FrankenPhpLanLocalRoute)
    [void](Ensure-FrankenPhpCaddyfile)
    [void](Invoke-FrankenPhpReload)
    return $true
}

# One idempotent converge pass for the selected provider: every step probes live state first and a
# rerun with no change does nothing. Windows has no Headscale server, so the server step does not apply.
function Invoke-MeshProviderConverge {
    param(
        [switch]$SkipSite,
        [switch]$NoInteractive
    )
    $provider = Get-MeshVpnProvider
    $installInfo = Get-TailscaleInstallInfo
    $desiredUrl = Get-MeshDesiredControlUrl
    $actualUrl = ''
    $summary = $null
    $succeeded = $true
    $siteBlocked = $false

    if ($provider -eq $script:MeshProviderNone) {
        if ($installInfo.Installed) {
            & $installInfo.ExePath 'down' 2>$null | Out-Null
            if (-not (Set-MeshServiceEnabled -Enabled $false)) { $succeeded = $false }
        }
    } elseif (-not $installInfo.Installed) {
        Show-TailscaleNotInstalledMessage
        $succeeded = $false
    } else {
        if (-not (Set-MeshServiceEnabled -Enabled $true)) { $succeeded = $false }
        $actualUrl = Get-MeshActualControlUrl -TailscaleExe $installInfo.ExePath
        $summary = Get-TailscaleStatusSummary -TailscaleExe $installInfo.ExePath
        if ($actualUrl -ne $desiredUrl -and -not (Test-MeshControlServerReachable -Url $desiredUrl)) {
            Write-ColorMessage -Message "Desired control server unreachable ($desiredUrl); staying on $actualUrl." -Type 'Warning'
            $succeeded = $false
            $siteBlocked = $true
        } elseif ($NoInteractive -and ($actualUrl -ne $desiredUrl -or $summary.BackendState -eq 'NeedsLogin') -and
            ($provider -ne $script:MeshProviderHeadscale -or [string]::IsNullOrWhiteSpace((Get-HeadscaleAuthKey)))) {
            Write-ColorMessage -Message "Mesh VPN node needs login for provider '$provider'; run Login in the Tailscale menu (non-interactive converge skipped it)." -Type 'Warning'
            $succeeded = $false
        } elseif ($actualUrl -ne $desiredUrl) {
            if ($provider -eq $script:MeshProviderHeadscale) {
                if (-not (Invoke-HeadscaleLogin -TailscaleExe $installInfo.ExePath)) { $succeeded = $false }
            } else {
                Write-ColorMessage -Message "Switching this node to the Tailscale control plane (logout first, the node IP will change)." -Type 'Warning'
                & $installInfo.ExePath 'logout'
                & $installInfo.ExePath 'login' ('--login-server={0}' -f $desiredUrl)
            }
        } elseif ($summary.BackendState -eq 'NeedsLogin') {
            if (-not (Invoke-TailscaleLogin)) { $succeeded = $false }
        } elseif ($summary.BackendState -eq 'Stopped') {
            & $installInfo.ExePath 'up'
        }
    }

    if (-not $SkipSite -and -not $siteBlocked -and -not (Update-MeshTailnetSite)) { $succeeded = $false }
    if ($succeeded) {
        Set-GlobalVar -key $script:MeshAppliedProviderVarKey -value $provider
    }
    return $succeeded
}
