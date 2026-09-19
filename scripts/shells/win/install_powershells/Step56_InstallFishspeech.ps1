<#
.SYNOPSIS
    Fish Speech / Fish Audio prerequisite (SDK + optional local fish-speech clone).

.DESCRIPTION
    Official SDK: pip install fish-audio-sdk>=1.0 (https://docs.fish.audio/developer-guide/sdk-guide/quickstart)
    Local server: https://speech.fish.audio/server/  (tools/api_server.py)
    Wrapper: fishspeech_api_server.py -> POST /v1/tts (FISHSPEECH_URL default :8080)

    Opt-in: -Full or FISHSPEECH_INSTALL=1 or NEURAL_TTS_INSTALL=1.
    GPU hosts install CUDA torch by default. Skip with FISHSPEECH_SKIP=1.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step56-Fishspeech]'
$REPO_URL       = 'https://github.com/fishaudio/fish-speech.git'
$serverUrl      = if ($env:FISHSPEECH_URL) { $env:FISHSPEECH_URL.TrimEnd('/') } else { 'http://127.0.0.1:8080' }
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$apiServerSrc   = $null
$apiServerDst   = $null
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:FISHSPEECH_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')
$fishPolicy     = $null
$fishPackages   = @()
$checkpointRepo = ''
$ckptName = ''
$ckptDir = ''
$ckptSentinel = ''
$ckptOk = $false

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'fishspeech'
$targetDir = if ($env:FISHSPEECH_DIR) { $env:FISHSPEECH_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$apiServerSrc = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'fishspeech_api_server.py'
$apiServerDst = Join-Path $targetDir 'fishspeech_api_server.py'
$resolvedPython = $Global:PYTHON_EXE_PATH

function Test-ServerUp {
    param([string]$Url)
    foreach ($path in @('/v1/health', '/health', '/')) {
        try {
            $r = Invoke-WebRequest -Uri ("{0}{1}" -f $Url, $path) -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($r.StatusCode -lt 500) { return $true }
        } catch {
            if ($_.Exception.Response) { return $true }
        }
    }
    return $false
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Fish Speech / Fish Audio" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:FISHSPEECH_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] FISHSPEECH_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'FISHSPEECH_SKIP=1'
    return
}

# --- Install method selection (native/docker), plan steps 16-17 ---
. (Join-Path $winCommonDir 'InstallMethodCommon.ps1')
$installMethod = Select-TtsInstallMethod -Engine fishspeech `
    -SupportedBackends @('native','docker') `
    -RecommendedBackend 'native' `
    -RecommendationSource 'Fish Speech docs document native install and an official docker option (hub: fishaudio/fish-speech) - https://speech.fish.audio/install/' `
    -DefaultBackend 'native' -Method $env:TTS_METHOD -Reselect:([bool]$env:TTS_METHOD_RESELECT)
if (-not $installMethod) { Write-Host "$SCRIPT_INDEX [i] install method selection cancelled; nothing changed."; return }
if ($installMethod -eq 'docker') {
    . (Join-Path $winCommonDir 'DockerWslBridge.ps1')
    if (-not (Invoke-TtsDockerEnsure -Engine fishspeech -Prefix $SCRIPT_INDEX)) {
        Write-Host "$SCRIPT_INDEX [!] docker platform is not ready (state: $(Get-GlobalVar -key 'TTS_DOCKER_PROVIDER_STATE' -defaultValue 'unknown'))." -ForegroundColor DarkYellow
        exit 1
    }
    Save-TtsInstallBackend -Engine fishspeech -Backend docker
    if (-not (Invoke-TtsDockerApply -Engine fishspeech -StagingDir $targetDir -Prefix $SCRIPT_INDEX)) {
        Write-Host "$SCRIPT_INDEX [!] docker compose apply failed (phase above); docker backend is not ready." -ForegroundColor DarkYellow
        exit 1
    }
    Write-Host "$SCRIPT_INDEX [OK] docker compose service converged (project pycore-tts-fishspeech)." -ForegroundColor Green
    return
}
Save-TtsInstallBackend -Engine fishspeech -Backend native
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'external server reachable'
    return
}
if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'fishspeech' -Path $depsSentinel) -and (Test-Path $apiServerDst) -and (Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'fishspeech') -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] Fish Audio already installed -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python fishspeech_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, FISHSPEECH_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'opt-in'
    return
}

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallDefaultPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'fishspeech' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
$fishPolicy = Get-TtsEngineInstallPolicy -PythonExe $resolvedPython -Engine 'fishspeech'
if ($fishPolicy) { $fishPackages = @($fishPolicy.packages) }
if (-not $fishPolicy -or $fishPackages.Count -eq 0) {
    Write-Host "$SCRIPT_INDEX [!] Fish Speech runtime policy is unavailable or has no dependency plan; pip was not invoked." -ForegroundColor DarkYellow
    return
}

$hasCuda = (Get-CudaRuntimePolicy).Enabled
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine fishspeech -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
$fishCkpt = Resolve-TtsModelTier -PythonExe $resolvedPython -Key fishspeech_checkpoint -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
if ($fishCkpt -and -not $env:FISHSPEECH_CHECKPOINT) {
    $env:FISHSPEECH_CHECKPOINT = $fishCkpt
    Write-Host ("$SCRIPT_INDEX  checkpoint tier: FISHSPEECH_CHECKPOINT={0}" -f $fishCkpt) -ForegroundColor Cyan
}
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU' } else { 'CPU' })) -ForegroundColor DarkGray

if (-not (Test-Path (Join-Path $targetDir 'tools\api_server.py'))) {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        Write-Host ("$SCRIPT_INDEX [..] cloning {0} (shallow) ..." -f $REPO_URL) -ForegroundColor Yellow
        if (Test-Path $targetDir) {
            if (-not (Test-Path (Join-Path $targetDir '.git'))) {
                try { & git.exe clone --depth 1 $REPO_URL $targetDir } catch { }
            }
        } else {
            try { & git.exe clone --depth 1 $REPO_URL $targetDir } catch { }
        }
    }
}
if (Test-Path $apiServerSrc) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -Path $apiServerSrc -Destination $apiServerDst -Force
    $chunkingSrc = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'tts_text_chunking.py'
    if (Test-Path $chunkingSrc) {
        Copy-Item -Path $chunkingSrc -Destination (Join-Path $targetDir 'tts_text_chunking.py') -Force
    }
}

# --- Isolated venv (Bucket B, self-contained): the Fish Speech bridge runs
#     under the dedicated Python 3.12 venv; the main interpreter is only an
#     HTTP client. Local fish_speech inference hosting remains a separate
#     pending step; this venv carries the bridge/SDK dependency plan. --- #
if ((Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'fishspeech') -and (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'fishspeech' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] isolated venv already provisioned (.deps_done) -> skipping." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] building/verifying isolated fishspeech venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
    Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'fishspeech' -PipPackages $fishPackages -Force:$Force
    if (Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'fishspeech') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'fishspeech' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] isolated fishspeech venv ready (policy stamp written)." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] venv build incomplete; will retry next run (main interpreter untouched)." -ForegroundColor DarkYellow
    }
}

if (Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'fishspeech') {
    Write-Host "$SCRIPT_INDEX [OK] Fish Speech ready ($targetDir)." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX  Runtime: pycore launches fishspeech_api_server.py (class C) under the isolated venv on demand." -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX  SDK: set FISH_API_KEY; local: download checkpoints per https://speech.fish.audio/install/ and set FISHSPEECH_UPSTREAM." -ForegroundColor DarkGray
} else {
    Write-Host "$SCRIPT_INDEX [!] Fish Speech isolated venv is not ready; retrying next run." -ForegroundColor DarkYellow
    return
}

# --- Local inference checkpoints (IDEMPOTENT: sentinel + resumable download) ---
# Bridge/SDK mode works without weights; a failed download never fails the step.
$checkpointRepo = if ($env:FISHSPEECH_CHECKPOINT) { $env:FISHSPEECH_CHECKPOINT.Trim() } else { "$fishCkpt".Trim() }
if (-not $checkpointRepo) {
    Write-Host "$SCRIPT_INDEX [!] Checkpoint model is unresolved; set FISHSPEECH_CHECKPOINT to a Hugging Face repo ID." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}
if (-not $checkpointRepo.Contains('/')) { $checkpointRepo = ('fishaudio/{0}' -f $checkpointRepo) }
# Self-heal stale operator overrides: a FISHSPEECH_CHECKPOINT value that does
# not exist on the Hub (e.g. openaudio-s1, recommended by older docs) would
# 404 on every run. Only a definitive 404 resets it to the tier default;
# network failures keep the operator's choice untouched.
if ($env:FISHSPEECH_CHECKPOINT -and $fishCkpt -and ((Test-HfRepoExistence -RepoId $checkpointRepo) -eq 'missing')) {
    $fallbackRepo = "$fishCkpt".Trim()
    if (-not $fallbackRepo.Contains('/')) { $fallbackRepo = ('fishaudio/{0}' -f $fallbackRepo) }
    if ($fallbackRepo -ne $checkpointRepo) {
        Write-Host ("$SCRIPT_INDEX [!] FISHSPEECH_CHECKPOINT={0} does not exist on Hugging Face (404); resetting to tier default {1}." -f $checkpointRepo, $fallbackRepo) -ForegroundColor DarkYellow
        $env:FISHSPEECH_CHECKPOINT = $fallbackRepo
        $checkpointRepo = $fallbackRepo
    }
}
$ckptName = Split-Path -Leaf $checkpointRepo
$ckptDir = Join-Path $targetDir (Join-Path 'checkpoints' $ckptName)
$ckptSentinel = Join-Path $targetDir (Join-Path 'checkpoints' ".ckpt_$($ckptName)_done")
if ((Test-Path $ckptSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $ckptDir -RepoId $checkpointRepo -AllowPatterns @('*.json', '*.pth', '*.safetensors', '*.txt', '*.tiktoken', '*.model')) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] checkpoint $ckptName already present." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] downloading checkpoint $checkpointRepo (curl, resumable) ..." -ForegroundColor Yellow
    $ckptOk = Install-HfRepoFlat -RepoId $checkpointRepo -DestDir $ckptDir -SentinelPath $ckptSentinel -AllowPatterns @('*.json', '*.pth', '*.safetensors', '*.txt', '*.tiktoken', '*.model') -Prefix "$SCRIPT_INDEX " -SentinelValue $ckptName
    if ($ckptOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $ckptDir -RepoId $checkpointRepo -AllowPatterns @('*.json', '*.pth', '*.safetensors', '*.txt', '*.tiktoken', '*.model'))) {
        Write-Host "$SCRIPT_INDEX [OK] checkpoint ready at $ckptDir (local inference mode enabled)." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] checkpoint download incomplete; will RESUME next run (bridge/SDK mode still works)." -ForegroundColor DarkYellow
        Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    }
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
