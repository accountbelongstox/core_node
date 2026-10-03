param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'START_WEB_SERVER'
    Key   = 'W'
    Order = 50
    Title = 'Web Server After Installation'
    Var   = 'START_WEB_SERVER'
    Values = @('frankenphp')
    Presets = @{ base = 'frankenphp'; server = 'frankenphp'; full = 'frankenphp'; desktop = 'frankenphp' }
    Steps = @(
        'Step16_InstallPHP.ps1'
        'Step93_InstallFrankenPHP.ps1'
        'Step94_InstallComposer.ps1'
        'Step96_ConfigurePHP85.ps1'
        'Step175_LaravelMainStart.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
