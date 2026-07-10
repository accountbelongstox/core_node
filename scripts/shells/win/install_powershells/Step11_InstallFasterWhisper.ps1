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
$SCRIPT_INDEX          = '[Step17-FasterWhisper]'
$MinRamGB              = 1
$MinFreeDiskGB         = 100
$resolvedPython        = $null
$pythonCandidates      = $null
$ramGB                 = $null
$freeGB                = $null
$hasGpu                = $false
$reasons               = @()

# Resolve a REAL Python interpreter (skip the Windows Store alias stub). Mirrors
# the resolution policy used by pyservice.ps1 so behaviour stays consistent.
function Resolve-PythonInterpreter {
    param([string]$Preferred = '')

    if ($Preferred -and (Test-Path $Preferred)) {
        try {
            $v = & $Preferred --version 2>&1
            if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $Preferred }
        } catch { }
    }

    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($name in 'python', 'python3', 'py') {
        Get-Command $name -All -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Source -and $_.Source -notmatch 'WindowsApps') { $candidates.Add($_.Source) }
        }
    }
    foreach ($p in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        'C:\Python313\python.exe', 'C:\Python312\python.exe', 'C:\Python311\python.exe',
        (Join-Path $env:USERPROFILE 'scoop\shims\python.exe')
    )) { $candidates.Add($p) }

    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) {
            try {
                $v = & $c --version 2>&1
                if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $c }
            } catch { }
        }
    }
    return $null
}

function Test-PyModule {
    param([string]$Py, [string]$Module)
    & $Py -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$Module') else 1)" 2>$null
    return ($LASTEXITCODE -eq 0)
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing faster-whisper (default STT for Video Extraction)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# --- 0) resolve python (Step8_InstallPython has already run in the installer flow) --- #
$resolvedPython = Resolve-PythonInterpreter -Preferred $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Step8_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    exit 1
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
        exit 0
    }
}

# --- 2) faster-whisper (idempotent) -------------------------------------- #
if ((Test-PyModule -Py $resolvedPython -Module 'faster_whisper') -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] faster-whisper already installed; skipping pip." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] pip install --upgrade faster-whisper ..." -ForegroundColor Yellow
    & $resolvedPython -m pip install --upgrade faster-whisper
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$SCRIPT_INDEX [X] faster-whisper install failed." -ForegroundColor Red
        exit 1
    }
    if (-not (Test-PyModule -Py $resolvedPython -Module 'faster_whisper')) {
        Write-Host "$SCRIPT_INDEX [X] faster-whisper still not importable after install." -ForegroundColor Red
        exit 1
    }
    Write-Host "$SCRIPT_INDEX [OK] faster-whisper installed." -ForegroundColor Green
}

# --- 3) GPU runtime libs (CUDA 12 + cuDNN 9), only if a GPU is present ---- #
# No --upgrade on purpose: cuDNN/cuBLAS wheels are ~700 MB; if a compatible
# version is present pip says "already satisfied" and downloads nothing.
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    try { & nvidia-smi | Out-Null; if ($LASTEXITCODE -eq 0) { $hasGpu = $true } } catch { }
}
if ($hasGpu) {
    Write-Host "$SCRIPT_INDEX [..] NVIDIA GPU detected -> pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.* ..." -ForegroundColor Yellow
    & $resolvedPython -m pip install 'nvidia-cublas-cu12' 'nvidia-cudnn-cu12==9.*'
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$SCRIPT_INDEX [!] GPU lib install failed; whisper will fall back to CPU (int8)." -ForegroundColor DarkYellow
    } else {
        Write-Host "$SCRIPT_INDEX [OK] GPU runtime libs present." -ForegroundColor Green
    }
} else {
    Write-Host "$SCRIPT_INDEX [i] No NVIDIA GPU detected -> CPU (int8) inference." -ForegroundColor DarkGray
}

# --- 4) optional model pre-download -------------------------------------- #
if ($Model -and $Model -ne 'auto') {
    Write-Host ("$SCRIPT_INDEX [..] Pre-downloading faster-whisper model '{0}' ..." -f $Model) -ForegroundColor Yellow
    & $resolvedPython -c "from faster_whisper import download_model; download_model('$Model'); print('cached')"
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready." -f $Model) -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] model download did not complete; it will download on first use." -ForegroundColor DarkYellow
    }
}

exit 0
