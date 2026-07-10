# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Single source of truth for the faster-whisper prerequisite (DEFAULT STT engine
# for the pycore "Video Extraction" feature). Runs AFTER Step8_InstallPython,
# Step9_InstallCudaNvidiaPrereq, and Step10_InstallPythonPrereqPackages so
# torch is already present. Also invoked directly by scripts\shells\linux\common\iniscripts\install_faster_whisper.ps1
# (the pyservice prerequisite reference) to keep one copy of the logic.
#
# Invocation contracts:
#   - DevInstaller flow:  & Step11_InstallFasterWhisper.ps1 <Region>
#   - pyservice flow:     & Step11_InstallFasterWhisper.ps1 -Python <py> [-Model <m>] [-Force]
[CmdletBinding()]
param(
    [string]$Region = 'Global',
    [string]$Python = '',
    [string]$Model  = '',
    [switch]$Force
)

# Variable Declarations (all globals at top, per rule 5)
$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX          = '[Step 11]'
$MinRamGB              = 1
$MinFreeDiskGB         = 100
$resolvedPython        = $null
$pythonCandidates      = $null
$ramGB                 = $null
$freeGB                = $null
$hasGpu                = $false
$reasons               = @()

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')

function Test-PyModule {
    param([string]$Py, [string]$PackageName)
    $pipExe = if ($Global:PIP_EXE_PATH -and (Test-Path -LiteralPath $Global:PIP_EXE_PATH)) { $Global:PIP_EXE_PATH } else { Resolve-InstallerPipExe -PythonExe $Py }
    return Test-PipPackageInstalled -PipExe $pipExe -PackageName $PackageName
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing faster-whisper (default STT for Video Extraction)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# --- 0) resolve python (Step8_InstallPython has already run in the installer flow) --- #
$resolvedPython = Resolve-InstallerPythonExe -PreferredPath $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Step8_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    return
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

# --- 1) system-capacity guard (same policy as install_whisper) ----------- #
try {
    $ramGB = [math]::Round((Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory / 1GB, 2)
} catch { $ramGB = $null }
try {
    $freeGB = [math]::Round((Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop |
                             Measure-Object -Property FreeSpace -Sum).Sum / 1GB, 2)
} catch { $freeGB = $null }
Write-Host ("$SCRIPT_INDEX ram    : {0} GB"                         -f $(if ($null -ne $ramGB)  { $ramGB }  else { '?' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX disk   : {0} GB free (all fixed drives)" -f $(if ($null -ne $freeGB) { $freeGB } else { '?' })) -ForegroundColor DarkGray
if (-not $Force) {
    if ($null -ne $ramGB  -and $ramGB  -lt $MinRamGB)      { $reasons += ("RAM {0} GB < {1} GB" -f $ramGB, $MinRamGB) }
    if ($null -ne $freeGB -and $freeGB -lt $MinFreeDiskGB) { $reasons += ("free disk {0} GB < {1} GB" -f $freeGB, $MinFreeDiskGB) }
    if ($reasons.Count -gt 0) {
        Write-Host ("$SCRIPT_INDEX [skip] System too small for faster-whisper ({0}); skipping. Use -Force to override." -f ($reasons -join '; ')) -ForegroundColor DarkYellow
        return
    }
}

# --- 2) faster-whisper (idempotent) -------------------------------------- #
if ((Test-PyModule -Py $resolvedPython -PackageName 'faster-whisper') -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] faster-whisper already installed; skipping pip." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] pip install --upgrade faster-whisper ..." -ForegroundColor Yellow
    & $Global:PIP_EXE_PATH install --upgrade faster-whisper
    if (Test-PyModule -Py $resolvedPython -PackageName 'faster-whisper') {
        Write-Host "$SCRIPT_INDEX [OK] faster-whisper installed." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [X] faster-whisper still not importable after install." -ForegroundColor Red
    }
}

# --- 3) GPU runtime libs (CUDA 12 + cuDNN 9 for CTranslate2), only if GPU present -
# Step 10 torch cu130 pulls nvidia-cublas-cu13 / nvidia-cudnn-cu13 (PyTorch stack).
# faster-whisper uses CTranslate2, which needs cuBLAS+cuDNN for CUDA *12* per official docs:
#   https://github.com/SYSTRAN/faster-whisper — pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*
# That is a separate user-space stack from torch cu130; not a duplicate Step 9 driver install.
$hasGpu = Test-NvidiaGpuPresent
if ($hasGpu) {
    $pipExe = if ($Global:PIP_EXE_PATH -and (Test-Path -LiteralPath $Global:PIP_EXE_PATH)) {
        $Global:PIP_EXE_PATH
    } else {
        Resolve-InstallerPipExe -PythonExe $resolvedPython
    }
    $cu12Ready = (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'nvidia-cublas-cu12') -and
        (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'nvidia-cudnn-cu12')

    if ($cu12Ready -and -not $Force) {
        Write-Host "$SCRIPT_INDEX [OK] GPU runtime libs (nvidia-cublas-cu12, nvidia-cudnn-cu12) already present; skipping." -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX [i] Note: torch cu130 uses cu13 wheels from Step 10; CTranslate2 still needs cu12 libs above." -ForegroundColor DarkGray
    } else {
        Write-Host "$SCRIPT_INDEX [..] NVIDIA GPU detected -> pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.* ..." -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX [i] CTranslate2 (faster-whisper backend) requires CUDA 12 cuBLAS/cuDNN pip wheels (official faster-whisper README)." -ForegroundColor DarkGray
        Write-Host "$SCRIPT_INDEX [i] Separate from Step 10 torch cu130 (nvidia-*-cu13); first GPU host download can be ~700MB." -ForegroundColor DarkGray
        & $pipExe install nvidia-cublas-cu12 'nvidia-cudnn-cu12==9.*'
        $cu12Ready = (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'nvidia-cublas-cu12') -and
            (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'nvidia-cudnn-cu12')
        if ($cu12Ready) {
            Write-Host "$SCRIPT_INDEX [OK] GPU runtime libs (cu12 cublas/cudnn) present." -ForegroundColor Green
        } else {
            Write-Host "$SCRIPT_INDEX [!] GPU lib install incomplete; faster-whisper will fall back to CPU (int8)." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "$SCRIPT_INDEX [i] No NVIDIA GPU detected -> CPU (int8) inference." -ForegroundColor DarkGray
}

# --- 4) optional model pre-download -------------------------------------- #
if ($Model -and $Model -ne 'auto') {
    Write-Host ("$SCRIPT_INDEX [..] Pre-downloading faster-whisper model '{0}' ..." -f $Model) -ForegroundColor Yellow
    & $resolvedPython -c "from faster_whisper import download_model; download_model('$Model')"
    $modelDir = Join-Path $env:USERPROFILE '.cache\huggingface\hub'
    if (Test-Path -LiteralPath $modelDir) {
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' download attempted (cache under {1})." -f $Model, $modelDir) -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] model download did not complete; it will download on first use." -ForegroundColor DarkYellow
    }
}
