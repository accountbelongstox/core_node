# AI model install level (contract `ai_models`; installer menu item [A]). Callers: InstallItemRunner.ps1
# (DevInstaller sweep and item runs), PreparePycorePrerequisites.ps1, menu_items/Item_AiModels.ps1.
$script:AiModelCommonDirectory = Split-Path -Parent $PSCommandPath
$script:AiModelCudaIndexPath = Join-Path $script:AiModelCommonDirectory 'CudaIndex.ps1'
if (-not (Get-Command -Name 'Get-ServiceContractValue' -ErrorAction SilentlyContinue)) {
    . (Join-Path $script:AiModelCommonDirectory 'ServiceContract.ps1')
}
$script:AiModelContract = Get-ServiceContractValue -ContractPath 'ai_models'
$script:AiModelLevelKey = [string]$script:AiModelContract.level_key
$script:AiModelLevels = @($script:AiModelContract.levels | ForEach-Object { [string]$_ })
$script:AiModelGpuPresent = $null
$script:AiModelStepLevels = $null

function Test-AiModelGpuPresent {
    if ($null -eq $script:AiModelGpuPresent) {
        if (-not (Get-Command -Name 'Get-NvidiaSmiFirstGpuLine' -ErrorAction SilentlyContinue)) { . $script:AiModelCudaIndexPath }
        $script:AiModelGpuPresent = -not [string]::IsNullOrWhiteSpace((Get-NvidiaSmiFirstGpuLine))
    }
    return $script:AiModelGpuPresent
}

function Get-AiModelLevels { return $script:AiModelLevels }

function Get-AiModelLevelDefault {
    if (Test-AiModelGpuPresent) { return [string]$script:AiModelContract.default_gpu }
    return [string]$script:AiModelContract.default_cpu
}

function Get-AiModelLevel {
    $level = ([string](Get-GlobalVar -key $script:AiModelLevelKey -defaultValue '')).Trim().ToLowerInvariant()
    if ($script:AiModelLevels -notcontains $level) { return (Get-AiModelLevelDefault) }
    return $level
}

# Windows step script name -> level, from prerequisites.steps (by id) plus ai_models.extra_steps.
function Get-AiModelStepLevels {
    $map = @{}
    $levelsById = $script:AiModelContract.levels_by_id
    $row = $null
    $stepScript = ''

    if ($null -ne $script:AiModelStepLevels) { return $script:AiModelStepLevels }
    foreach ($row in @(@(Get-ServiceContractValue -ContractPath 'prerequisites.steps') + @($script:AiModelContract.extra_steps))) {
        if (-not $levelsById.PSObject.Properties[[string]$row.id]) { continue }
        foreach ($stepScript in @($row.windows)) { $map[[string]$stepScript] = [string]$levelsById.([string]$row.id) }
    }
    $script:AiModelStepLevels = $map
    return $map
}

# $true for a non-model step, or a model step whose level is within the selected level.
function Test-AiModelStepAllowed {
    param([Parameter(Mandatory = $true)][string]$ScriptName)
    $levels = Get-AiModelStepLevels
    $leaf = Split-Path -Leaf $ScriptName

    if (-not $levels.ContainsKey($leaf)) { return $true }
    return ([array]::IndexOf($script:AiModelLevels, $levels[$leaf]) -le [array]::IndexOf($script:AiModelLevels, (Get-AiModelLevel)))
}

function Write-AiModelStepSkipped {
    param([Parameter(Mandatory = $true)][string]$ScriptName)
    Write-Host ("[skip] {0} (model level {1} > {2}={3})" -f $ScriptName, (Get-AiModelStepLevels)[(Split-Path -Leaf $ScriptName)], $script:AiModelLevelKey, (Get-AiModelLevel)) -ForegroundColor DarkGray
}
