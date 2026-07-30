<#
.SYNOPSIS
    Kokoro-82M prerequisite via sherpa-onnx (dedicated model cache).

.DESCRIPTION
    Downloads the Kokoro multi-lang (zh+en) model into D:\www\cache\tts\kokoro
    and ensures sherpa-onnx is present without replacing a working installation.
    Idempotency verifies BOTH lexicons (lexicon-us-en.txt + lexicon-zh.txt); a partial
    install (missing lexicon-zh.txt) is re-downloaded so Chinese token ids resolve.

    Official: https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html

    No parameters required: idempotently installs (skips when the multi-lang
    model is complete, downloads/repairs when incomplete). Skip with KOKORO_SKIP=1.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX     = '[Step57-Kokoro]'
$resolvedPython   = $null
$modelDir         = $null
$modelUrl         = $null
$modelArchive     = $null
$tmpExtract       = $null
$expectedBytes    = 0L
$curl             = $null
$complete         = $false
$attempt          = 0
$dependenciesReady = $false
$modelFiles       = @()
$localModelBytes = 0L
$winCommonDir     = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

$modelDir = Join-Path $Global:CORE_NODE_CACHE_DIR 'tts\kokoro'
$resolvedPython = $Global:PYTHON_EXE_PATH

function Test-PyModule {
    param([string]$PipExe, [string]$PackageName)
    return Test-PipPackageInstalled -PipExe $PipExe -PackageName $PackageName
}

function Test-KokoroMultiLangComplete {
    # Multi-lang Kokoro requires model.onnx + tokens.txt + voices.bin + BOTH
    # lexicons (lexicon-us-en.txt, lexicon-zh.txt). Missing lexicon-zh.txt is
    # the root cause of the "unknown Chinese token" error at runtime.
    param([string]$Dir)
    if (-not (Test-Path $Dir)) { return $false }
    $onnx   = Get-ChildItem -Path $Dir -Recurse -Filter '*.onnx'            -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $tokens = Get-ChildItem -Path $Dir -Recurse -Filter 'tokens.txt'        -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $voices = Get-ChildItem -Path $Dir -Recurse -Filter 'voices.bin'        -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $lexZh  = Get-ChildItem -Path $Dir -Recurse -Filter 'lexicon-zh.txt'    -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $lexEn  = Get-ChildItem -Path $Dir -Recurse -Filter 'lexicon-us-en.txt' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    return [bool]($onnx -and $onnx.Length -gt 0 -and
        $tokens -and $tokens.Length -gt 0 -and
        $voices -and $voices.Length -gt 0 -and
        $lexZh -and $lexZh.Length -gt 0 -and
        $lexEn -and $lexEn.Length -gt 0)
}

function Install-KokoroModel {
    param([string]$Py, [string]$Archive, [string]$Tmp, [string]$Dir, [string]$Sentinel, [string]$Url)
    if (-not (Test-Path $Archive)) { return $false }
    if (Test-Path $Tmp) { Backup-InstallAssetPath -Path $Tmp -Prefix $SCRIPT_INDEX | Out-Null }
    New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
    & $Py -c "import tarfile,sys;t=tarfile.open(sys.argv[1],'r:bz2');t.extractall(sys.argv[2]);t.close()" $Archive $Tmp
    $inner = Get-ChildItem -Path $Tmp -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    $src = if ($inner) { $inner.FullName } else { $Tmp }
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    Copy-Item -Path (Join-Path $src '*') -Destination $Dir -Recurse -Force
    if (Test-KokoroMultiLangComplete -Dir $Dir) {
        Set-Content -Path $Sentinel -Value $Url -Encoding utf8
        return $true
    }
    Backup-InstallAssetPath -Path $Tmp -Prefix $SCRIPT_INDEX | Out-Null
    return $false
}

function Set-SherpaOnnxBuild {
    param([string]$PipExe)
    if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName 'sherpa-onnx')) {
        & $PipExe install sherpa-onnx
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Kokoro-82M (sherpa-onnx)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:KOKORO_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] KOKORO_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx', 'soundfile') -AbsentOk -AbsentNote 'KOKORO_SKIP=1'
    return
}

$modelSentinel = Join-Path $modelDir '.model_done'
$modelComplete = Test-KokoroMultiLangComplete -Dir $modelDir
$dependenciesReady = (Test-PipPackageInstalled -PipExe $Global:PIP_EXE_PATH -PackageName 'sherpa-onnx') -and
    (Test-PipPackageInstalled -PipExe $Global:PIP_EXE_PATH -PackageName 'soundfile')
if ($modelComplete) {
    $modelFiles = @(Get-ChildItem -Path $modelDir -Recurse -File -ErrorAction SilentlyContinue)
    $localModelBytes = [long](($modelFiles | Measure-Object -Property Length -Sum).Sum)
    if (-not (Test-Path -LiteralPath $modelSentinel)) {
        Set-Content -LiteralPath $modelSentinel -Value $modelDir -Encoding utf8
    }
    Write-Host ("$SCRIPT_INDEX [idempotent] local model found: {0} ({1:N0} bytes); remote lookup skipped" -f $modelDir, $localModelBytes) -ForegroundColor Green
}
if ($modelComplete -and (Test-Path $modelSentinel) -and $dependenciesReady) {
    Write-TtsIdempotentSkip -PythonExe $Python -Reason "Kokoro multi-lang model present at $modelDir" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx', 'soundfile')
    return
}
if ($modelComplete -and (Test-Path $modelSentinel) -and -not $dependenciesReady) {
    Write-Host "$SCRIPT_INDEX [repair] model is complete; repairing Python dependencies without downloading it again." -ForegroundColor Yellow
}

if (-not ($resolvedPython -and (Test-Path -LiteralPath $resolvedPython))) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found at $Global:PYTHON_EXE_PATH." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx', 'soundfile')
    return
}
$hasGpu = (Get-CudaRuntimePolicy).Enabled
$modelUrl = Resolve-TtsModelTier -PythonExe $resolvedPython -Key kokoro_url -InstallScriptRoot $PSScriptRoot -Gpu:($hasGpu)
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine kokoro -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
$pipExePath = $Global:PIP_EXE_PATH
Write-Host ("$SCRIPT_INDEX  model dir : {0}" -f $modelDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute   : {0}" -f $(if ($hasGpu) { 'CUDA -> full Kokoro model' } else { 'CPU -> int8 Kokoro model' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model url : {0}" -f $modelUrl) -ForegroundColor DarkGray

Set-SherpaOnnxBuild -PipExe $pipExePath
if (-not (Test-PipPackageInstalled -PipExe $pipExePath -PackageName 'soundfile')) {
    & $pipExePath install soundfile
}

if ($modelComplete -and (Test-Path $modelSentinel)) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'Kokoro model already downloaded; dependency repair complete' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx', 'soundfile')
    return
}

$modelArchive = Join-Path $modelDir '.download.tar.bz2'
$tmpExtract = Join-Path $env:TEMP 'kokoro-tts-extract'
New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
$expectedBytes = 0L
try {
    $head = Invoke-WebRequest -Uri $modelUrl -Method Head -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    if ($head.Headers['Content-Length']) { $expectedBytes = [int64]($head.Headers['Content-Length']) }
} catch { $expectedBytes = 0L }
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
$complete = Test-HfFileDownloadComplete -Path $modelArchive -ExpectedBytes $expectedBytes
$attempt = 0
while (-not $complete -and $attempt -lt 6) {
    $attempt += 1
    $have = if (Test-Path -LiteralPath $modelArchive) { (Get-Item -LiteralPath $modelArchive).Length } else { 0 }
    if ($have -gt 0) {
        Write-Host ("$SCRIPT_INDEX [resume] Kokoro archive {0:N0} / {1:N0} bytes" -f $have, $expectedBytes) -ForegroundColor Yellow
    } else {
        Write-Host "$SCRIPT_INDEX [..] downloading Kokoro model ..." -ForegroundColor Yellow
    }
    if ($curl) {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $curl.Source -L -C - --retry 3 --connect-timeout 30 --progress-bar -o $modelArchive $modelUrl
        $ErrorActionPreference = $prevEap
    } else {
        Write-Host "$SCRIPT_INDEX [!] curl.exe missing; fallback download cannot resume." -ForegroundColor DarkYellow
        try { Invoke-WebRequest -Uri $modelUrl -OutFile $modelArchive -UseBasicParsing -ErrorAction Stop } catch { }
    }
    $complete = Test-HfFileDownloadComplete -Path $modelArchive -ExpectedBytes $expectedBytes
}
if (-not $complete) {
    Write-Host "$SCRIPT_INDEX [!] download incomplete; archive kept to resume next run." -ForegroundColor DarkYellow
    Write-Host "$SCRIPT_INDEX [!] Kokoro model download is incomplete; retrying next run." -ForegroundColor DarkYellow
    return
}
if (Install-KokoroModel -Py $resolvedPython -Archive $modelArchive -Tmp $tmpExtract -Dir $modelDir -Sentinel $modelSentinel -Url $modelUrl) {
    Write-Host "$SCRIPT_INDEX [OK] Kokoro model installed." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] Kokoro model extraction failed; the archive was kept for retry." -ForegroundColor DarkYellow
    return
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx', 'soundfile')
