<#
.SYNOPSIS
    F5-TTS prerequisite (flow-matching fast clone TTS), auto-run by PreparePycorePrerequisites.ps1.
    Clones SWivid/F5-TTS into staging and copies a minimal HTTP /process wrapper.
    pycore's f5tts engine is an HTTP CLIENT to that wrapper.

.DESCRIPTION
    Official: https://github.com/SWivid/F5-TTS (src/f5_tts/api.py)
    Wrapper:  f5tts_api_server.py (POST /process, GET /health) on port 7860.
    Best-effort: exit 0. Skip with F5TTS_SKIP=1. Opt-in: -Full or F5TTS_INSTALL=1.

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

$SCRIPT_INDEX   = '[Step53-F5Tts]'
$REPO_URL       = 'https://github.com/SWivid/F5-TTS.git'
$serverUrl      = if ($env:F5TTS_URL) { $env:F5TTS_URL.TrimEnd('/') } else { 'http://127.0.0.1:7860' }
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$apiServerSrc   = $null
$apiServerDst   = $null
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:F5TTS_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'f5tts'
$targetDir = if ($env:F5TTS_DIR) { $env:F5TTS_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$apiServerSrc = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'f5tts_api_server.py'
$apiServerDst = Join-Path $targetDir 'f5tts_api_server.py'

function Test-ServerUp {
    param([string]$Url)
    try { $r = Invoke-WebRequest -Uri "$Url/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; return ($r.StatusCode -lt 500) }
    catch { if ($_.Exception.Response) { return $true }; return $false }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX F5-TTS (flow-matching clone api)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:F5TTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] F5TTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('f5_tts') -AbsentOk -AbsentNote 'F5TTS_SKIP=1'
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX      Set F5TTS_REF_AUDIO + F5TTS_REF_TEXT to enable the engine." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('f5_tts') -AbsentOk -AbsentNote 'external server reachable'
}
if ((Test-Path (Join-Path $targetDir 'src\f5_tts\api.py')) -and (Test-TtsDependenciesReady -PythonExe $Global:PYTHON_EXE_PATH -Engine 'f5tts' -Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] F5-TTS already installed -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python f5tts_api_server.py" -f $targetDir) -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('f5_tts')
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only (not installed). Pass -Full, F5TTS_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('f5_tts') -AbsentOk -AbsentNote 'opt-in'
}

$hasCuda = Test-CudaPresent
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('f5_tts')
}

if (Test-Path (Join-Path $targetDir 'src\f5_tts\api.py')) {
    Write-Host "$SCRIPT_INDEX [OK] repo already present -> skipping clone." -ForegroundColor Green
} else {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Host "$SCRIPT_INDEX [!] git not found; cannot clone F5-TTS." -ForegroundColor DarkYellow
        throw "$SCRIPT_INDEX git not found; cannot clone F5-TTS."
    }
    Write-Host ("$SCRIPT_INDEX [..] cloning {0} -> {1}" -f $REPO_URL, $targetDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetDir) | Out-Null
    try { & git.exe clone --depth 1 --progress $REPO_URL $targetDir } catch {
        Write-Host ("$SCRIPT_INDEX [!] clone failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        throw ("$SCRIPT_INDEX clone failed: {0}" -f $_.Exception.Message)
    }
}

if (Test-Path $apiServerSrc) {
    Copy-Item -Path $apiServerSrc -Destination $apiServerDst -Force
    Write-Host ("$SCRIPT_INDEX [OK] api wrapper copied -> {0}" -f $apiServerDst) -ForegroundColor Green
}

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'f5tts' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install -e . (F5-TTS package) ..." -ForegroundColor Yellow
    try { Push-Location $targetDir; & $Global:PIP_EXE_PATH install -e . } catch { Write-Host "$SCRIPT_INDEX [!] pip install -e failed." -ForegroundColor DarkYellow }
    finally { Pop-Location }
    try { & $Global:PIP_EXE_PATH install fastapi uvicorn python-multipart } catch { }
    if (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'f5tts') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'f5tts' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] dependencies installed (policy stamp written)." -ForegroundColor Green
    }
}

if (-not (Test-Path (Join-Path $targetDir 'src\f5_tts\api.py')) -or -not (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'f5tts' -Path $depsSentinel)) {
    throw "$SCRIPT_INDEX F5-TTS is not ready; incomplete components will retry next run."
}

Write-Host "$SCRIPT_INDEX [OK] F5-TTS ready ($targetDir)." -ForegroundColor Green
Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python f5tts_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX  Then set F5TTS_REF_AUDIO + F5TTS_REF_TEXT to a reference clip." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('f5_tts')
