param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$aiModelDefault = Get-AiModelLevelDefault
$item = @{
    Id    = 'AI_MODEL_LEVEL'
    Key   = 'A'
    Order = 100
    Title = 'AI Models After Installation'
    Var   = 'AI_MODEL_LEVEL'
    Values = @('basic','medium','full','none')
    Presets = @{ desktop = $aiModelDefault; server = $aiModelDefault }
    Steps = @(
        'Step46_InstallAiModels.ps1'
    )
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
