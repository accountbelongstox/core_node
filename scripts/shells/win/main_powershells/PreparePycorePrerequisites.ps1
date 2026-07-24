# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Pycore prerequisite orchestrator (caller: pyservice.ps1).
# Runs install_powershells/Step*.ps1 in dependency order with no parameters; each Step
# resolves the centrally configured system Python and skips when already satisfied.

$ErrorActionPreference = 'Stop'

$neuralBatchInstall = ($env:NEURAL_TTS_INSTALL -eq '1')
$manifestPath       = Join-Path $PSScriptRoot 'PycorePrerequisitesList.ps1'
$winCommonDir       = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$name               = ''
$scriptPath         = ''
$invokeArgs         = @{}
$skipVariable       = ''
$skipValue          = ''
$installMode        = ''
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. $manifestPath

Write-Host '------------------------------------------------------' -ForegroundColor Cyan
Write-Host ' Pycore prerequisites (PreparePycorePrerequisites)' -ForegroundColor Cyan
Write-Host '------------------------------------------------------' -ForegroundColor Cyan
Write-Host '[i] Idempotent and SELF-REPAIRING: installed pip distributions are preserved; reruns repair' -ForegroundColor Cyan
Write-Host '    missing package metadata or incomplete model files. See TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.' -ForegroundColor Cyan

foreach ($entry in $PycorePrerequisiteScripts) {
    $name = $entry.Key
    $installMode = [string]$entry.InstallMode

    $skipVariable = [string]$entry.SkipEnv
    $skipValue = if ($skipVariable) { [Environment]::GetEnvironmentVariable($skipVariable, 'Process') } else { '' }
    if ($skipValue -eq '1') {
        Write-Host ("[skip] {0} ({1}=1)" -f $name, $skipVariable) -ForegroundColor DarkGray
        continue
    }

    Write-Host ("[..] Prerequisite: {0}" -f $name) -ForegroundColor Yellow

    $scriptPath = Get-PycorePrerequisiteScriptPath -ScriptName $entry.Script
    $invokeArgs = @{}
    if ($neuralBatchInstall -and $installMode -eq 'neural' -and $entry.Full) {
        $invokeArgs['Full'] = $true
    }
    elseif ($env:MELOTTS_INSTALL -eq '1' -and $name -eq 'melotts' -and $entry.Full) {
        $invokeArgs['Full'] = $true
    }

    if ($invokeArgs.Count -gt 0) {
        & $scriptPath @invokeArgs
    } else {
        & $scriptPath
    }
}

Write-Host '[OK] All prerequisites complete.' -ForegroundColor Green
