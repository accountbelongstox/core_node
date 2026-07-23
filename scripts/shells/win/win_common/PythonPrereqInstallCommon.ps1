# Shared idempotent captcha/AI backend Python package installer (Windows).
# Package bundles mirror linux/debian/install_shells/14_install_python_prereq_packages.sh.
# CUDA wheel indexes mirror linux/common/base_libs/cuda_index.sh (PyTorch + PaddlePaddle 3.3 docs).

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'PythonDependencyMapInstallCommon.ps1')
. (Join-Path $PSScriptRoot 'TorchCpuGuard.ps1')
. (Join-Path $PSScriptRoot 'PaddleCpuGuard.ps1')
. (Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1')

$script:OcrBundle = Get-AiRuntimePolicyList -Name 'AI_OCR_PACKAGES'
$script:BackendBundle = @(Get-AiRuntimePolicyList -Name 'AI_BACKEND_COMMON_PACKAGES') + @(Get-AiRuntimePolicyList -Name 'AI_BACKEND_WINDOWS_PACKAGES')
$script:TorchDistPrefixes = @(Get-AiRuntimePolicyList -Name 'AI_TORCH_PACKAGES') + @('ultralytics')
$script:DepsDistPrefixes = @('paddleocr', 'paddlex', 'fastapi', 'uvicorn', 'psutil', 'opencv_contrib_python', 'pillow', 'numpy', 'scipy', 'pyclipper', 'shapely', 'websocket_client', 'pyautogui', 'pydirectinput', 'mss')
$script:PypiDefaultIndex = 'https://pypi.org/simple'
$script:TorchImportProbe = 'import torch, torchvision, torchaudio, ultralytics'
$script:DepsImportProbe = 'import paddle, paddleocr, paddlex, fastapi, uvicorn, psutil, cv2, PIL, numpy, scipy, pyclipper, shapely, websocket, pyautogui, pydirectinput, mss'

function Test-PythonPrereqImports {
    param(
        [string]$PythonExe,
        [string]$Code
    )
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $PythonExe -c $Code 2>$null
    $ok = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $previousErrorActionPreference
    return $ok
}

function Get-PythonPrereqBundles {
    return @{
        OcrBundle          = $script:OcrBundle
        BackendBundle      = $script:BackendBundle
        TorchDistPrefixes  = $script:TorchDistPrefixes
        DepsDistPrefixes   = $script:DepsDistPrefixes
    }
}

function Test-TorchBundleInstalled {
    param([string]$PythonExe)
    return (Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes $script:TorchDistPrefixes) -and
        (Test-PythonPrereqImports -PythonExe $PythonExe -Code $script:TorchImportProbe)
}

function Test-DepsBundleInstalled {
    param([string]$PythonExe)
    if (-not (Test-PaddleDistInfoPresent -PythonExe $PythonExe)) {
        return $false
    }
    return (Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes $script:DepsDistPrefixes) -and
        (Test-PythonPrereqImports -PythonExe $PythonExe -Code $script:DepsImportProbe)
}

function Test-AllPrereqBundleInstalled {
    param([string]$PythonExe)
    return (Test-TorchBundleInstalled -PythonExe $PythonExe) -and (Test-DepsBundleInstalled -PythonExe $PythonExe)
}

function Get-TorchExtraIndexArgs {
    if (Test-TcgGpuPresent) {
        return @('--extra-index-url', (Get-TorchCudaIndexUrl))
    }
    $cpuIndex = Get-AiRuntimePolicyValue -Name 'AI_TORCH_CPU_INDEX' -Default 'https://download.pytorch.org/whl/cpu'
    return @('--extra-index-url', $cpuIndex)
}

function Install-TorchYoloBundle {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [string]$LogPrefix = '[python-prereq]'
    )
    Write-Host "$LogPrefix Ensuring canonical torch build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-TorchBuild -PythonCmd $PythonCmd -PipExe $PipExe

    if (Test-TorchBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [SKIP] torch/torchvision/torchaudio/ultralytics already installed" -ForegroundColor Green
        return
    }

    Write-Host "$LogPrefix Installing ultralytics (YOLO) with torch bundle..." -ForegroundColor Yellow
    $torchExtra = Get-TorchExtraIndexArgs
    & $PipExe install --upgrade @torchExtra ultralytics
    if ($LASTEXITCODE -ne 0) {
        throw "Ultralytics installation failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-TorchBundleInstalled -PythonExe $PythonCmd)) {
        Write-Host "$LogPrefix Upgrading torch/torchvision/torchaudio together (version sync)..." -ForegroundColor Yellow
        & $PipExe install --upgrade @torchExtra torch torchvision torchaudio ultralytics
        if ($LASTEXITCODE -ne 0) {
            throw "Torch bundle installation failed with exit code $LASTEXITCODE."
        }
    }

    if (Test-TorchBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [OK] torch bundle installed" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [ERROR] torch bundle still missing after install." -ForegroundColor Red
    }
}

function Install-PaddleOcrBundle {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [string]$LogPrefix = '[python-prereq]'
    )
    Write-Host "$LogPrefix Ensuring canonical paddle build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-PaddleBuild -PythonCmd $PythonCmd -PipExe $PipExe

    if (Test-DepsBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [SKIP] paddle ecosystem + backend deps already installed" -ForegroundColor Green
        return
    }

    Write-Host "$LogPrefix Installing paddleocr + paddlex + backend deps (single resolver pass from PyPI)..." -ForegroundColor Yellow
    $packages = $script:OcrBundle + $script:BackendBundle
    & $PipExe install -i $script:PypiDefaultIndex @packages
    if ($LASTEXITCODE -ne 0) {
        throw "Paddle OCR/backend dependency installation failed with exit code $LASTEXITCODE."
    }

    if (Test-DepsBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [OK] paddle ecosystem + backend deps installed" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [ERROR] paddleocr/backend bundle still missing after install." -ForegroundColor Red
    }
}

function Invoke-PythonPrereqInstall {
    param(
        [string]$PreferredPythonPath,
        [string]$LogPrefix = '[python-prereq]'
    )
    $PythonCmd = Resolve-PrereqPythonExe -PreferredPath $PreferredPythonPath
    if (-not $PythonCmd) {
        Write-Host "$LogPrefix [ERROR] no Python $($Global:PYTHON_VERSION) found at $($Global:PYTHON_EXE_PATH)." -ForegroundColor Red
        Write-Host "$LogPrefix        Run Step8_InstallPython.ps1 first." -ForegroundColor Red
        throw 'Canonical Python interpreter is unavailable.'
    }

    if ($PythonCmd -match '\\py\.exe$' -and $Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
        $PythonCmd = (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path
    }

    $PipExe = $Global:PIP_EXE_PATH

    $version = Get-PythonVersionTextFromExe -PythonExe $PythonCmd
    Write-Host "$LogPrefix Target interpreter: $PythonCmd ($version)" -ForegroundColor White

    if (-not $PipExe -or -not (Test-Path -LiteralPath $PipExe)) {
        Write-Host "$LogPrefix [ERROR] pip is not available for $PythonCmd." -ForegroundColor Red
        Write-Host "$LogPrefix        Run Step8_InstallPython.ps1 first." -ForegroundColor Red
        throw 'Canonical pip executable is unavailable.'
    }

    & $PipExe --version
    Write-Host "$LogPrefix pip ready: $PipExe"

    $cudaPolicy = Get-CudaRuntimePolicy
    if ($cudaPolicy.Enabled) {
        $cudaLine = Get-NvidiaDriverCudaVersionLine
        Write-Host "$LogPrefix NVIDIA GPU detected $(if ($cudaLine) { "($cudaLine)" }) — unified $($cudaPolicy.Tag) policy."
        Write-Host "$LogPrefix   torch index   -> $($cudaPolicy.TorchIndexUrl)"
        Write-Host "$LogPrefix   paddle index  -> $($cudaPolicy.PaddleIndexUrl)"
        Write-Host "$LogPrefix   paddle version -> $($cudaPolicy.PaddleVersion)"
    } else {
        Write-Host "$LogPrefix CPU policy: $($cudaPolicy.Reason)"
        Write-Host "$LogPrefix   torch index  -> $($cudaPolicy.TorchIndexUrl)"
        Write-Host "$LogPrefix   paddle index -> $($cudaPolicy.PaddleIndexUrl)"
    }
    Write-Host ''

    Install-TorchYoloBundle -PythonCmd $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    Install-PaddleOcrBundle -PythonCmd $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    if ($cudaPolicy.Enabled) {
        Write-Host "$LogPrefix Aligning the single NVIDIA $($cudaPolicy.Tag) stack (idempotent)..." -ForegroundColor Cyan
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $cudaPolicy.Major
        Write-Host ''
    }

    Install-PycoreDependencyMapPackages -PipExe $PipExe -PythonExe $PythonCmd -LogPrefix $LogPrefix
    Write-Host ''

    Write-Host "$LogPrefix Verifying installed packages (site-packages dist-info)..." -ForegroundColor Cyan
    if (Test-AllPrereqBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [OK] all prerequisite packages present in $PythonCmd" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [ERROR] some prerequisite packages are missing or not importable." -ForegroundColor Red
        if (-not (Test-TorchBundleInstalled -PythonExe $PythonCmd)) {
            Write-Host "$LogPrefix        missing torch bundle: $($script:TorchDistPrefixes -join ', ')" -ForegroundColor Yellow
        }
        if (-not (Test-DepsBundleInstalled -PythonExe $PythonCmd)) {
            Write-Host "$LogPrefix        missing deps bundle (incl. paddle): $($script:DepsDistPrefixes -join ', ')" -ForegroundColor Yellow
        }
        throw 'Python prerequisite health verification failed.'
    }

    Write-Host ''
    Write-Host "$LogPrefix Python prerequisite packages step completed." -ForegroundColor Green
}
