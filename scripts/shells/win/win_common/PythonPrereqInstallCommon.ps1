# Shared idempotent captcha/AI backend Python package installer (Windows).
# Package bundles mirror linux/debian/install_shells/14_install_python_prereq_packages.sh.
# CUDA wheel indexes mirror linux/common/base_libs/cuda_index.sh (PyTorch + PaddlePaddle 3.3 docs).

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'PythonDependencyMapInstallCommon.ps1')
. (Join-Path $PSScriptRoot 'TorchCpuGuard.ps1')
. (Join-Path $PSScriptRoot 'PaddleCpuGuard.ps1')
. (Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1')

$script:OcrBundle = @('paddleocr>=3.7.0', 'paddlex>=3.7.0')
$script:BackendBundle = @(
    'fastapi', 'uvicorn[standard]', 'psutil', 'opencv-contrib-python', 'pillow',
    'numpy', 'scipy', 'pyclipper', 'shapely', 'websocket-client',
    'pyautogui', 'pydirectinput', 'mss'
)
$script:TorchDistPrefixes = @('torch', 'torchvision', 'torchaudio', 'ultralytics')
$script:DepsDistPrefixes = @('paddleocr', 'paddlex', 'fastapi', 'uvicorn', 'psutil', 'opencv_contrib_python', 'pillow', 'numpy', 'scipy', 'pyclipper', 'shapely', 'websocket_client', 'pyautogui', 'pydirectinput', 'mss')
$script:PypiDefaultIndex = 'https://pypi.org/simple'

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
    return Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes $script:TorchDistPrefixes
}

function Test-DepsBundleInstalled {
    param([string]$PythonExe)
    if (-not (Test-PaddleDistInfoPresent -PythonExe $PythonExe)) {
        return $false
    }
    return Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes $script:DepsDistPrefixes
}

function Test-AllPrereqBundleInstalled {
    param([string]$PythonExe)
    return (Test-TorchBundleInstalled -PythonExe $PythonExe) -and (Test-DepsBundleInstalled -PythonExe $PythonExe)
}

function Get-TorchExtraIndexArgs {
    if (Test-TcgGpuPresent) {
        return @('--extra-index-url', (Get-TorchCudaIndexUrl))
    }
    return @('--extra-index-url', 'https://download.pytorch.org/whl/cpu')
}

function Install-TorchYoloBundle {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [string]$LogPrefix = '[python-prereq]'
    )
    if (Test-TorchBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [SKIP] torch/torchvision/torchaudio/ultralytics already installed" -ForegroundColor Green
        return
    }

    Write-Host "$LogPrefix Ensuring torch build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-TorchBuild -PythonCmd $PythonCmd -PipExe $PipExe

    Write-Host "$LogPrefix Installing ultralytics (YOLO) with torch bundle..." -ForegroundColor Yellow
    $torchExtra = Get-TorchExtraIndexArgs
    & $PipExe install --upgrade @torchExtra ultralytics

    if (-not (Test-TorchBundleInstalled -PythonExe $PythonCmd)) {
        Write-Host "$LogPrefix Upgrading torch/torchvision/torchaudio together (version sync)..." -ForegroundColor Yellow
        & $PipExe install --upgrade @torchExtra torch torchvision torchaudio ultralytics
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
    if (Test-DepsBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [SKIP] paddle ecosystem + backend deps already installed" -ForegroundColor Green
        return
    }

    Write-Host "$LogPrefix Ensuring paddle build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-PaddleBuild -PythonCmd $PythonCmd -PipExe $PipExe

    Write-Host "$LogPrefix Installing paddleocr + paddlex + backend deps (single resolver pass from PyPI)..." -ForegroundColor Yellow
    $packages = $script:OcrBundle + $script:BackendBundle
    & $PipExe install -i $script:PypiDefaultIndex @packages

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
        return
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
        return
    }

    & $PipExe --version
    Write-Host "$LogPrefix pip ready: $PipExe"

    if (Test-TcgGpuPresent) {
        $cudaLine = Get-NvidiaDriverCudaVersionLine
        Write-Host "$LogPrefix NVIDIA GPU detected $(if ($cudaLine) { "($cudaLine)" }) — GPU wheels when driver supports them."
        Write-Host "$LogPrefix   torch index  -> $(Get-TorchCudaIndexUrl)"
        Write-Host "$LogPrefix   paddle index -> $(Get-PaddleCudaIndexUrl)"
    } else {
        Write-Host "$LogPrefix No NVIDIA GPU — CPU wheels for torch and paddle."
        Write-Host "$LogPrefix   torch index  -> https://download.pytorch.org/whl/cpu"
        Write-Host "$LogPrefix   paddle index -> https://www.paddlepaddle.org.cn/packages/stable/cpu/"
    }
    Write-Host ''

    Install-TorchYoloBundle -PythonCmd $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    Install-PaddleOcrBundle -PythonCmd $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    # Final cu13 alignment: ensure the system Python's cu13 nvidia stack is
    # consistent (restore clobbered/missing cu13 DLLs) so paddle/torch import
    # cleanly. No cu12 nvidia libs are installed in this flow, so this is usually
    # a no-op; it heals any prior cu12/cu13 clobber left from older installs.
    Write-Host "$LogPrefix Aligning NVIDIA cu13 stack (idempotent)..." -ForegroundColor Cyan
    Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor 13
    Write-Host ''

    Install-PycoreDependencyMapPackages -PipExe $PipExe -PythonExe $PythonCmd -LogPrefix $LogPrefix
    Write-Host ''

    Write-Host "$LogPrefix Verifying installed packages (site-packages dist-info)..." -ForegroundColor Cyan
    if (Test-AllPrereqBundleInstalled -PythonExe $PythonCmd) {
        Write-Host "$LogPrefix [OK] all prerequisite packages present in $PythonCmd" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [WARN] some packages missing; re-run or install manually." -ForegroundColor Yellow
        if (-not (Test-TorchBundleInstalled -PythonExe $PythonCmd)) {
            Write-Host "$LogPrefix        missing torch bundle: $($script:TorchDistPrefixes -join ', ')" -ForegroundColor Yellow
        }
        if (-not (Test-DepsBundleInstalled -PythonExe $PythonCmd)) {
            Write-Host "$LogPrefix        missing deps bundle (incl. paddle): $($script:DepsDistPrefixes -join ', ')" -ForegroundColor Yellow
        }
    }

    Write-Host ''
    Write-Host "$LogPrefix Python prerequisite packages step completed." -ForegroundColor Green
}
