param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Key   = 'D'
    Order = 30
    Title = 'Database After Installation'
    Var   = 'DATABASE_ENGINE'
    Values = @('pg','none')
    Steps = @(
        'Step17_InstallPostgreSQL.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
