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
$chatPolicy     = $null
$chatPackages   = @()

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'chattts'
$targetDir = if ($env:CHATTTS_DIR) { $env:CHATTTS_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH
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
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS') -AbsentOk -AbsentNote 'CHATTTS_SKIP=1'
    return
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS') -AbsentOk -AbsentNote 'external server reachable'
    return
}
if ((Test-TtsDependenciesReady -PythonExe $Global:PYTHON_EXE_PATH -Engine 'chattts' -Path $depsSentinel) -and (Test-Path $apiServerDst) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] ChatTTS already installed -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python chattts_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
    return
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only (not installed). Pass -Full, CHATTTS_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS') -AbsentOk -AbsentNote 'opt-in'
    return
}

$hasCuda = (Get-CudaRuntimePolicy).Enabled
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU' } else { 'CPU' })) -ForegroundColor DarkGray

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
    return
}
$chatPolicy = Get-TtsEngineInstallPolicy -PythonExe $resolvedPython -Engine 'chattts'
if ($chatPolicy) { $chatPackages = @($chatPolicy.packages) }
if (-not $chatPolicy -or $chatPackages.Count -eq 0) {
    Write-Host "$SCRIPT_INDEX [!] ChatTTS runtime policy is unavailable or has no dependency plan; pip was not invoked." -ForegroundColor DarkYellow
    return
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
if (Test-Path $apiServerSrc) {
    Copy-Item -Path $apiServerSrc -Destination $apiServerDst -Force
}

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'chattts' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] installing the central ChatTTS dependency plan ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install @chatPackages } catch { Write-Host "$SCRIPT_INDEX [!] ChatTTS pip failed." -ForegroundColor DarkYellow }
    if (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'chattts') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'chattts' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] dependencies installed (policy stamp written)." -ForegroundColor Green
    }
}

if (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'chattts') {
    Write-Host "$SCRIPT_INDEX [OK] ChatTTS ready ($targetDir)." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python chattts_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
} else {
    Write-Host "$SCRIPT_INDEX [!] ChatTTS dependencies are incomplete; retrying next run." -ForegroundColor DarkYellow
    return
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('ChatTTS')
