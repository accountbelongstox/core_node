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
# resolves the single system Python 3.13 and skips when already satisfied.

$ErrorActionPreference = 'Stop'

$failed             = @()
$neuralBatchInstall = ($env:NEURAL_TTS_INSTALL -eq '1')
$manifestPath       = Join-Path $PSScriptRoot 'PycorePrerequisitesList.ps1'
$winCommonDir       = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. $manifestPath

Write-Host '------------------------------------------------------' -ForegroundColor Cyan
Write-Host ' Pycore prerequisites (PreparePycorePrerequisites)' -ForegroundColor Cyan
Write-Host '------------------------------------------------------' -ForegroundColor Cyan

foreach ($entry in $PycorePrerequisiteScripts) {
    $name = $entry.Key

    Write-Host ("[..] Prerequisite: {0}" -f $name) -ForegroundColor Yellow

    $scriptPath = Get-PycorePrerequisiteScriptPath -ScriptName $entry.Script
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Write-Host ("[!] {0} missing: {1}" -f $name, $scriptPath) -ForegroundColor DarkYellow
        $failed += $name
        continue
    }

    $invokeArgs = @{}
    if ($neuralBatchInstall -and ($NeuralTtsOptInKeys -contains $name)) {
        if (Test-InstallScriptSwitch -ScriptPath $scriptPath -SwitchName 'Full') {
            $invokeArgs['Full'] = $true
        }
    }
    elseif ($env:MELOTTS_INSTALL -eq '1' -and $name -eq 'melotts') {
        if (Test-InstallScriptSwitch -ScriptPath $scriptPath -SwitchName 'Full') {
            $invokeArgs['Full'] = $true
        }
    }

    try {
        if ($invokeArgs.Count -gt 0) {
            & $scriptPath @invokeArgs
        } else {
            & $scriptPath
        }
    } catch {
        Write-Host ("[!] {0} threw: {1}" -f $name, $_.Exception.Message) -ForegroundColor DarkYellow
        $failed += $name
    }
}

if ($failed.Count -gt 0) {
    Write-Host ("[!] Some prerequisites did not complete cleanly: {0}" -f ($failed -join ', ')) -ForegroundColor DarkYellow
    exit 0
}

Write-Host '[OK] All prerequisites complete.' -ForegroundColor Green
exit 0
