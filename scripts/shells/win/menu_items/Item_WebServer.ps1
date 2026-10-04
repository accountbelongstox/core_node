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
    Values = @('frankenphp','nginx','none')
    Setter = { param($Value) Set-WebServerPlane -Plane $Value }
    Presets = @{ desktop = 'frankenphp'; server = 'frankenphp' }
    Steps = @(
        'Web_Php.ps1'
        'Web_Nginx.ps1'
        'Web_FrankenPhp.ps1'
        'Web_Composer.ps1'
        'Web_ConfigurePhp85.ps1'
        'Step175_LaravelMainStart.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
