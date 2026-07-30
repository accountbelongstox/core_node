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
# CUDA policy: CTranslate2 uses GPU only when its supported CUDA major matches the
# canonical Torch/Paddle major. Otherwise it uses CPU int8 and no second CUDA stack.
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
$cudaPolicy            = $null
$ctranslateCudaMajor   = 12
$ctranslateGpuPackages = @()
$ctranslateDepsReady   = $true
$packageSpec           = ''
$useCtranslateCuda     = $false
$localModelInfo        = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Test-PyModule {
    param([string]$Py, [string]$PackageName)
    $pipExe = $Global:PIP_EXE_PATH
    return Test-PipPackageInstalled -PipExe $pipExe -PackageName $PackageName
}

function Set-FasterWhisperLocalModelInfo {
    param([string]$ModelName)
    $cacheRoots = @()
    $candidates = @()
    $weightFiles = @()
    $configFile = $null
    $totalBytes = 0L
    $script:localModelInfo = $null
    if ($ModelName -and (Test-Path -LiteralPath $ModelName -PathType Container)) {
        $candidates += (Get-Item -LiteralPath $ModelName)
    }
    if ($env:HUGGINGFACE_HUB_CACHE) { $cacheRoots += $env:HUGGINGFACE_HUB_CACHE }
    if ($env:HF_HOME) { $cacheRoots += (Join-Path $env:HF_HOME 'hub') }
    $cacheRoots += (Join-Path $Global:CORE_NODE_CACHE_DIR 'huggingface\hub')
    foreach ($cacheRoot in $cacheRoots | Select-Object -Unique) {
        if (Test-Path -LiteralPath $cacheRoot -PathType Container) {
            $candidates += @(Get-ChildItem -LiteralPath $cacheRoot -Directory -Filter ("models--*--faster-whisper-{0}" -f $ModelName) -ErrorAction SilentlyContinue)
        }
    }
    foreach ($candidate in $candidates) {
        $configFile = Get-ChildItem -LiteralPath $candidate.FullName -Recurse -Filter 'config.json' -File -ErrorAction SilentlyContinue | Select-Object -First 1
        $weightFiles = @(Get-ChildItem -LiteralPath $candidate.FullName -Recurse -Include 'model.bin', 'model.safetensors' -File -ErrorAction SilentlyContinue)
        if ($configFile -and $configFile.Length -gt 0 -and $weightFiles.Count -gt 0 -and -not ($weightFiles | Where-Object { $_.Length -le 0 } | Select-Object -First 1)) {
            $totalBytes = [long](($weightFiles | Measure-Object -Property Length -Sum).Sum)
            $script:localModelInfo = [pscustomobject]@{ Path = $candidate.FullName; Bytes = $totalBytes }
            return
        }
    }
}

function Test-CtranslateCudaUsable {
    param([string]$PythonExe)
    $previousErrorActionPreference = $ErrorActionPreference
    $output = ''
    $probeCode = @'
import importlib.util
import os

if os.name == "nt":
    for module_name in ("nvidia.cublas", "nvidia.cudnn"):
        spec = importlib.util.find_spec(module_name)
        if spec and spec.submodule_search_locations:
            bin_dir = os.path.join(list(spec.submodule_search_locations)[0], "bin")
            if os.path.isdir(bin_dir):
                os.add_dll_directory(bin_dir)
import ctranslate2
print("__CT2_CUDA_OK__" if ctranslate2.get_cuda_device_count() > 0 else "__CT2_CUDA_OFF__")
'@
    try {
        $ErrorActionPreference = 'Continue'
        $output = (& $PythonExe -c $probeCode 2>$null) -join ''
        return ($output -match '__CT2_CUDA_OK__')
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing faster-whisper (default STT for Video Extraction)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] System Python 3.13 was NOT found. Run Step8_InstallPython first." -ForegroundColor Red
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @('faster_whisper')
    return
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
        return
    }
}

$hasGpu = Test-NvidiaGpuPresent
$sysPip = $Global:PIP_EXE_PATH
$cudaPolicy = Get-CudaRuntimePolicy
$ctranslateCudaMajor = [int](Get-AiRuntimePolicyValue -Name 'AI_CTRANSLATE2_CUDA_MAJOR' -Default '12')
$ctranslateGpuPackages = @(Get-AiRuntimePolicyList -Name 'AI_CTRANSLATE2_GPU_PACKAGES')

if ($hasGpu) {
    if (-not $cudaPolicy.Enabled -or $cudaPolicy.Major -ne $ctranslateCudaMajor) {
        Write-Host ("$SCRIPT_INDEX [i] GPU host uses canonical {0}; CTranslate2 requires CUDA {1}, so faster-whisper uses CPU int8 without installing a second CUDA stack." -f $cudaPolicy.Tag, $ctranslateCudaMajor) -ForegroundColor DarkGray
    }
}

if (Test-PyModule -Py $resolvedPython -PackageName 'faster-whisper') {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'faster-whisper already installed' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    Write-Host "$SCRIPT_INDEX [..] pip install faster-whisper (system Python) ..." -ForegroundColor Yellow
    & $sysPip install faster-whisper
    if (Test-PyModule -Py $resolvedPython -PackageName 'faster-whisper') {
        Write-Host "$SCRIPT_INDEX [OK] faster-whisper installed." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [X] faster-whisper still not importable after install." -ForegroundColor Red
    }
}

$ctranslateDepsReady = $true
if ($hasGpu -and $cudaPolicy.Enabled -and $cudaPolicy.Major -eq $ctranslateCudaMajor) {
    foreach ($packageSpec in $ctranslateGpuPackages) {
        if (-not (Test-PythonRequirementSatisfied -PythonExe $resolvedPython -PipSpec $packageSpec)) {
            $ctranslateDepsReady = $false
        }
    }
    if (-not $ctranslateDepsReady -and $ctranslateGpuPackages.Count -gt 0) {
        Write-Host ("$SCRIPT_INDEX [..] installing canonical CTranslate2 GPU dependencies: {0}" -f ($ctranslateGpuPackages -join ', ')) -ForegroundColor Yellow
        & $sysPip install @ctranslateGpuPackages
        $ctranslateDepsReady = $true
        foreach ($packageSpec in $ctranslateGpuPackages) {
            if (-not (Test-PythonRequirementSatisfied -PythonExe $resolvedPython -PipSpec $packageSpec)) {
                $ctranslateDepsReady = $false
            }
        }
    }
}

$useCtranslateCuda = ($hasGpu -and $cudaPolicy.Enabled -and $cudaPolicy.Major -eq $ctranslateCudaMajor -and $ctranslateDepsReady -and (Test-CtranslateCudaUsable -PythonExe $resolvedPython))
if ($hasGpu -and $cudaPolicy.Major -eq $ctranslateCudaMajor -and -not $useCtranslateCuda) {
    Write-Host "$SCRIPT_INDEX [i] CTranslate2 CUDA probe is unavailable; using CPU int8 without mutating the canonical CUDA stack." -ForegroundColor DarkGray
}

if ($modelExplicit -or $Force) {
    Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine faster_whisper -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    if (-not $Model -or $Model -eq 'auto') {
        $Model = Resolve-TtsModelTier -PythonExe $resolvedPython -Key faster_whisper_model -InstallScriptRoot $PSScriptRoot -Gpu:($useCtranslateCuda)
    }
    if ($Model -and $Model -ne 'auto') {
        $dlOk = $false
        Set-FasterWhisperLocalModelInfo -ModelName $Model
        if ($localModelInfo) {
            Write-Host ("$SCRIPT_INDEX [idempotent] local faster-whisper model found: {0} ({1:N0} bytes); remote lookup skipped" -f $localModelInfo.Path, $localModelInfo.Bytes) -ForegroundColor Green
            $dlOk = $true
        } else {
            Write-Host ("$SCRIPT_INDEX [..] Pre-downloading faster-whisper model '{0}' ..." -f $Model) -ForegroundColor Yellow
            try {
                $prevEap = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                $dlOut = (& $resolvedPython -c "from faster_whisper import download_model; download_model('$Model'); print('__DOWNLOAD_OK__')" 2>$null) -join ''
                $ErrorActionPreference = $prevEap
                $dlOk = ($dlOut -match '__DOWNLOAD_OK__')
            } catch { $dlOk = $false }
        }
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
