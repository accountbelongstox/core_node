# Pycore prerequisite manifest (caller: PreparePycorePrerequisites.ps1 / pyservice.ps1).
# Rows come from config/service_contract.json prerequisites.steps (windows[] in run order;
# an empty list means no Windows step). No list is hardcoded here.

$callerDir = Split-Path -Parent $PSCommandPath
$winDir = Split-Path $callerDir -Parent
$winCommonDir = Join-Path $winDir 'win_common'
$prerequisiteContract = $null
$prerequisiteRow = $null
$PycorePrerequisiteScripts = @()
$prerequisiteProvides = @()

. (Join-Path $winCommonDir 'ServiceContract.ps1')

$prerequisiteContract = Get-ServiceContractValue -ContractPath 'prerequisites'
$installPowerShellsDir = Join-Path (Split-Path (Split-Path (Split-Path $winDir -Parent) -Parent) -Parent) ([string]$prerequisiteContract.windows_script_dir)

foreach ($prerequisiteRow in @($prerequisiteContract.steps)) {
    if (@($prerequisiteRow.windows).Count -eq 0) { continue }
    $prerequisiteProvides = if ($prerequisiteRow.PSObject.Properties['provides']) { @($prerequisiteRow.provides) } else { @([string]$prerequisiteRow.id) }
    $PycorePrerequisiteScripts += @{
        Key         = [string]$prerequisiteRow.id
        Scripts     = @($prerequisiteRow.windows)
        SkipEnv     = [string]$prerequisiteRow.skip_env
        InstallMode = [string]$prerequisiteRow.mode
        Full        = [bool]$prerequisiteRow.full
        Provides    = $prerequisiteProvides
    }
}

function Get-PycorePrerequisiteScriptPath {
    param([string]$ScriptName)
    return Join-Path $installPowerShellsDir $ScriptName
}
