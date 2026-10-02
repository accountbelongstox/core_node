param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'START_DOTNET'
    Key   = '.'
    Order = 70
    Title = 'Install .NET SDK'
    Var   = 'START_DOTNET'
    Values = @('false','true')
    Steps = @(
        'Step71_InstallDotnet.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
