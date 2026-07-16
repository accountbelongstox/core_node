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

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'fishspeech'
$targetDir = if ($env:FISHSPEECH_DIR) { $env:FISHSPEECH_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$apiServerSrc = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'fishspeech_api_server.py'
$apiServerDst = Join-Path $targetDir 'fishspeech_api_server.py'

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
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('fishaudio')
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('fishaudio')
}
$resolvedPython = $Global:PYTHON_EXE_PATH
if ((Test-PyModule -Py $resolvedPython -ModuleName 'fishaudio') -and (Test-Path $depsSentinel) -and (Test-Path $apiServerDst) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] Fish Audio already installed -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python fishspeech_api_server.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('fishaudio')
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, FISHSPEECH_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('fishaudio')
}

$hasCuda = Test-CudaPresent
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine fishspeech -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
$fishCkpt = Resolve-TtsModelTier -PythonExe $resolvedPython -Key fishspeech_checkpoint -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
if ($fishCkpt -and -not $env:FISHSPEECH_CHECKPOINT) {
    $env:FISHSPEECH_CHECKPOINT = $fishCkpt
    Write-Host ("$SCRIPT_INDEX  checkpoint tier: FISHSPEECH_CHECKPOINT={0}" -f $fishCkpt) -ForegroundColor Cyan
}
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU' } else { 'CPU' })) -ForegroundColor DarkGray

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('fishaudio')
}

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
}

if ((Test-Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install fish-audio-sdk fastapi uvicorn requests ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install "fish-audio-sdk>=1.0.0" fastapi uvicorn requests } catch { }
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
    Write-Host "$SCRIPT_INDEX [OK] dependencies installed (.deps_done written)." -ForegroundColor Green
}

if (Test-PyModule -Py $resolvedPython -ModuleName 'fishaudio') {
    Write-Host "$SCRIPT_INDEX [OK] Fish Speech ready ($targetDir)." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  SDK: set FISH_API_KEY; cd `"{0}`"; python fishspeech_api_server.py" -f $targetDir) -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX  Local: download checkpoints per https://speech.fish.audio/install/ then run tools/api_server.py" -ForegroundColor DarkGray
} else {
    Write-Host "$SCRIPT_INDEX [!] fishaudio not importable after install." -ForegroundColor DarkYellow
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('fishaudio')
