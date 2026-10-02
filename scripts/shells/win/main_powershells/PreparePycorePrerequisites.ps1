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
$pendingPrerequisites = [System.Collections.Generic.List[string]]::new()
$stepState = ''
$stepPending = $false
$scriptName = ''
$localAiInstallEnv = ''
. (Join-Path $winCommonDir 'GlobalVars.ps1')
Set-Variable -Name 'PycoreGlobalVarsLoaded' -Scope Script -Value $true
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. $manifestPath
. (Join-Path $winCommonDir 'ServiceContract.ps1')

$localAiInstallEnv = [string](Get-ServiceContractValue -ContractPath 'local_ai.install_env')

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

    # Local AI runtime (Ollama + translation model, GBs): opt-in on regular hosts.
    if ($installMode -eq 'local_ai' -and $Include.Count -eq 0 -and [Environment]::GetEnvironmentVariable($localAiInstallEnv, 'Process') -ne '1') {
        Write-Host ("[skip] {0} (opt-in: {1}=1 or -Include {0})" -f $name, $localAiInstallEnv) -ForegroundColor DarkGray
        continue
    }

    $skipVariable = [string]$entry.SkipEnv
    $skipValue = if ($skipVariable) { [Environment]::GetEnvironmentVariable($skipVariable, 'Process') } else { '' }
    if ($skipValue -eq '1') {
        Write-Host ("[skip] {0} ({1}=1)" -f $name, $skipVariable) -ForegroundColor DarkGray
        continue
    }

    Write-Host ("[..] Prerequisite: {0}" -f $name) -ForegroundColor Yellow

    $stepPending = $false
    foreach ($scriptName in $entry.Scripts) {
        $scriptPath = Get-PycorePrerequisiteScriptPath -ScriptName $scriptName
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

        Set-GlobalVar -key 'PYCORE_PREREQUISITE_STEP_STATE' -value 'running' | Out-Null
        if ($invokeArgs.Count -gt 0) {
            & $scriptPath @invokeArgs
        } else {
            & $scriptPath
        }
        $stepState = Get-GlobalVar -key 'PYCORE_PREREQUISITE_STEP_STATE' -defaultValue 'running'
        if ($stepState -eq 'pending') { $stepPending = $true }
    }
    if ($stepPending) { [void]$pendingPrerequisites.Add($name) }
}

if ($pendingPrerequisites.Count -gt 0) {
    Write-Host ("[!] Prerequisite installers finished; pending: {0}. Re-run after resolving the reported failures." -f ($pendingPrerequisites -join ', ')) -ForegroundColor DarkYellow
} else {
    Write-Host '[OK] Prerequisite installers finished.' -ForegroundColor Green
}
