# Shared idempotent captcha/AI backend Python package installer (Windows).
# Package bundles mirror linux/debian/install_shells/15_install_python_prereq_packages.sh.
# CUDA wheel indexes mirror linux/common/base_libs/cuda_index.sh (PyTorch + PaddlePaddle 3.3 docs).

$cudaIndexPath = Join-Path $PSScriptRoot 'CudaIndex.ps1'
$pythonRuntimePath = Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1'
$dependencyMapPath = Join-Path $PSScriptRoot 'PythonDependencyMapInstallCommon.ps1'
$torchGuardPath = Join-Path $PSScriptRoot 'TorchCpuGuard.ps1'
$paddleGuardPath = Join-Path $PSScriptRoot 'PaddleCpuGuard.ps1'
$nvidiaAlignPath = Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1'
$cudaIndexLoaded = Get-Variable -Name 'PycoreCudaIndexLoaded' -Scope Script -ErrorAction SilentlyContinue
$pythonRuntimeLoaded = Get-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -ErrorAction SilentlyContinue
$dependencyMapLoaded = Get-Variable -Name 'PycorePythonDependencyMapInstallCommonLoaded' -Scope Script -ErrorAction SilentlyContinue
$torchGuardLoaded = Get-Variable -Name 'PycoreTorchCpuGuardLoaded' -Scope Script -ErrorAction SilentlyContinue
$paddleGuardLoaded = Get-Variable -Name 'PycorePaddleCpuGuardLoaded' -Scope Script -ErrorAction SilentlyContinue
$nvidiaAlignLoaded = Get-Variable -Name 'PycoreNvidiaCuStackAlignLoaded' -Scope Script -ErrorAction SilentlyContinue
if ($null -eq $pythonRuntimeLoaded -or -not [bool]$pythonRuntimeLoaded.Value) {
    . $pythonRuntimePath
    Set-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -Value $true
}
if ($null -eq $cudaIndexLoaded -or -not [bool]$cudaIndexLoaded.Value) {
    . $cudaIndexPath
    Set-Variable -Name 'PycoreCudaIndexLoaded' -Scope Script -Value $true
}
if ($null -eq $dependencyMapLoaded -or -not [bool]$dependencyMapLoaded.Value) {
    . $dependencyMapPath
    Set-Variable -Name 'PycorePythonDependencyMapInstallCommonLoaded' -Scope Script -Value $true
}
if ($null -eq $nvidiaAlignLoaded -or -not [bool]$nvidiaAlignLoaded.Value) {
    . $nvidiaAlignPath
    Set-Variable -Name 'PycoreNvidiaCuStackAlignLoaded' -Scope Script -Value $true
}
if ($null -eq $torchGuardLoaded -or -not [bool]$torchGuardLoaded.Value) {
    . $torchGuardPath
    Set-Variable -Name 'PycoreTorchCpuGuardLoaded' -Scope Script -Value $true
}
if ($null -eq $paddleGuardLoaded -or -not [bool]$paddleGuardLoaded.Value) {
    . $paddleGuardPath
    Set-Variable -Name 'PycorePaddleCpuGuardLoaded' -Scope Script -Value $true
}

$script:OcrBundle = Get-AiRuntimePolicyList -Name 'AI_OCR_PACKAGES'
$script:BackendBundle = @(Get-AiRuntimePolicyList -Name 'AI_BACKEND_COMMON_PACKAGES') + @(Get-AiRuntimePolicyList -Name 'AI_BACKEND_WINDOWS_PACKAGES')
$script:TorchPackages = @(Get-CanonicalTorchPackageSpecs)
$script:TorchBundle = @(Get-AiRuntimePolicyList -Name 'AI_TORCH_HEALTH_PACKAGES') + @(Get-AiRuntimePolicyList -Name 'AI_YOLO_PACKAGES')
$script:YoloBundle = Get-AiRuntimePolicyList -Name 'AI_YOLO_PACKAGES'
$script:TorchImports = Get-AiRuntimePolicyList -Name 'AI_TORCH_IMPORTS'
$script:PaddleImports = Get-AiRuntimePolicyList -Name 'AI_PADDLE_IMPORTS'
$script:BackendImports = @(Get-AiRuntimePolicyList -Name 'AI_BACKEND_COMMON_IMPORTS') + @(Get-AiRuntimePolicyList -Name 'AI_BACKEND_WINDOWS_IMPORTS')
$script:OpenCvPackage = Get-AiRuntimePolicyValue -Name 'AI_OPENCV_PACKAGE' -Default 'opencv-python'
$script:OpenCvCompatiblePackages = Get-AiRuntimePolicyList -Name 'AI_OPENCV_COMPATIBLE_PACKAGES'
$script:PypiDefaultIndex = 'https://pypi.org/simple'

function Test-PythonPrereqImportModules {
    param(
        [string]$PythonExe,
        [string[]]$Modules
    )
    $codeParts = @('import importlib')
    $moduleLiteral = ''
    $ok = $false
    $output = @()
    $previousErrorActionPreference = $ErrorActionPreference
    foreach ($module in $Modules) {
        $moduleLiteral = $module.Replace("'", "\'")
        $codeParts += "importlib.import_module('$moduleLiteral')"
    }
    $codeParts += "print('__IMPORTS_READY__')"
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $PythonExe -c ($codeParts -join '; ') 2>$null)
        $ok = (("$output") -match '__IMPORTS_READY__')
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    return $ok
}

function Test-PythonPrereqModulesPresent {
    param(
        [string]$PythonExe,
        [string[]]$Modules
    )
    $codeParts = @('import importlib.util')
    $expectedCount = $Modules.Count
    $moduleLiteral = ''
    $ok = $false
    $output = @()
    $presentCount = 0
    $previousErrorActionPreference = $ErrorActionPreference
    foreach ($module in $Modules) {
        $moduleLiteral = $module.Replace("'", "\'")
        $codeParts += "print('__MODULE_PRESENT__' if importlib.util.find_spec('$moduleLiteral') is not None else '__MODULE_MISSING__')"
    }
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $PythonExe -c ($codeParts -join '; ') 2>$null)
        $presentCount = @($output | Where-Object { "$_" -match '__MODULE_PRESENT__' }).Count
        $ok = ($presentCount -eq $expectedCount -and -not (("$output") -match '__MODULE_MISSING__'))
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    return $ok
}

function Test-PythonPrereqRequirements {
    param(
        [string]$PythonExe,
        [string[]]$Requirements
    )
    foreach ($requirement in $Requirements) {
        if (-not (Test-PythonRequirementSatisfied -PythonExe $PythonExe -PipSpec $requirement)) {
            return $false
        }
    }
    return $true
}

function Get-PythonPrereqFailedImports {
    param(
        [string]$PythonExe,
        [string[]]$Modules
    )
    $failed = @()
    foreach ($module in $Modules) {
        if (-not (Test-PythonPrereqImportModules -PythonExe $PythonExe -Modules @($module))) {
            $failed += $module
        }
    }
    return @($failed)
}

function Get-PythonPrereqMissingModules {
    param(
        [string]$PythonExe,
        [string[]]$Modules
    )
    $missing = @()
    foreach ($module in $Modules) {
        if (-not (Test-PythonPrereqModulesPresent -PythonExe $PythonExe -Modules @($module))) {
            $missing += $module
        }
    }
    return @($missing)
}

function Get-PythonPrereqUnsatisfiedRequirements {
    param(
        [string]$PythonExe,
        [string[]]$Requirements
    )
    $missing = @()
    foreach ($requirement in $Requirements) {
        if (-not (Test-PythonRequirementSatisfied -PythonExe $PythonExe -PipSpec $requirement)) {
            $missing += $requirement
        }
    }
    return @($missing)
}

function Get-PythonPrereqBundles {
    return @{
        OcrBundle      = $script:OcrBundle
        BackendBundle  = $script:BackendBundle
        TorchBundle    = $script:TorchBundle
        TorchImports   = $script:TorchImports
        PaddleImports  = $script:PaddleImports
        BackendImports = $script:BackendImports
    }
}

function Test-TorchBundleInstalled {
    param([string]$PythonExe)
    return Test-PythonPrereqRequirements -PythonExe $PythonExe -Requirements $script:TorchBundle
}

function Test-DepsBundleInstalled {
    param([string]$PythonExe)
    $requirements = @($script:OcrBundle) + @($script:BackendBundle)
    if (-not (Test-PaddlePackageInstalled -PythonExe $PythonExe)) {
        return $false
    }
    return Test-PythonPrereqRequirements -PythonExe $PythonExe -Requirements $requirements
}

function Test-AllPrereqBundleInstalled {
    param([string]$PythonExe)
    return (Test-TorchBundleInstalled -PythonExe $PythonExe) -and (Test-DepsBundleInstalled -PythonExe $PythonExe)
}

function Get-TorchExtraIndexArgs {
    $cpuIndex = Get-AiRuntimePolicyValue -Name 'AI_TORCH_CPU_INDEX' -Default 'https://download.pytorch.org/whl/cpu'
    if (Test-TcgGpuPresent) {
        return @('--extra-index-url', (Get-TorchCudaIndexUrl))
    }
    return @('--extra-index-url', $cpuIndex)
}

function Sync-PythonOpenCvDistribution {
    param(
        [string]$PythonExe,
        [string]$PipExe,
        [string]$LogPrefix = '[python-prereq]'
    )
    $installedPackage = ''
    $package = ''
    $moduleReady = Test-PythonPrereqModulesPresent -PythonExe $PythonExe -Modules @('cv2')
    foreach ($package in $script:OpenCvCompatiblePackages) {
        if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $package) {
            $installedPackage = $package
            break
        }
    }
    if ($installedPackage -and $moduleReady) {
        Write-Host "$LogPrefix [SKIP] OpenCV is provided by $installedPackage" -ForegroundColor Green
        return
    }
    if ($installedPackage) {
        Write-Host "$LogPrefix OpenCV metadata exists but cv2 is unavailable; asking pip to repair $installedPackage ..." -ForegroundColor Yellow
        & $PipExe install $installedPackage
    } else {
        Write-Host "$LogPrefix OpenCV is missing; installing $script:OpenCvPackage ..." -ForegroundColor Yellow
        & $PipExe install $script:OpenCvPackage
    }
    if (-not (Test-PythonPrereqModulesPresent -PythonExe $PythonExe -Modules @('cv2'))) {
        Write-Host "$LogPrefix OpenCV module is still unavailable; retrying next run." -ForegroundColor DarkYellow
    }
}

function Install-TorchYoloBundle {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [string]$LogPrefix = '[python-prereq]'
    )
    $torchExtra = @()
    $yoloBundle = @($script:YoloBundle)
    $failedImports = @()
    $failedRequirements = @()
    $isTorchInstalled = $false
    Write-Host "$LogPrefix Ensuring canonical torch build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-TorchBuild -PythonCmd $PythonCmd -PipExe $PipExe

    $isTorchInstalled = Test-TorchBundleInstalled -PythonExe $PythonCmd
    if ($isTorchInstalled) {
        Write-Host "$LogPrefix [SKIP] torch/torchvision/torchaudio/ultralytics already installed" -ForegroundColor Green
        return $true
    }

    Write-Host "$LogPrefix Installing ultralytics (YOLO) with torch bundle..." -ForegroundColor Yellow
    $torchExtra = Get-TorchExtraIndexArgs
    & $PipExe install @torchExtra @yoloBundle

    $isTorchInstalled = Test-TorchBundleInstalled -PythonExe $PythonCmd
    if ($isTorchInstalled) {
        Write-Host "$LogPrefix [OK] torch bundle installed" -ForegroundColor Green
        return $true
    } else {
        $failedImports = @(Get-PythonPrereqFailedImports -PythonExe $PythonCmd -Modules $script:TorchImports)
        $failedRequirements = @(Get-PythonPrereqUnsatisfiedRequirements -PythonExe $PythonCmd -Requirements $script:TorchBundle)
        Write-Host "$LogPrefix [ERROR] torch bundle remains incomplete after repair." -ForegroundColor Red
        if ($failedRequirements.Count -gt 0) {
            Write-Host "$LogPrefix        unsatisfied requirements: $($failedRequirements -join ', ')" -ForegroundColor Yellow
        }
        if ($failedImports.Count -gt 0) {
            Write-Host "$LogPrefix        failed imports: $($failedImports -join ', ')" -ForegroundColor Yellow
        }
        Write-Host "$LogPrefix        incomplete packages will be retried on the next run." -ForegroundColor DarkYellow
        return $false
    }
}

function Install-PaddleOcrBundle {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [string]$LogPrefix = '[python-prereq]'
    )
    $packages = @($script:OcrBundle) + @($script:BackendBundle)
    $requirements = @($script:OcrBundle) + @($script:BackendBundle)
    $failedRequirements = @()
    $isPaddleInstalled = $false
    Write-Host "$LogPrefix Ensuring canonical paddle build (CPU/GPU guard)..." -ForegroundColor Yellow
    Ensure-PaddleBuild -PythonCmd $PythonCmd -PipExe $PipExe

    $isPaddleInstalled = Test-DepsBundleInstalled -PythonExe $PythonCmd
    if ($isPaddleInstalled) {
        Write-Host "$LogPrefix [SKIP] paddle ecosystem + backend deps already installed" -ForegroundColor Green
        return $true
    }

    Write-Host "$LogPrefix Installing paddleocr + paddlex + backend deps (single resolver pass from PyPI)..." -ForegroundColor Yellow
    & $PipExe install -i $script:PypiDefaultIndex @packages

    $isPaddleInstalled = Test-DepsBundleInstalled -PythonExe $PythonCmd
    if ($isPaddleInstalled) {
        Write-Host "$LogPrefix [OK] paddle ecosystem + backend deps installed" -ForegroundColor Green
        return $true
    } else {
        $failedImports = @(Get-PythonPrereqFailedImports -PythonExe $PythonCmd -Modules $script:PaddleImports)
        $missingModules = @(Get-PythonPrereqMissingModules -PythonExe $PythonCmd -Modules $script:BackendImports)
        $failedRequirements = @(Get-PythonPrereqUnsatisfiedRequirements -PythonExe $PythonCmd -Requirements $requirements)
        Write-Host "$LogPrefix [ERROR] paddle/backend bundle remains unhealthy after repair." -ForegroundColor Red
        if (-not (Test-PaddlePackageInstalled -PythonExe $PythonCmd)) {
            Write-Host "$LogPrefix        canonical paddle distribution is missing" -ForegroundColor Yellow
        }
        if ($failedRequirements.Count -gt 0) {
            Write-Host "$LogPrefix        unsatisfied requirements: $($failedRequirements -join ', ')" -ForegroundColor Yellow
        }
        if ($failedImports.Count -gt 0) {
            Write-Host "$LogPrefix        failed core imports: $($failedImports -join ', ')" -ForegroundColor Yellow
        }
        if ($missingModules.Count -gt 0) {
            Write-Host "$LogPrefix        missing backend modules: $($missingModules -join ', ')" -ForegroundColor Yellow
        }
        Write-Host "$LogPrefix        incomplete packages will be retried on the next run." -ForegroundColor DarkYellow
        return $false
    }
}

function Invoke-PythonPrereqInstall {
    param(
        [string]$PreferredPythonPath,
        [string]$LogPrefix = '[python-prereq]'
    )
    $PythonCmd = $null
    $PipExe = $null
    $version = ''
    $cudaPolicy = $null
    $cudaLine = ''
    $failedRequirements = @()
    $torchBundleVerified = $false
    $paddleBundleVerified = $false
    $requirements = @()
    $PythonCmd = Resolve-PrereqPythonExe -PreferredPath $PreferredPythonPath
    if (-not $PythonCmd) {
        Write-Host "$LogPrefix [ERROR] no Python $($Global:PYTHON_VERSION) found at $($Global:PYTHON_EXE_PATH)." -ForegroundColor Red
        Write-Host "$LogPrefix        Run Step8_InstallPython.ps1 first." -ForegroundColor Red
        throw 'Canonical Python interpreter is unavailable.'
    }

    if ((Split-Path -Leaf $PythonCmd) -eq 'py.exe' -and $Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
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
    } else {
        Write-Host "$LogPrefix CPU policy: $($cudaPolicy.Reason)"
        Write-Host "$LogPrefix   torch index  -> $($cudaPolicy.TorchIndexUrl)"
        Write-Host "$LogPrefix   paddle index -> $($cudaPolicy.PaddleIndexUrl)"
    }
    Write-Host ''

    $torchBundleVerified = Install-TorchYoloBundle -PythonCmd $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    $paddleBundleVerified = Install-PaddleOcrBundle -PythonCmd $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    if ($cudaPolicy.Enabled) {
        Write-Host "$LogPrefix Aligning the single NVIDIA $($cudaPolicy.Tag) stack (idempotent)..." -ForegroundColor Cyan
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $cudaPolicy.Major
        Write-Host ''
    }

    Install-PycoreDependencyMapPackages -PipExe $PipExe -PythonExe $PythonCmd -LogPrefix $LogPrefix
    Write-Host ''

    Install-PinnedTransformers -PythonExe $PythonCmd -PipExe $PipExe -Prefix "$LogPrefix " | Out-Null
    Write-Host ''

    Sync-PythonOpenCvDistribution -PythonExe $PythonCmd -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    Write-Host "$LogPrefix Verifying pip package metadata..." -ForegroundColor Cyan
    if (-not $torchBundleVerified) {
        $torchBundleVerified = Test-TorchBundleInstalled -PythonExe $PythonCmd
    }
    if (-not $paddleBundleVerified) {
        $paddleBundleVerified = Test-DepsBundleInstalled -PythonExe $PythonCmd
    }

    if ($torchBundleVerified -and $paddleBundleVerified) {
        Write-Host "$LogPrefix [OK] all prerequisite packages present in $PythonCmd" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [ERROR] some prerequisite package metadata is missing." -ForegroundColor Red
        if (-not $torchBundleVerified) {
            $failedRequirements = @(Get-PythonPrereqUnsatisfiedRequirements -PythonExe $PythonCmd -Requirements $script:TorchBundle)
            Write-Host "$LogPrefix        torch requirements: $($failedRequirements -join ', ')" -ForegroundColor Yellow
        }
        if (-not $paddleBundleVerified) {
            $requirements = @($script:OcrBundle) + @($script:BackendBundle)
            $failedRequirements = @(Get-PythonPrereqUnsatisfiedRequirements -PythonExe $PythonCmd -Requirements $requirements)
            Write-Host "$LogPrefix        dependency requirements: $($failedRequirements -join ', ')" -ForegroundColor Yellow
        }
        Write-Host "$LogPrefix [!] prerequisite metadata is incomplete; missing packages will retry next run." -ForegroundColor DarkYellow
    }

    Write-Host ''
    Write-Host "$LogPrefix Python prerequisite packages step completed." -ForegroundColor Green
}
