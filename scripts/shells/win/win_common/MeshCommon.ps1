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

function Get-MeshBaseDomain {
    $labels = @()

    if ((Get-MeshVpnProvider) -ne $script:MeshProviderHeadscale) {
        return [string](Get-ServiceContractValue -ContractPath 'access.mesh.tailscale.dns_suffix')
    }
    $labels = @((Get-ServiceContractValue -ContractPath 'access.mesh.headscale.base_domain_labels') | ForEach-Object { [string]$_ })
    return ((@($labels) + @(Get-MeshRootDomain)) -join '.')
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
