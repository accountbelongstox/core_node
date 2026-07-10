# Shared idempotent captcha/AI backend Python package installer (Windows).
# Package bundles mirror linux/debian/install_shells/14_install_python_prereq_packages.sh.
# CUDA wheel indexes mirror linux/common/base_libs/cuda_index.sh (PyTorch + PaddlePaddle 3.3 docs).

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'TorchCpuGuard.ps1')
. (Join-Path $PSScriptRoot 'PaddleCpuGuard.ps1')

$script:OcrBundle = @('paddleocr>=3.7.0', 'paddlex>=3.7.0')
$script:BackendBundle = @(
    'fastapi', 'uvicorn[standard]', 'psutil', 'opencv-contrib-python', 'pillow',
    'numpy', 'scipy', 'pyclipper', 'shapely', 'websocket-client',
    'pyautogui', 'pydirectinput', 'mss'
)
$script:TorchProbe = 'import torch, torchvision, torchaudio, ultralytics'
$script:DepsProbe = 'import paddle, paddleocr, paddlex, fastapi, uvicorn, psutil, cv2, PIL, numpy, scipy, pyclipper, shapely, websocket, pyautogui, pydirectinput, mss'
$script:AllProbe = 'import torch, torchvision, torchaudio, ultralytics, paddle, paddleocr, paddlex, fastapi, uvicorn, psutil, cv2, PIL, numpy, scipy, pyclipper, shapely, websocket, pyautogui, pydirectinput, mss'
$script:PypiDefaultIndex = 'https://pypi.org/simple'

function Get-PythonPrereqBundles {
    return @{
        OcrBundle     = $script:OcrBundle
        BackendBundle = $script:BackendBundle
        TorchProbe    = $script:TorchProbe
        DepsProbe     = $script:DepsProbe
        AllProbe      = $script:AllProbe
    }
}

function Resolve-PrereqPythonCmd {
    param(
        [string]$PreferredPath
    )
    if ($PreferredPath -and (Test-Path $PreferredPath)) {
        try {
            & $PreferredPath -c 'import sys; sys.exit(0 if sys.version_info[:2] in ((3, 12), (3, 13)) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { return $PreferredPath }
        } catch { }
    }

    foreach ($candidate in @('python3.13', 'python3.12', 'python3', 'python')) {
        $found = Get-Command $candidate -ErrorAction SilentlyContinue
        if (-not $found) { continue }
        try {
            & $found.Source -c 'import sys; sys.exit(0 if sys.version_info[:2] in ((3, 12), (3, 13)) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { return $found.Source }
        } catch { }
    }

    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        foreach ($ver in @('-3.13', '-3.12')) {
            try {
                & $pyLauncher.Source $ver -c 'import sys; sys.exit(0 if sys.version_info[:2] in ((3, 12), (3, 13)) else 1)' 2>$null
                if ($LASTEXITCODE -eq 0) { return $pyLauncher.Source }
            } catch { }
        }
    }
    return $null
}

function Get-PythonRunArgs {
    param([string]$PythonCmd)
    if ($PythonCmd -match '\\py\.exe$') {
        foreach ($ver in @('-3.13', '-3.12')) {
            try {
                & $PythonCmd $ver -c 'import sys; sys.exit(0 if sys.version_info[:2] in ((3, 12), (3, 13)) else 1)' 2>$null
                if ($LASTEXITCODE -eq 0) { return @($PythonCmd, $ver) }
            } catch { }
        }
        return @($PythonCmd, '-3.13')
    }
    return @($PythonCmd)
}

function Test-PythonImportProbe {
    param(
        [string[]]$PyRun,
        [string]$Probe
    )
    & $PyRun -c $Probe 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Test-PythonPipReady {
    param([string[]]$PyRun)
    & $PyRun -m pip --version 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
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
        [string[]]$PyRun,
        [string]$LogPrefix = '[python-prereq]'
    )
    if (Test-PythonImportProbe -PyRun $PyRun -Probe $script:TorchProbe) {
        Write-Host "$LogPrefix [SKIP] torch/torchvision/torchaudio/ultralytics already importable" -ForegroundColor Green
        return $true
    }

    Write-Host "$LogPrefix Ensuring torch build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-TorchBuild -PythonCmd $PythonCmd -PyRun $PyRun

    Write-Host "$LogPrefix Installing ultralytics (YOLO) with torch bundle..." -ForegroundColor Yellow
    $torchExtra = Get-TorchExtraIndexArgs
    & $PyRun -m pip install --upgrade @torchExtra ultralytics
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$LogPrefix [ERROR] ultralytics install failed." -ForegroundColor Red
        return $false
    }

    if (-not (Test-PythonImportProbe -PyRun $PyRun -Probe $script:TorchProbe)) {
        Write-Host "$LogPrefix Upgrading torch/torchvision/torchaudio together (version sync)..." -ForegroundColor Yellow
        & $PyRun -m pip install --upgrade @torchExtra torch torchvision torchaudio ultralytics
        if ($LASTEXITCODE -ne 0) {
            Write-Host "$LogPrefix [ERROR] torch bundle install failed." -ForegroundColor Red
            return $false
        }
    }
    return $true
}

function Install-PaddleOcrBundle {
    param(
        [string]$PythonCmd,
        [string[]]$PyRun,
        [string]$LogPrefix = '[python-prereq]'
    )
    if (Test-PythonImportProbe -PyRun $PyRun -Probe $script:DepsProbe) {
        Write-Host "$LogPrefix [SKIP] paddle ecosystem + backend deps already importable" -ForegroundColor Green
        return $true
    }

    Write-Host "$LogPrefix Ensuring paddle build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-PaddleBuild -PythonCmd $PythonCmd -PyRun $PyRun

    Write-Host "$LogPrefix Installing paddleocr + paddlex + backend deps (single resolver pass from PyPI)..." -ForegroundColor Yellow
    $packages = $script:OcrBundle + $script:BackendBundle
    & $PyRun -m pip install -i $script:PypiDefaultIndex @packages
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$LogPrefix [ERROR] paddleocr/backend bundle install failed." -ForegroundColor Red
        return $false
    }
    return $true
}

function Invoke-PythonPrereqInstall {
    param(
        [string]$PreferredPythonPath,
        [string]$LogPrefix = '[python-prereq]'
    )
    $PythonCmd = Resolve-PrereqPythonCmd -PreferredPath $PreferredPythonPath
    if (-not $PythonCmd) {
        Write-Host "$LogPrefix [ERROR] no Python 3.12/3.13 found." -ForegroundColor Red
        Write-Host "$LogPrefix        Run Step8_InstallPython.ps1 first." -ForegroundColor Red
        return 1
    }

    $PyRun = Get-PythonRunArgs -PythonCmd $PythonCmd
    $version = (& $PyRun --version 2>&1 | Out-String).Trim()
    Write-Host "$LogPrefix Target interpreter: $PythonCmd ($version)" -ForegroundColor White

    if (-not (Test-PythonPipReady -PyRun $PyRun)) {
        Write-Host "$LogPrefix [ERROR] pip is not available for $PythonCmd." -ForegroundColor Red
        Write-Host "$LogPrefix        Run Step8_InstallPython.ps1 first." -ForegroundColor Red
        return 1
    }

    $pipVer = (& $PyRun -m pip --version 2>&1 | Out-String).Trim()
    Write-Host "$LogPrefix pip ready: $pipVer"

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

    if (-not (Install-TorchYoloBundle -PythonCmd $PythonCmd -PyRun $PyRun -LogPrefix $LogPrefix)) { return 1 }
    Write-Host ''

    if (-not (Install-PaddleOcrBundle -PythonCmd $PythonCmd -PyRun $PyRun -LogPrefix $LogPrefix)) { return 1 }
    Write-Host ''

    Write-Host "$LogPrefix Verifying all imports..." -ForegroundColor Cyan
    if (Test-PythonImportProbe -PyRun $PyRun -Probe $script:AllProbe) {
        Write-Host "$LogPrefix [OK] all prerequisite packages importable in $PythonCmd" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [WARN] some imports failed; re-run or install the missing package manually." -ForegroundColor Yellow
        & $PyRun -c $script:AllProbe 2>&1 | Select-Object -Last 8
    }

    Write-Host ''
    Write-Host "$LogPrefix Python prerequisite packages step completed." -ForegroundColor Green
    return 0
}
