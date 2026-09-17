<#
.SYNOPSIS
    CosyVoice prerequisite (Alibaba multilingual clone TTS), auto-run by PreparePycorePrerequisites.ps1.
    Clones FunAudioLLM/CosyVoice into staging idempotently and builds a DEDICATED
    self-contained per-engine venv (base Python 3.10) via
    pycore/pyutils/common/python_env/isolated_venv.ensure_venv('cosyvoice', ...) —
    never the main interpreter (3.13 is outside the official 3.10-3.12 window).
    pycore launches runtime/python/fastapi/server.py under that venv on demand
    (class C); the main interpreter is only an HTTP client.

.DESCRIPTION
    Official: https://github.com/FunAudioLLM/CosyVoice
      python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B
    Best-effort: exit 0. Skip with COSYVOICE_SKIP=1. Opt-in: -Full or COSYVOICE_INSTALL=1.

.PARAMETER Python
    python.exe for deps. Default: 'python' on PATH.
.PARAMETER Force
    Rebuild the venv even when .deps_done is present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step52-CosyVoice]'
$REPO_URL       = 'https://github.com/FunAudioLLM/CosyVoice.git'
$serverUrl      = if ($env:COSYVOICE_URL) { $env:COSYVOICE_URL.TrimEnd('/') } else { 'http://127.0.0.1:50000' }
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:COSYVOICE_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')
$reqFile        = $null
$depsOk         = $true

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'cosyvoice'
$targetDir = if ($env:COSYVOICE_DIR) { $env:COSYVOICE_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH

function Test-ServerUp {
    param([string]$Url)
    try { $r = Invoke-WebRequest -Uri "$Url/docs" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; return ($r.StatusCode -lt 500) }
    catch { if ($_.Exception.Response) { return $true }; return $false }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX CosyVoice (multilingual clone TTS api)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:COSYVOICE_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] COSYVOICE_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch') -AbsentOk -AbsentNote 'COSYVOICE_SKIP=1'
    return
}

# --- Install method selection (native/docker), plan steps 16-17 ---
. (Join-Path $winCommonDir 'InstallMethodCommon.ps1')
$installMethod = Select-TtsInstallMethod -Engine cosyvoice `
    -SupportedBackends @('native','docker') `
    -RecommendedBackend 'native' `
    -RecommendationSource 'CosyVoice official repo installs natively (conda python=3.10); upstream also ships a docker/ runtime directory - https://github.com/FunAudioLLM/CosyVoice' `
    -DefaultBackend 'native' -Method $env:TTS_METHOD -Reselect:([bool]$env:TTS_METHOD_RESELECT)
if (-not $installMethod) { Write-Host "$SCRIPT_INDEX [i] install method selection cancelled; nothing changed."; return }
if ($installMethod -eq 'docker') {
    . (Join-Path $winCommonDir 'DockerWslBridge.ps1')
    if (-not (Invoke-TtsDockerEnsure -Engine cosyvoice -Prefix $SCRIPT_INDEX)) {
        Write-Host "$SCRIPT_INDEX [!] docker platform is not ready (state: $(Get-GlobalVar -key 'TTS_DOCKER_PROVIDER_STATE' -defaultValue 'unknown'))." -ForegroundColor DarkYellow
        exit 1
    }
    Save-TtsInstallBackend -Engine cosyvoice -Backend docker
    if (-not (Invoke-TtsDockerApply -Engine cosyvoice -StagingDir $targetDir -Prefix $SCRIPT_INDEX)) {
        Write-Host "$SCRIPT_INDEX [!] docker compose apply failed (phase above); docker backend is not ready." -ForegroundColor DarkYellow
        exit 1
    }
    Write-Host "$SCRIPT_INDEX [OK] docker compose service converged (project pycore-tts-cosyvoice)." -ForegroundColor Green
    return
}
Save-TtsInstallBackend -Engine cosyvoice -Backend native
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX      Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO to enable synthesis." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch') -AbsentOk -AbsentNote 'external server reachable'
    return
}
if ((Test-Path (Join-Path $targetDir 'cosyvoice\cli\cosyvoice.py')) -and (Test-TtsDependenciesReady -PythonExe $Global:PYTHON_EXE_PATH -Engine 'cosyvoice' -Path $depsSentinel) -and (Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'cosyvoice') -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] CosyVoice already installed -> skipping." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX  Runtime: pycore launches runtime/python/fastapi/server.py (class C) under the isolated venv on demand." -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
    return
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only (not installed). Pass -Full, COSYVOICE_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch') -AbsentOk -AbsentNote 'opt-in'
    return
}

$hasCuda = (Get-CudaRuntimePolicy).Enabled
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallDefaultPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
    return
}
if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'cosyvoice' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

if (Test-Path (Join-Path $targetDir 'cosyvoice\cli\cosyvoice.py')) {
    Write-Host "$SCRIPT_INDEX [OK] repo already present -> skipping clone." -ForegroundColor Green
} else {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Host "$SCRIPT_INDEX [!] git not found; cannot clone CosyVoice." -ForegroundColor DarkYellow
        Write-Host "$SCRIPT_INDEX [!] git not found; CosyVoice will retry next run." -ForegroundColor DarkYellow
        return
    }
    Write-Host ("$SCRIPT_INDEX [..] cloning {0} -> {1}" -f $REPO_URL, $targetDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetDir) | Out-Null
    try { & git.exe clone --depth 1 --progress $REPO_URL $targetDir } catch {
        Write-Host ("$SCRIPT_INDEX [!] clone failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        Write-Host ("$SCRIPT_INDEX [!] clone failed; retrying next run: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        return
    }
}

if (Test-Path (Join-Path $targetDir '.git')) {
    Write-Host "$SCRIPT_INDEX [..] git submodule update --init --recursive (Matcha-TTS) ..." -ForegroundColor Yellow
    try { Push-Location $targetDir; & git.exe submodule update --init --recursive } catch {
        Write-Host "$SCRIPT_INDEX [!] submodule init incomplete; server start may fail." -ForegroundColor DarkYellow
    } finally { Pop-Location }
}

# --- Isolated venv (Bucket B, self-contained): CosyVoice and its pinned
#     dependencies go only into the dedicated Python 3.10 venv; the main
#     interpreter is never touched. --- #
$venvProvisioned = Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'cosyvoice'
if ($venvProvisioned -and (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'cosyvoice' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] isolated venv already provisioned (.deps_done) -> skipping." -ForegroundColor Green
} else {
    $reqFile = Join-Path $targetDir 'requirements.txt'
    $venvPackages = @('fastapi', 'uvicorn', 'modelscope', 'huggingface_hub')
    if (Test-Path $reqFile) {
        $venvPackages = @('-r', $reqFile) + $venvPackages
    } else {
        $depsOk = $false
        Write-Host "$SCRIPT_INDEX [!] requirements.txt missing at $reqFile." -ForegroundColor DarkYellow
    }
    if ($depsOk) {
        Write-Host "$SCRIPT_INDEX [..] building/verifying isolated cosyvoice venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
        Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'cosyvoice' -PipPackages $venvPackages -Force:$Force
        $venvProvisioned = Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'cosyvoice'
    }
    if ($depsOk -and $venvProvisioned) {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'cosyvoice' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] isolated cosyvoice venv ready (policy stamp written)." -ForegroundColor Green
    }
}

if (-not (Test-Path (Join-Path $targetDir 'cosyvoice\cli\cosyvoice.py')) -or -not (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'cosyvoice' -Path $depsSentinel)) {
    Write-Host "$SCRIPT_INDEX [!] CosyVoice is not ready; incomplete components will retry next run." -ForegroundColor DarkYellow
    return
}

Write-Host "$SCRIPT_INDEX [OK] CosyVoice ready ($targetDir)." -ForegroundColor Green
Write-Host "$SCRIPT_INDEX  Runtime: pycore launches runtime/python/fastapi/server.py (class C) under the isolated venv on demand." -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX  Then set COSYVOICE_SPK_ID (SFT) or COSYVOICE_REF_AUDIO (+ COSYVOICE_PROMPT_TEXT)." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
