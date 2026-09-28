# Installs the central pycore package policy for Windows Step10.

$pythonRuntimePath = Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1'
$cudaIndexPath = Join-Path $PSScriptRoot 'CudaIndex.ps1'
$nvidiaAlignPath = Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1'
$pythonRuntimeLoaded = Get-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -ErrorAction SilentlyContinue
$cudaIndexLoaded = Get-Variable -Name 'PycoreCudaIndexLoaded' -Scope Script -ErrorAction SilentlyContinue
$nvidiaAlignLoaded = Get-Variable -Name 'PycoreNvidiaCuStackAlignLoaded' -Scope Script -ErrorAction SilentlyContinue
if ($null -eq $pythonRuntimeLoaded -or -not [bool]$pythonRuntimeLoaded.Value) {
    . $pythonRuntimePath
    Set-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -Value $true
}
if ($null -eq $cudaIndexLoaded -or -not [bool]$cudaIndexLoaded.Value) {
    . $cudaIndexPath
    Set-Variable -Name 'PycoreCudaIndexLoaded' -Scope Script -Value $true
}
if ($null -eq $nvidiaAlignLoaded -or -not [bool]$nvidiaAlignLoaded.Value) {
    . $nvidiaAlignPath
    Set-Variable -Name 'PycoreNvidiaCuStackAlignLoaded' -Scope Script -Value $true
}

$script:PycoreWinCommonDir = $PSScriptRoot
$script:PycoreWinDir = Split-Path -Parent $script:PycoreWinCommonDir
$script:PycoreShellsDir = Split-Path -Parent $script:PycoreWinDir
$script:PycoreScriptsDir = Split-Path -Parent $script:PycoreShellsDir
$script:PycoreRootDir = Split-Path -Parent $script:PycoreScriptsDir
$script:PycorePackagePolicyPath = Join-Path $script:PycoreRootDir 'pycore\pyfoundations\python_package_policy.py'

function Get-PycorePolicyPackageRows {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [ValidateSet('installer', 'prepare', 'document', 'ocr', 'winrt')]
        [string]$Set = 'installer'
    )

    $line = ''
    $output = @()
    $parts = @()
    $rows = @()
    $output = @(& $PythonExe $script:PycorePackagePolicyPath --platform windows --set $Set 2>$null)
    foreach ($line in $output) {
        $parts = "$line" -split "`t", 2
        if ($parts.Count -ne 2 -or -not $parts[1]) {
            continue
        }
        $rows += [pscustomobject]@{ ImportName = $parts[0]; PipSpec = $parts[1] }
    }
    $rows
}

function Get-PipPackageBaseName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipSpec
    )

    return Get-PipPackageNameFromSpec -PipSpec $PipSpec
}

function Test-OnnxRuntimeImportReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe
    )

    $output = @()
    $text = ''
    $output = & $PythonExe -c "import onnxruntime as ort; ort.get_available_providers(); print('__ORT_READY__')" 2>$null
    $text = (@($output) -join [Environment]::NewLine)
    return $text.Contains('__ORT_READY__')
}

function Ensure-OnnxRuntimeCpuBuild {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [string]$LogPrefix = '[python-deps]'
    )

    $cpuPkg = 'onnxruntime'
    $gpuPkg = 'onnxruntime-gpu'
    $moduleReady = $false
    $targetInstalled = $false
    $targetPkg = ''
    $otherInstalled = $false
    $otherPkg = ''
    $cudaPolicy = Get-CudaRuntimePolicy
    $ortCudaMajor = [int](Get-AiRuntimePolicyValue -Name 'AI_ONNXRUNTIME_CUDA_MAJOR' -Default '12')
    $useGpuOrt = ((Test-NvidiaGpuPresent) -and $cudaPolicy.Enabled -and $cudaPolicy.Major -eq $ortCudaMajor)
    $targetPkg = if ($useGpuOrt) { $gpuPkg } else { $cpuPkg }
    $otherPkg = if ($useGpuOrt) { $cpuPkg } else { $gpuPkg }
    $targetInstalled = Test-PipPackageInstalled -PipExe $PipExe -PackageName $targetPkg
    $otherInstalled = Test-PipPackageInstalled -PipExe $PipExe -PackageName $otherPkg
    $moduleReady = Test-OnnxRuntimeImportReady -PythonExe $PythonExe

    if ($targetInstalled -and $moduleReady) {
        Write-Host "$LogPrefix [SKIP] $targetPkg is importable" -ForegroundColor DarkGray
        return
    }

    Write-Host "$LogPrefix [..] repairing ONNX Runtime package/module state with $targetPkg ..." -ForegroundColor Yellow
    if ($otherInstalled) {
        & $PipExe uninstall -y $otherPkg
    }
    if ($targetInstalled) {
        & $PipExe uninstall -y $targetPkg
    }
    & $PipExe install $targetPkg
    $moduleReady = Test-OnnxRuntimeImportReady -PythonExe $PythonExe
    if (-not $moduleReady) {
        Write-Host "$LogPrefix [!] ONNX Runtime module remains unavailable; it will retry next run." -ForegroundColor DarkYellow
    }
    if ($cudaPolicy.Enabled) {
        Sync-NvidiaCuStack -PythonCmd $PythonExe -PipExe $PipExe -TargetMajor $cudaPolicy.Major
    }
}

function Get-PycoreMissingPolicyRows {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Rows,
        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$InstalledPackages
    )

    $missing = @()
    $pipBase = ''
    $row = $null
    foreach ($row in $Rows) {
        $pipBase = Get-PipPackageBaseName -PipSpec $row.PipSpec
        if (-not (Test-PipPackageInSet -InstalledPackages $InstalledPackages -PackageName $pipBase)) {
            $missing += $row
        }
    }
    return $missing
}

function Install-PycorePolicySet {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('installer', 'prepare', 'document', 'ocr', 'winrt')]
        [string]$Set,
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    $installedPackages = @{}
    $missing = @()
    $pipSpecs = @()
    $remaining = @()
    $rows = @(Get-PycorePolicyPackageRows -PythonExe $PythonExe -Set $Set)
    $installedPackages = Get-PipInstalledPackageSet -PipExe $PipExe
    $missing = @(Get-PycoreMissingPolicyRows -Rows $rows -InstalledPackages $installedPackages)
    if ($missing.Count -eq 0) {
        Write-Host "$LogPrefix [SKIP] ${Set}: $($rows.Count) packages ready" -ForegroundColor DarkGray
        return
    }

    $pipSpecs = @($missing | ForEach-Object { [string]$_.PipSpec })
    Write-Host ("$LogPrefix [..] installing {0} missing ${Set} package(s): {1}" -f $pipSpecs.Count, ($pipSpecs -join ', ')) -ForegroundColor Yellow
    & $PipExe install @pipSpecs

    $installedPackages = Get-PipInstalledPackageSet -PipExe $PipExe -Refresh
    $remaining = @(Get-PycoreMissingPolicyRows -Rows $rows -InstalledPackages $installedPackages)
    if ($remaining.Count -gt 0) {
        $pipSpecs = @($remaining | ForEach-Object { [string]$_.PipSpec })
        Write-Host ("$LogPrefix [!] ${Set} remains incomplete: {0}" -f ($pipSpecs -join ', ')) -ForegroundColor DarkYellow
    } else {
        Write-Host "$LogPrefix [OK] ${Set}: $($rows.Count) packages ready" -ForegroundColor Green
    }
}

function Install-PycoreDependencyMapPackage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImportName,
        [Parameter(Mandatory = $true)]
        [string]$PipSpec,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [string]$LogPrefix = '[python-deps]'
    )

    $pipBase = Get-PipPackageBaseName -PipSpec $PipSpec
    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $pipBase) {
        return
    }
    Write-Host "$LogPrefix [..] installing missing $PipSpec ..." -ForegroundColor Yellow
    & $PipExe install $PipSpec
}

function Install-PycoreWinrtOcrPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    Install-PycorePolicySet -Set 'winrt' -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
}

function Install-PycorePrepareAlignedPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    Install-PycoreWinrtOcrPackages -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
    Install-PycorePolicySet -Set 'prepare' -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
}

function Install-PycoreDependencyMapPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$PythonExe = '',
        [string]$LogPrefix = '[python-deps]'
    )

    if (-not $PythonExe) {
        $PythonExe = Join-Path (Split-Path -Parent (Split-Path -Parent $PipExe)) 'python.exe'
    }
    Write-Host "$LogPrefix Installing central pycore package policy ..." -ForegroundColor Cyan
    Ensure-PipCacheDirConfigured -PipExe $PipExe
    Ensure-OnnxRuntimeCpuBuild -PipExe $PipExe -PythonExe $PythonExe -LogPrefix $LogPrefix

    Install-PycorePolicySet -Set 'installer' -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host "$LogPrefix Central pycore package policy complete" -ForegroundColor Cyan
    Install-PycorePrepareAlignedPackages -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
}
