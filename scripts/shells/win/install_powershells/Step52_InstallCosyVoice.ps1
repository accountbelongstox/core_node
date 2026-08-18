<#
.SYNOPSIS
    CosyVoice prerequisite (Alibaba multilingual clone TTS), auto-run by PreparePycorePrerequisites.ps1.
    Clones FunAudioLLM/CosyVoice into staging idempotently. pycore's cosyvoice engine
    is an HTTP CLIENT to runtime/python/fastapi/server.py.

.DESCRIPTION
    Official: https://github.com/FunAudioLLM/CosyVoice
      python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B
    Best-effort: exit 0. Skip with COSYVOICE_SKIP=1. Opt-in: -Full or COSYVOICE_INSTALL=1.

.PARAMETER Python
    python.exe for deps. Default: 'python' on PATH.
.PARAMETER Force
    Re-run pip even when .deps_done is present.
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
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX      Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO to enable synthesis." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch') -AbsentOk -AbsentNote 'external server reachable'
    return
}
if ((Test-Path (Join-Path $targetDir 'cosyvoice\cli\cosyvoice.py')) -and (Test-TtsDependenciesReady -PythonExe $Global:PYTHON_EXE_PATH -Engine 'cosyvoice' -Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] CosyVoice already installed -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python runtime/python/fastapi/server.py --port 50000" -f $targetDir) -ForegroundColor Cyan
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
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first." -ForegroundColor DarkYellow
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

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'cosyvoice' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    $reqFile = Join-Path $targetDir 'requirements.txt'
    if (Test-Path $reqFile) {
        Write-Host "$SCRIPT_INDEX [..] pip install -r requirements.txt (one-time) ..." -ForegroundColor Yellow
        try { & $Global:PIP_EXE_PATH install -r $reqFile } catch { $depsOk = $false; Write-Host "$SCRIPT_INDEX [!] some requirements failed." -ForegroundColor DarkYellow }
    } else {
        $depsOk = $false
    }
    try { & $Global:PIP_EXE_PATH install fastapi uvicorn modelscope huggingface_hub } catch { $depsOk = $false }
    if ($depsOk -and (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'cosyvoice')) {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'cosyvoice' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] dependencies installed (policy stamp written)." -ForegroundColor Green
    }
}

if (-not (Test-Path (Join-Path $targetDir 'cosyvoice\cli\cosyvoice.py')) -or -not (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'cosyvoice' -Path $depsSentinel)) {
    Write-Host "$SCRIPT_INDEX [!] CosyVoice is not ready; incomplete components will retry next run." -ForegroundColor DarkYellow
    return
}

Write-Host "$SCRIPT_INDEX [OK] CosyVoice ready ($targetDir)." -ForegroundColor Green
Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B" -f $targetDir) -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX  Then set COSYVOICE_SPK_ID (SFT) or COSYVOICE_REF_AUDIO (+ COSYVOICE_PROMPT_TEXT)." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
