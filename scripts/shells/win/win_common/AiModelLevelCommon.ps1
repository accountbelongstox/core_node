# AI model install level (contract `ai_models`; installer menu item [A]). Callers: InstallItemRunner.ps1
# (DevInstaller sweep and item runs), PreparePycorePrerequisites.ps1, menu_items/Item_AiModels.ps1.
$Global:AiModelCommonDirectory = Split-Path -Parent $PSCommandPath
$Global:AiModelCudaIndexPath = Join-Path $Global:AiModelCommonDirectory 'CudaIndex.ps1'
if (-not (Get-Command -Name 'Get-ServiceContractValue' -ErrorAction SilentlyContinue)) {
    . (Join-Path $Global:AiModelCommonDirectory 'ServiceContract.ps1')
}
$Global:AiModelContract = Get-ServiceContractValue -ContractPath 'ai_models'
$Global:AiModelLevelKey = [string]$Global:AiModelContract.level_key
$Global:AiModelLevels = @($Global:AiModelContract.levels | ForEach-Object { [string]$_ })
$Global:AiModelGpuPresent = $null
$Global:AiModelStepLevels = $null

function Test-AiModelGpuPresent {
    if ($null -eq $Global:AiModelGpuPresent) {
        if (-not (Get-Command -Name 'Get-NvidiaSmiFirstGpuLine' -ErrorAction SilentlyContinue)) { . $Global:AiModelCudaIndexPath }
        $Global:AiModelGpuPresent = -not [string]::IsNullOrWhiteSpace((Get-NvidiaSmiFirstGpuLine))
    }
    return $Global:AiModelGpuPresent
}

function Get-AiModelLevels { return $Global:AiModelLevels }

function Get-AiModelLevelDefault {
    if (Test-AiModelGpuPresent) { return [string]$Global:AiModelContract.default_gpu }
    return [string]$Global:AiModelContract.default_cpu
}

function Get-AiModelLevel {
    $level = ([string](Get-GlobalVar -key $Global:AiModelLevelKey -defaultValue '')).Trim().ToLowerInvariant()
    if ($Global:AiModelLevels -notcontains $level) { return (Get-AiModelLevelDefault) }
    return $level
}

# Windows step script name -> level, from prerequisites.steps (by id) plus ai_models.extra_steps.
function Get-AiModelStepLevels {
    $map = @{}
    $levelsById = $Global:AiModelContract.levels_by_id
    $row = $null
    $stepScript = ''

    if ($null -ne $Global:AiModelStepLevels) { return $Global:AiModelStepLevels }
    foreach ($row in @(@(Get-ServiceContractValue -ContractPath 'prerequisites.steps') + @($Global:AiModelContract.extra_steps))) {
        if (-not $levelsById.PSObject.Properties[[string]$row.id]) { continue }
        foreach ($stepScript in @($row.windows)) { $map[[string]$stepScript] = [string]$levelsById.([string]$row.id) }
    }
    $Global:AiModelStepLevels = $map
    return $map
}

# $true for a non-model step, or a model step whose level is within the selected level.
function Test-AiModelStepAllowed {
    param([Parameter(Mandatory = $true)][string]$ScriptName)
    $levels = Get-AiModelStepLevels
    $leaf = Split-Path -Leaf $ScriptName

    if (-not $levels.ContainsKey($leaf)) { return $true }
    return ([array]::IndexOf($Global:AiModelLevels, $levels[$leaf]) -le [array]::IndexOf($Global:AiModelLevels, (Get-AiModelLevel)))
}

function Write-AiModelStepSkipped {
    param([Parameter(Mandatory = $true)][string]$ScriptName)
    Write-Host ("[skip] {0} (model level {1} > {2}={3})" -f $ScriptName, (Get-AiModelStepLevels)[(Split-Path -Leaf $ScriptName)], $Global:AiModelLevelKey, (Get-AiModelLevel)) -ForegroundColor DarkGray
}
