param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'START_REDIS'
    Key   = 'R'
    Order = 40
    Title = 'Start Redis After Installation'
    Var   = 'START_REDIS'
    Values = @('false','true')
    Presets = @{ base = 'true'; server = 'true'; full = 'true'; desktop = 'true' }
    Steps = @(
        'Step45_InstallRedis.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
