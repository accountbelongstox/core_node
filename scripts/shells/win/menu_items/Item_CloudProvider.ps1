param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'CLOUD_PROVIDER'
    Key   = 'C'
    Order = 90
    Title = 'Set Cloud Provider'
    Var   = 'CLOUD_PROVIDER'
    Values = @('null','Tencent','Alibaba','Huawei','Other')
    Presets = @{ desktop = 'null'; server = 'null' }
    Steps = @(
        'Wsl_Install.ps1'
        'Wsl_Debian13.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
