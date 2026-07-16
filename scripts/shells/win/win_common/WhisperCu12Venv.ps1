# Idempotent cu12 virtualenv for faster-whisper / CTranslate2 (Windows).
#
# CTranslate2 (faster-whisper's backend) is CUDA-12 only and ships
# nvidia-cublas-cu12 / nvidia-cudnn-cu12, which share the nvidia\<lib>\ dirs
# with paddle/torch cu13 and clobber each other (WinError 127). This module
# gives CTranslate2 its OWN venv with its own cu12 nvidia libs, fully isolated
# from the system Python (which stays cu13 for paddle/torch).
#
# GPU host -> venv created; faster-whisper GPU runs here via subprocess from
# pycore. CPU host -> no venv (faster-whisper runs CPU int8 in the system
# Python; no cu12 libs, no collision).
#
# Pure business logic. Sources CudaIndex.ps1 + PythonRuntimeCommon.ps1. The
# venv path MUST match Get-WhisperCu12VenvPythonPath in NvidiaCuStackAlign.ps1.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')

$script:WhisperCu12VenvName = 'whisper_cu12'
$script:WhisperCu12VenvSubdir = 'venvs'
$script:WhisperCu12RegistryFile = 'whisper_cu12_venv.json'
$script:WhisperPrefix = '[whisper-cu12-venv]'
$script:WhisperCu12Packages = @('faster-whisper', 'ctranslate2', 'nvidia-cublas-cu12', 'nvidia-cudnn-cu12==9.*')

function Get-WhisperCu12VenvDir {
    if ($Global:LANG_COMPILER_DIR) {
        return (Join-Path $Global:LANG_COMPILER_DIR (Join-Path $script:WhisperCu12VenvSubdir $script:WhisperCu12VenvName))
    }
    return $null
}

function Resolve-WhisperCu12Python {
    $dir = Get-WhisperCu12VenvDir
    if (-not $dir) { return $null }
    $py = Join-Path $dir 'Scripts\python.exe'
    if (Test-Path -LiteralPath $py) { return $py }
    return $null
}

function Get-WhisperCu12RegistryPath {
    if ($Global:USER_DIR) {
        return (Join-Path $Global:USER_DIR $script:WhisperCu12RegistryFile)
    }
    return $null
}

function Write-WhisperCu12Registry {
    param([Parameter(Mandatory = $true)][string]$VenvPython)
    $regPath = Get-WhisperCu12RegistryPath
    if (-not $regPath) { return }
    $regDir = Split-Path $regPath -Parent
    if (-not (Test-Path -LiteralPath $regDir)) {
        New-Item -ItemType Directory -Path $regDir -Force | Out-Null
    }
    $payload = @{ python = $VenvPython } | ConvertTo-Json -Compress
    Set-Content -LiteralPath $regPath -Value $payload -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Test-WhisperCu12VenvReady {
    param([Parameter(Mandatory = $true)][string]$VenvPython)
    if (-not (Test-Path -LiteralPath $VenvPython)) { return $false }
    # Dist-info under the venv site-packages (not pip.exe layout). Avoids python -c
    # and the system-Python pip\toot path that miss Scripts\python.exe in a venv.
    $required = @('faster-whisper', 'ctranslate2', 'nvidia-cublas-cu12', 'nvidia-cudnn-cu12')
    return (Test-PythonDistInfoPresent -PythonExe $VenvPython -DistPrefixes $required)
}

function Ensure-WhisperCu12Venv {
    param(
        [Parameter(Mandatory = $true)][string]$BasePython,
        [switch]$Force
    )
    # CPU host: no cu12 venv (faster-whisper runs CPU int8 in the system Python).
    if (-not (Test-NvidiaGpuPresent)) {
        Write-Host "$script:WhisperPrefix no NVIDIA GPU -> no cu12 venv (faster-whisper uses CPU in system Python)." -ForegroundColor DarkGray
        return $null
    }
    if (-not (Test-Path -LiteralPath $BasePython)) {
        Write-Host "$script:WhisperPrefix base python not found ($BasePython); cannot create venv." -ForegroundColor Yellow
        return $null
    }

    $venvDir = Get-WhisperCu12VenvDir
    if (-not $venvDir) {
        Write-Host "$script:WhisperPrefix LANG_COMPILER_DIR unset; cannot place venv." -ForegroundColor Yellow
        return $null
    }
    $venvPython = Join-Path $venvDir 'Scripts\python.exe'

    if ((-not $Force) -and (Test-WhisperCu12VenvReady -VenvPython $venvPython)) {
        Write-Host "$script:WhisperPrefix venv ready: $venvPython" -ForegroundColor Green
        Write-WhisperCu12Registry -VenvPython $venvPython
        return $venvPython
    }

    $venvParent = Split-Path $venvDir -Parent
    if (-not (Test-Path -LiteralPath $venvParent)) {
        New-Item -ItemType Directory -Path $venvParent -Force | Out-Null
    }

    if (-not (Test-Path -LiteralPath $venvPython)) {
        Write-Host "$script:WhisperPrefix creating cu12 venv at $venvDir (base: $BasePython) ..." -ForegroundColor Yellow
        & $BasePython -m venv $venvDir 2>&1 | Out-Host
        if (-not (Test-Path -LiteralPath $venvPython)) {
            Write-Host "$script:WhisperPrefix venv creation failed ($venvPython missing)." -ForegroundColor Red
            return $null
        }
        & $venvPython -m pip install --upgrade pip 2>&1 | Out-Host
    }

    Write-Host "$script:WhisperPrefix installing faster-whisper + CTranslate2 + cu12 libs into venv ..." -ForegroundColor Yellow
    # Out-Host: show pip output live WITHOUT letting it leak into the function's
    # return value (PowerShell returns all pipeline output, which would otherwise
    # make $venvPython = the pip text instead of the python path).
    & $venvPython -m pip install --upgrade @script:WhisperCu12Packages 2>&1 | Out-Host

    if (Test-WhisperCu12VenvReady -VenvPython $venvPython) {
        Write-Host "$script:WhisperPrefix venv ready: $venvPython" -ForegroundColor Green
        Write-WhisperCu12Registry -VenvPython $venvPython
        return $venvPython
    }
    Write-Host "$script:WhisperPrefix venv packages incomplete; faster-whisper GPU will be unavailable." -ForegroundColor Yellow
    return $null
}

function Remove-WhisperFromSystemPython {
    param(
        [Parameter(Mandatory = $true)][string]$PipExe,
        [string]$Prefix = ''
    )
    # Migrate faster-whisper/CTranslate2 + cu12 nvidia libs OUT of the system
    # Python once the cu12 venv exists (GPU host). On CPU hosts (no venv) this
    # is a no-op: faster-whisper stays in the system Python (CPU int8, no cu12
    # libs, no collision). Removing the cu12 libs from the system Python is what
    # stops them clobbering paddle/torch cu13 (WinError 127).
    $venvPython = Resolve-WhisperCu12Python
    if (-not $venvPython) { return }
    if (-not (Test-Path -LiteralPath $PipExe)) { return }
    $toRemove = @('faster-whisper', 'ctranslate2',
                  'nvidia-cublas-cu12', 'nvidia-cudnn-cu12', 'nvidia-cuda-nvrtc-cu12')
    Write-Host "${Prefix}Relocating faster-whisper/CTranslate2 + cu12 libs out of system Python (now in cu12 venv)..." -ForegroundColor Yellow
    & $PipExe uninstall -y @toRemove
}
