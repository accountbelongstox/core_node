<#
.SYNOPSIS
    ChatTTS prerequisite — dialogue TTS (official PyPI + local OpenAI-compatible api).

.DESCRIPTION
    Official install: pip install ChatTTS (https://github.com/2noise/ChatTTS#installation)
    API server: chattts_api_server.py -> POST /v1/audio/speech (CHATTTS_URL default :8000)

    Opt-in heavy install: -Full or CHATTTS_INSTALL=1 or NEURAL_TTS_INSTALL=1 (via PreparePycorePrerequisites.ps1).
    Best-effort: always exit 0. Skip with CHATTTS_SKIP=1.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step51-ChatTts]'
$serverUrl      = if ($env:CHATTTS_URL) { $env:CHATTTS_URL.TrimEnd('/') } else { 'http://127.0.0.1:8000' }
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$apiServerSrc   = $null
$apiServerDst   = $null
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:CHATTTS_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'chattts'
$targetDir = if ($env:CHATTTS_DIR) { $env:CHATTTS_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$apiServerSrc = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'chattts_api_server.py'
$apiServerDst = Join-Path $targetDir 'chattts_api_server.py'

function Test-ServerUp {
    param([string]$Url)
    try { $r = Invoke-WebRequest -Uri "$Url/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; return ($r.StatusCode -lt 500) }
    catch {
        try { $r = Invoke-WebRequest -Uri "$Url/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; return ($r.StatusCode -lt 500) }
        catch { if ($_.Exception.Response) { return $true }; return $false }
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX ChatTTS (dialogue TTS api server)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:CHATTTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] CHATTTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
}
if ((Test-PyModule -Py ($Global:PYTHON_EXE_PATH) -ModuleName 'ChatTTS') -and (Test-Path $depsSentinel) -and (Test-Path $apiServerDst) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] ChatTTS already installed -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python chattts_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only (not installed). Pass -Full, CHATTTS_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
}

$hasCuda = Test-CudaPresent
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU' } else { 'CPU' })) -ForegroundColor DarkGray

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
if (Test-Path $apiServerSrc) {
    Copy-Item -Path $apiServerSrc -Destination $apiServerDst -Force
}

if ((Test-Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install ChatTTS (official PyPI) ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install --upgrade ChatTTS } catch { Write-Host "$SCRIPT_INDEX [!] ChatTTS pip failed." -ForegroundColor DarkYellow }
    try { & $Global:PIP_EXE_PATH install fastapi uvicorn pydub } catch { }
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
    Write-Host "$SCRIPT_INDEX [OK] dependencies installed (.deps_done written)." -ForegroundColor Green
}

if (Test-PyModule -Py $resolvedPython -ModuleName 'ChatTTS') {
    Write-Host "$SCRIPT_INDEX [OK] ChatTTS ready ($targetDir)." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python chattts_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
} else {
    Write-Host "$SCRIPT_INDEX [!] ChatTTS not importable after install." -ForegroundColor DarkYellow
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
