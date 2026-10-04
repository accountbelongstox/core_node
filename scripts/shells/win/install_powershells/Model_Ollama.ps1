# Local AI translation runtime: Ollama (winget, user scope) plus the translation
# model from config/service_contract.json local_ai.translate_model (TranslateGemma).
# Serves GPU and CPU alike (Ollama picks CUDA when present).
#
# Opt-in prerequisite of PreparePycorePrerequisites.ps1 (InstallMode local_ai):
# runs when PYCORE_LOCAL_AI_INSTALL=1 or -Include ollama. Idempotent: an
# installed binary and an already pulled model are kept.
#
# Invocation contracts:
#   - pyservice flow: & Model_Ollama.ps1 [-Force]
[CmdletBinding()]
param(
    [string]$Python = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX         = '[Model_Ollama]'
$OLLAMA_WINGET_ID     = 'Ollama.Ollama'
$OLLAMA_HOST_ADDRESS  = '127.0.0.1'
$OLLAMA_READY_SECONDS = 30
$winCommonDir         = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$ollamaInstallDir     = Join-Path (Join-Path $env:LOCALAPPDATA 'Programs') 'Ollama'
$ollamaExe            = ''
$ollamaPort           = ''
$translateModel       = ''
$modelsSubdir         = ''
$modelsDir            = ''
$parallelEnvName      = ''
$parallelValue        = ''
$serveProcess         = $null
$installedModels      = @()
$ready                = $false
$attempt              = 0
$pullSucceeded        = $false

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'ServiceContract.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')

function Get-OllamaExecutable {
    $command = Get-Command -Name 'ollama' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    $candidate = Join-Path $ollamaInstallDir 'ollama.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    return ''
}

function Test-OllamaApi {
    try {
        Invoke-RestMethod -Uri ("http://{0}:{1}/api/version" -f $OLLAMA_HOST_ADDRESS, $ollamaPort) -TimeoutSec 3 | Out-Null
        return $true
    } catch {
        return $false
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing the local AI translation runtime (Ollama)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$ollamaPort     = [string](Get-ServiceContractValue -ContractPath 'local_ai.ollama_port')
$translateModel = [string](Get-ServiceContractValue -ContractPath 'local_ai.translate_model')
$modelsSubdir   = [string](Get-ServiceContractValue -ContractPath 'local_ai.ollama_models_subdir')
$modelsDir      = if ($env:OLLAMA_MODELS) { $env:OLLAMA_MODELS } else { Join-Path $Global:CORE_NODE_CACHE_DIR $modelsSubdir }
Write-Host ("$SCRIPT_INDEX model: {0} | port: {1} | store: {2}" -f $translateModel, $ollamaPort, $modelsDir) -ForegroundColor DarkGray

$ollamaExe = Get-OllamaExecutable
if (-not $ollamaExe -or $Force) {
    Write-Host "$SCRIPT_INDEX [..] winget install $OLLAMA_WINGET_ID ..." -ForegroundColor Yellow
    & winget install --id $OLLAMA_WINGET_ID --exact --silent --scope user --accept-package-agreements --accept-source-agreements
    $ollamaExe = Get-OllamaExecutable
}
if (-not $ollamaExe) {
    Write-Host "$SCRIPT_INDEX [!] Ollama is not installed; retried on the next run." -ForegroundColor DarkYellow
    Set-GlobalVar -key 'PYCORE_PREREQUISITE_STEP_STATE' -value 'pending' | Out-Null
    return
}
Write-Host "$SCRIPT_INDEX [OK] ollama: $ollamaExe" -ForegroundColor Green

# Pulls go to the server on the contract port: a running Ollama app keeps its
# own store; otherwise a temporary server stores models in the shared cache,
# the same directory pycore's managed `ollama serve` uses.
if (-not (Test-OllamaApi)) {
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
    $env:OLLAMA_HOST = "{0}:{1}" -f $OLLAMA_HOST_ADDRESS, $ollamaPort
    $env:OLLAMA_MODELS = $modelsDir
    $parallelEnvName = [string](Get-ServiceContractValue -ContractPath 'local_ai.ollama_num_parallel_env')
    if (-not [Environment]::GetEnvironmentVariable($parallelEnvName, 'Process')) {
        $parallelValue = [string](Get-ServiceContractValue -ContractPath $(if ((Get-CudaRuntimePolicy).Enabled) { 'local_ai.ollama_num_parallel.gpu' } else { 'local_ai.ollama_num_parallel.cpu' }))
        [Environment]::SetEnvironmentVariable($parallelEnvName, $parallelValue, 'Process')
    }
    $serveProcess = Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt $OLLAMA_READY_SECONDS -and -not $ready; $attempt++) {
        Start-Sleep -Seconds 1
        $ready = Test-OllamaApi
    }
} else {
    $ready = $true
}

if ($ready) {
    $env:OLLAMA_HOST = "{0}:{1}" -f $OLLAMA_HOST_ADDRESS, $ollamaPort
    $installedModels = @(& $ollamaExe list 2>$null | Select-Object -Skip 1 | ForEach-Object { ($_ -split '\s+')[0] })
    if ($installedModels -contains $translateModel) {
        Write-Host "$SCRIPT_INDEX [SKIP] model present: $translateModel" -ForegroundColor Green
        $pullSucceeded = $true
    } else {
        Write-Host "$SCRIPT_INDEX [..] ollama pull $translateModel (resumable) ..." -ForegroundColor Yellow
        & $ollamaExe pull $translateModel
        $installedModels = @(& $ollamaExe list 2>$null | Select-Object -Skip 1 | ForEach-Object { ($_ -split '\s+')[0] })
        $pullSucceeded = ($installedModels -contains $translateModel)
    }
} else {
    Write-Host "$SCRIPT_INDEX [!] ollama server did not answer on port $ollamaPort." -ForegroundColor DarkYellow
}

if ($serveProcess -and -not $serveProcess.HasExited) {
    Stop-Process -Id $serveProcess.Id -Force -ErrorAction SilentlyContinue
}

if ($pullSucceeded) {
    Write-Host "$SCRIPT_INDEX [OK] local AI translation runtime ready." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] model pull not finished; resumed on the next run." -ForegroundColor DarkYellow
    Set-GlobalVar -key 'PYCORE_PREREQUISITE_STEP_STATE' -value 'pending' | Out-Null
}
