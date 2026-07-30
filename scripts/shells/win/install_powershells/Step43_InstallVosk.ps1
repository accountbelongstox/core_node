<#
.SYNOPSIS
    Thin delegator for offline Vosk STT (pip + model download).

.DESCRIPTION
    Vosk pip is installed by DevInstaller Step10 (DEPENDENCY_MAP). Model download
    remains here (large). PreparePycorePrerequisites.ps1 runs this idempotently on pyservice boot.

.PARAMETER Python
    python.exe to install into. Default: 'python' on PATH.
.PARAMETER Model
    'auto' (default) | 'small' | 'large'.
.PARAMETER Force
    Re-run dependency repair; a non-empty local model is always preserved.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [ValidateSet('auto', 'small', 'large')]
    [string]$Model = 'auto',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable declarations (all at top)
$SCRIPT_INDEX   = '[Step43-Vosk]'
$repoRoot       = Split-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) -Parent
$resolvedPython = $null
$modelRoot      = $null
$SMALL_NAME     = 'vosk-model-small-en-us-0.15'
$LARGE_NAME     = 'vosk-model-en-us-0.42-gigaspeech'
$BASE_URL       = 'https://alphacephei.com/vosk/models'
$chosenName     = $null
$modelUrl       = $null
$modelDir       = $null
$archivePath    = $null
$tmpExtract     = $null
$existingConf   = $null
$existingModelDir = $null
$existingModelFiles = @()
$localModelBytes = 0L
$pipExePath     = $null

function Resolve-PythonInterpreter {
    param([string]$Preferred = '')
    if ($Preferred -and (Test-Path $Preferred)) {
        try { $v = & $Preferred --version 2>&1; if (("$v").StartsWith('Python 3', [System.StringComparison]::OrdinalIgnoreCase)) { return $Preferred } } catch { }
    }
    foreach ($name in 'python', 'python3', 'py') {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -and $cmd.Source -notmatch 'WindowsApps') {
            try { $v = & $cmd.Source --version 2>&1; if (("$v").StartsWith('Python 3', [System.StringComparison]::OrdinalIgnoreCase)) { return $cmd.Source } } catch { }
        }
    }
    return $null
}

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

$modelRoot = Join-Path $Global:CORE_NODE_CACHE_DIR 'stt\vosk'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing offline Vosk STT (pip + model)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = $Global:PYTHON_EXE_PATH
$pipExePath = $Global:PIP_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 not found. Run Step8_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('vosk')
    return
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

# --- 1) vosk pip package --------------------------------------------------- #
if (Test-PipPackageInstalled -PipExe $pipExePath -PackageName 'vosk') {
    Write-Host "$SCRIPT_INDEX [OK] vosk already installed; skipping pip." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] pip install vosk ..." -ForegroundColor Yellow
    & $pipExePath install vosk
    if (Test-PipPackageInstalled -PipExe $pipExePath -PackageName 'vosk') {
        Write-Host "$SCRIPT_INDEX [OK] vosk installed." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] vosk install failed; STT will fall back to whisper/azure." -ForegroundColor DarkYellow
    }
}

# --- 2) choose model by CPU/GPU principle -------------------------------- #
if ($Model -eq 'small') { $chosenName = $SMALL_NAME }
elseif ($Model -eq 'large') { $chosenName = $LARGE_NAME }
else {
    if ((Get-CudaRuntimePolicy).Enabled) {
        $chosenName = $LARGE_NAME
        Write-Host "$SCRIPT_INDEX CUDA detected -> selecting the LARGE model ($LARGE_NAME, ~2.3GB)." -ForegroundColor Cyan
    } else {
        $chosenName = $SMALL_NAME
        Write-Host "$SCRIPT_INDEX No CUDA -> selecting the SMALL CPU model ($SMALL_NAME, ~40MB)." -ForegroundColor Cyan
    }
}
$modelUrl    = "$BASE_URL/$chosenName.zip"
$modelDir    = Join-Path $modelRoot $chosenName
$archivePath = Join-Path $modelRoot "$chosenName.zip"
$tmpExtract  = Join-Path $env:TEMP 'vosk-extract'

New-Item -ItemType Directory -Force -Path $modelRoot | Out-Null
$existingConf = Get-ChildItem -Path $modelRoot -Recurse -Filter 'conf' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host ("$SCRIPT_INDEX  model dir : {0}" -f $modelDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  source    : {0}" -f $modelUrl) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  existing  : {0}" -f $(if ($existingConf) { $existingConf.FullName } else { 'none' })) -ForegroundColor DarkGray

if ($existingConf) {
    $existingModelDir = Split-Path $existingConf.FullName -Parent
    $existingModelFiles = @(Get-ChildItem -Path $existingModelDir -Recurse -File -ErrorAction SilentlyContinue)
    if ($existingModelFiles.Count -gt 0 -and -not ($existingModelFiles | Where-Object { $_.Length -le 0 } | Select-Object -First 1)) {
        $localModelBytes = [long](($existingModelFiles | Measure-Object -Property Length -Sum).Sum)
        Write-Host ("$SCRIPT_INDEX [idempotent] local Vosk model found: {0} ({1:N0} bytes); remote lookup skipped" -f $existingModelDir, $localModelBytes) -ForegroundColor Green
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('vosk')
        return
    }
}

$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
$expectedBytes = 0
try {
    $head = Invoke-WebRequest -Uri $modelUrl -Method Head -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $expectedBytes = [int64]($head.Headers['Content-Length'])
} catch { $expectedBytes = 0 }
$expMB = if ($expectedBytes -gt 0) { [math]::Round($expectedBytes / 1MB, 1) } else { '?' }
Write-Host ("$SCRIPT_INDEX [..] downloading {0} ({1}MB) -> {2}" -f $modelUrl, $expMB, $archivePath) -ForegroundColor Yellow

$complete = $false
$attempt = 0
while (-not $complete -and $attempt -lt 6) {
    $attempt++
    $have = if (Test-Path $archivePath) { (Get-Item $archivePath).Length } else { 0 }
    if ($expectedBytes -gt 0 -and $have -ge $expectedBytes) { $complete = $true; break }
    Write-Host ("$SCRIPT_INDEX [..] attempt {0}: have {1}MB / {2}MB (resume + live progress)" -f $attempt, [math]::Round($have / 1MB, 1), $expMB) -ForegroundColor DarkGray
    if ($curl) {
        $prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & curl.exe -L -C - --retry 2 --connect-timeout 30 --progress-bar -o $archivePath $modelUrl
        $ErrorActionPreference = $prevEAP
    } else {
        Write-Host "$SCRIPT_INDEX [!] curl.exe missing; fallback download cannot resume." -ForegroundColor DarkYellow
        $ProgressPreference = 'Continue'
        try { Invoke-WebRequest -Uri $modelUrl -OutFile $archivePath -UseBasicParsing -ErrorAction Stop } catch { }
    }
    $now = if (Test-Path $archivePath) { (Get-Item $archivePath).Length } else { 0 }
    if ($expectedBytes -gt 0) {
        if ($now -ge $expectedBytes) { $complete = $true }
        elseif ($now -le $have) { Write-Host "$SCRIPT_INDEX [!] no progress this attempt (network); will resume." -ForegroundColor DarkYellow }
    } else {
        $complete = $true
    }
}

if (-not $complete) {
    Write-Host ("$SCRIPT_INDEX [!] still incomplete after {0} attempts; partial .zip KEPT to RESUME next run." -f $attempt) -ForegroundColor DarkYellow
    throw "$SCRIPT_INDEX Vosk model download is incomplete; retrying next run."
}

Write-Host "$SCRIPT_INDEX [..] extracting model ..." -ForegroundColor Yellow
try {
    if (Test-Path $tmpExtract) { Backup-InstallAssetPath -Path $tmpExtract -Prefix $SCRIPT_INDEX | Out-Null }
    New-Item -ItemType Directory -Force -Path $tmpExtract | Out-Null
    Expand-Archive -Path $archivePath -DestinationPath $tmpExtract -Force
    $inner = Get-ChildItem -Path $tmpExtract -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    $src = if ($inner) { $inner.FullName } else { $tmpExtract }
    if (Test-Path $modelDir) { Backup-InstallAssetPath -Path $modelDir -Prefix $SCRIPT_INDEX | Out-Null }
    Move-Item -Path $src -Destination $modelDir -Force
    Backup-InstallAssetPath -Path $tmpExtract -Prefix $SCRIPT_INDEX | Out-Null
} catch {
    Write-Host ("$SCRIPT_INDEX [!] extract failed ({0}); .zip KEPT to RESUME next run." -f $_.Exception.Message) -ForegroundColor DarkYellow
    if (Test-Path $tmpExtract) { Backup-InstallAssetPath -Path $tmpExtract -Prefix $SCRIPT_INDEX | Out-Null }
    throw ("$SCRIPT_INDEX Vosk model extraction failed: {0}" -f $_.Exception.Message)
}

if (Test-Path (Join-Path $modelDir 'conf')) {
    Write-Host ("$SCRIPT_INDEX [OK] Vosk model installed: {0} (free, offline)." -f $modelDir) -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] Extract produced no conf/ (archive may be partial); .zip KEPT to RESUME." -ForegroundColor DarkYellow
    throw "$SCRIPT_INDEX Vosk model verification failed; retrying next run."
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('vosk')
