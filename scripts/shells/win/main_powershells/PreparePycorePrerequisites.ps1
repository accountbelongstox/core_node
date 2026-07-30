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

[CmdletBinding()]
param(
    [string]$Python = '',
    [string[]]$Include = @(),
    [string]$WhisperModel = '',
    [string]$FasterWhisperModel = '',
    [string]$VoskModel = '',
    [switch]$Full,
    [switch]$Force
)

# Pycore prerequisite orchestrator (caller: pyservice.ps1).
# Runs install_powershells/Step*.ps1 in dependency order and forwards only parameters
# declared by each installer.

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
$runtimeRunId       = [guid]::NewGuid().ToString('N')
$scriptCommand      = $null
$scriptParameters   = $null
$pythonPath         = ''
$requestedModel     = ''
. (Join-Path $winCommonDir 'GlobalVars.ps1')
Set-Variable -Name 'PycoreGlobalVarsLoaded' -Scope Script -Value $true
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. $manifestPath

$pythonPath = if ($Python) { $Python } else { $Global:PYTHON_EXE_PATH }
Set-GlobalVar -key 'PYCORE_RUNTIME_STATE_RUN_ID' -value $runtimeRunId
Set-GlobalVar -key 'PYCORE_RUNTIME_STATE_PROCESS_ID' -value ([string]$PID)

Write-Host '------------------------------------------------------' -ForegroundColor Cyan
Write-Host ' Pycore prerequisites (PreparePycorePrerequisites)' -ForegroundColor Cyan
Write-Host '------------------------------------------------------' -ForegroundColor Cyan
Write-Host '[i] Idempotent and SELF-REPAIRING: installed pip distributions are preserved; reruns repair' -ForegroundColor Cyan
Write-Host '    missing package metadata or incomplete model files. See TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.' -ForegroundColor Cyan

foreach ($entry in $PycorePrerequisiteScripts) {
    $name = $entry.Key
    $installMode = [string]$entry.InstallMode

    if ($Include.Count -gt 0 -and $Include -notcontains $name) {
        Write-Host ("[skip] {0} (not in -Include)" -f $name) -ForegroundColor DarkGray
        continue
    }

    $skipVariable = [string]$entry.SkipEnv
    $skipValue = if ($skipVariable) { [Environment]::GetEnvironmentVariable($skipVariable, 'Process') } else { '' }
    if ($skipValue -eq '1') {
        Write-Host ("[skip] {0} ({1}=1)" -f $name, $skipVariable) -ForegroundColor DarkGray
        continue
    }

    Write-Host ("[..] Prerequisite: {0}" -f $name) -ForegroundColor Yellow

    $scriptPath = Get-PycorePrerequisiteScriptPath -ScriptName $entry.Script
    $invokeArgs = @{}
    $scriptCommand = Get-Command -Name $scriptPath -CommandType ExternalScript
    $scriptParameters = $scriptCommand.Parameters
    if ($pythonPath -and $scriptParameters.ContainsKey('Python')) {
        $invokeArgs['Python'] = $pythonPath
    }
    if ($Force -and $scriptParameters.ContainsKey('Force')) {
        $invokeArgs['Force'] = $true
    }
    $requestedModel = switch ($name) {
        'faster_whisper' { $FasterWhisperModel }
        'whisper' { $WhisperModel }
        'vosk' { $VoskModel }
        default { '' }
    }
    if ($requestedModel -and $scriptParameters.ContainsKey('Model')) {
        $invokeArgs['Model'] = $requestedModel
    }
    if ($Full -and $entry.Full -and $scriptParameters.ContainsKey('Full')) {
        $invokeArgs['Full'] = $true
    }
    elseif ($neuralBatchInstall -and $installMode -eq 'neural' -and $entry.Full -and $scriptParameters.ContainsKey('Full')) {
        $invokeArgs['Full'] = $true
    }
    elseif ($env:MELOTTS_INSTALL -eq '1' -and $name -eq 'melotts' -and $entry.Full -and $scriptParameters.ContainsKey('Full')) {
        $invokeArgs['Full'] = $true
    }

    if ($invokeArgs.Count -gt 0) {
        & $scriptPath @invokeArgs
    } else {
        & $scriptPath
    }
}

Write-Host '[OK] All prerequisites complete.' -ForegroundColor Green
