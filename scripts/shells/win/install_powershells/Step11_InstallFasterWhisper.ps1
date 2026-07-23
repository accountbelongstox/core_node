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
# torch/paddle cu13 are already present. Also invoked by PreparePycorePrerequisites.ps1.
#
# CUDA policy: single system Python 3.13 stays cu13-only. faster-whisper +
# CTranslate2 install into that interpreter; on GPU hosts CTranslate2 uses CPU
# int8 (no cu12 nvidia libs, no venv). Sync-NvidiaCuStack removes stray cu12
# packages that would clobber cu13 paddle/torch DLLs.
[CmdletBinding()]
param(
    [string]$Region = 'Global',
    [string]$Python = '',
    [string]$Model  = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX          = '[Step 11]'
$MinRamGB              = 1
$MinFreeDiskGB         = 100
$resolvedPython        = $null
$ramGB                 = $null
$freeGB                = $null
$hasGpu                = $false
$reasons               = @()
$sysPip                = $null
$modelExplicit         = (-not [string]::IsNullOrWhiteSpace($Model) -and $Model -ne 'auto')

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Test-PyModule {
    param([string]$Py, [string]$PackageName)
    $pipExe = $Global:PIP_EXE_PATH
    return Test-PipPackageInstalled -PipExe $pipExe -PackageName $PackageName
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing faster-whisper (default STT for Video Extraction)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] System Python 3.13 was NOT found. Run Step8_InstallPython first." -ForegroundColor Red
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @('faster_whisper')
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

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
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('faster_whisper') -AbsentOk -AbsentNote 'resource policy'
    }
}

$hasGpu = Test-NvidiaGpuPresent
$sysPip = $Global:PIP_EXE_PATH

if ($hasGpu) {
    Write-Host "$SCRIPT_INDEX [i] GPU host: faster-whisper runs in system Python (CPU int8; cu13-only, no cu12 venv)." -ForegroundColor DarkGray
}

if ((Test-PyModule -Py $resolvedPython -PackageName 'faster-whisper') -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'faster-whisper already installed' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('faster_whisper')
}

Write-Host "$SCRIPT_INDEX [..] pip install --upgrade faster-whisper (system Python) ..." -ForegroundColor Yellow
& $sysPip install --upgrade faster-whisper
if (Test-PyModule -Py $resolvedPython -PackageName 'faster-whisper') {
    Write-Host "$SCRIPT_INDEX [OK] faster-whisper installed." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [X] faster-whisper still not importable after install." -ForegroundColor Red
}

if ($modelExplicit -or $Force) {
    Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine faster_whisper -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    if (-not $Model -or $Model -eq 'auto') {
        $Model = Resolve-TtsModelTier -PythonExe $resolvedPython -Key faster_whisper_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasGpu)
    }
    if ($Model -and $Model -ne 'auto') {
        Write-Host ("$SCRIPT_INDEX [..] Pre-downloading faster-whisper model '{0}' ..." -f $Model) -ForegroundColor Yellow
        $dlOk = $false
        try {
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $dlOut = (& $resolvedPython -c "from faster_whisper import download_model; download_model('$Model'); print('__DOWNLOAD_OK__')" 2>$null) -join ''
            $ErrorActionPreference = $prevEap
            $dlOk = ($dlOut -match '__DOWNLOAD_OK__')
        } catch { $dlOk = $false }
        if ($dlOk) {
            Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready." -f $Model) -ForegroundColor Green
            Save-SttModelTier -PythonExe $resolvedPython -InstallScriptRoot $PSScriptRoot -FasterWhisperModel $Model
        } else {
            $modelDir = Join-Path $Global:CORE_NODE_CACHE_DIR 'huggingface\hub'
            Write-Host ("$SCRIPT_INDEX [!] model download did not complete; cache={0}; will download on first use." -f $modelDir) -ForegroundColor DarkYellow
        }
    }
}

Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('faster_whisper')
