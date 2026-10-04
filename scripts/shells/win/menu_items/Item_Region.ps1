param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'SELECTED_REGION'
    Key   = '@'
    Order = 20
    Title = 'Select Region'
    Var   = 'SELECTED_REGION'
    Values = @('China','Global')
    Steps = @(
        'Node_Runtime.ps1'
        'Python_Default.ps1'
        'Step28_InstallFlutter.ps1'
        'Qt_BuildTools.ps1'
        'Step44_CheckCoreNodeProject.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
