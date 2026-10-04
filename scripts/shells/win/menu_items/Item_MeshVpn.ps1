param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'MESH_VPN_PROVIDER'
    Key   = 'T'
    Order = 75
    Title = 'Mesh VPN After Installation'
    Var   = 'MESH_VPN_PROVIDER'
    Values = @('headscale','tailscale','none')
    Presets = @{ desktop = 'headscale'; server = 'headscale' }
    Steps = @(
        'Step97_InstallTailscale.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
