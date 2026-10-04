param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'DATABASE_ENGINE'
    Key   = 'D'
    Order = 30
    Title = 'Database After Installation'
    Var   = 'DATABASE_ENGINE'
    Values = @('pg','mysql','both','none')
    Setter = { param($Value) Set-DatabaseEngine -Engine $Value }
    Presets = @{ desktop = 'pg'; server = 'pg' }
    Steps = @(
        'Database_PostgreSQL.ps1'
        'Database_MySQL.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
