param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'INSTALL_NETWORK_ROUTER'
    Key   = '#'
    Order = 80
    Title = 'Setup Network Router'
    Var   = 'INSTALL_NETWORK_ROUTER'
    Values = @('false','true')
    Steps = @(
        'Step73_InstallNetworkRouter.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
