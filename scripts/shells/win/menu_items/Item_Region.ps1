param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Key   = '@'
    Order = 20
    Title = 'Select Region'
    Var   = 'SELECTED_REGION'
    Values = @('China','Global')
    Steps = @(
        'Step4_InstallNodeJS.ps1'
        'Step8_InstallDefaultPython.ps1'
        'Step28_InstallFlutter.ps1'
        'Step33_InstallQtBuildTools.ps1'
        'Step44_CheckCoreNodeProject.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
