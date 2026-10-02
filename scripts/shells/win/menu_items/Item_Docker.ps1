param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'START_DOCKER'
    Key   = '^'
    Order = 60
    Title = 'Start Docker After Installation'
    Var   = 'START_DOCKER'
    Values = @('false','true')
    Steps = @(
        'Step29_InstallWSL.ps1'
        'Step30_InstallWSLDebian13.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
