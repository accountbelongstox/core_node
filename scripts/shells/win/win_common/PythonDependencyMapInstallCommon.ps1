# Installs the central pycore package policy for Windows Step10.

. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')

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
        [ValidateSet('installer', 'prepare', 'winrt')]
        [string]$Set = 'installer'
    )

    if (-not (Test-Path -LiteralPath $script:PycorePackagePolicyPath)) {
        Write-Host "[python-deps] [ERROR] central package policy missing: $script:PycorePackagePolicyPath" -ForegroundColor Red
        return @()
    }

    $output = @(& $PythonExe $script:PycorePackagePolicyPath --platform windows --set $Set 2>$null)
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($line in $output) {
        $parts = "$line" -split "`t", 2
        if ($parts.Count -ne 2 -or -not $parts[1]) {
            continue
        }
        $rows.Add([pscustomobject]@{ ImportName = $parts[0]; PipSpec = $parts[1] })
    }
    return @($rows)
}

function Get-PipPackageBaseName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipSpec
    )

    $name = ($PipSpec -split '\[')[0]
    $name = ($name -split '[<>=!,\s]')[0].Trim()
    return $name
}

function Test-PycoreRequirementSatisfied {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipSpec
    )
    $previousSpec = $env:PYCORE_REQUIREMENT_SPEC
    $previousPreference = $ErrorActionPreference
    $code = @'
import importlib.metadata as metadata
import os
try:
    from packaging.requirements import Requirement
except ImportError:
    from pip._vendor.packaging.requirements import Requirement

requirement = Requirement(os.environ["PYCORE_REQUIREMENT_SPEC"])
try:
    installed = metadata.version(requirement.name)
except metadata.PackageNotFoundError:
    raise SystemExit(1)
raise SystemExit(0 if not requirement.specifier or requirement.specifier.contains(installed, prereleases=True) else 1)
'@
    $env:PYCORE_REQUIREMENT_SPEC = $PipSpec
    $ErrorActionPreference = 'Continue'
    & $PythonExe -c $code 2>$null
    $ok = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $previousPreference
    $env:PYCORE_REQUIREMENT_SPEC = $previousSpec
    return $ok
}

function Ensure-OnnxRuntimeCpuBuild {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    $gpuPkg = 'onnxruntime-gpu'
    $cpuPkg = 'onnxruntime'
    if (Test-NvidiaGpuPresent) {
        Write-Host "$LogPrefix [i] GPU present; ONNX runtime left to the OCR initializer." -ForegroundColor DarkGray
        return
    }
    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $gpuPkg) {
        Write-Host "$LogPrefix [..] No GPU but $gpuPkg present -> switching to $cpuPkg ..." -ForegroundColor Yellow
        & $PipExe uninstall -y $gpuPkg
    }
    if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $cpuPkg)) {
        Write-Host "$LogPrefix [..] Installing CPU $cpuPkg ..." -ForegroundColor Yellow
        & $PipExe install $cpuPkg
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
    $requirementReady = Test-PycoreRequirementSatisfied -PythonExe $PythonExe -PipSpec $PipSpec
    $moduleReady = Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName $ImportName
    if ($requirementReady -and $moduleReady) {
        Write-Host "$LogPrefix [SKIP] $PipSpec already satisfies policy" -ForegroundColor DarkGray
        return $true
    }
    if ($requirementReady -and -not $moduleReady) {
        Write-Host "$LogPrefix [..] repairing $PipSpec (metadata present, import missing) ..." -ForegroundColor Yellow
        & $PipExe install --force-reinstall --no-deps $PipSpec
    } else {
        Write-Host "$LogPrefix [..] aligning $PipSpec ..." -ForegroundColor Yellow
        & $PipExe install --upgrade $PipSpec
    }
    $installOk = ($LASTEXITCODE -eq 0)
    $requirementReady = Test-PycoreRequirementSatisfied -PythonExe $PythonExe -PipSpec $PipSpec
    $moduleReady = Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName $ImportName
    if ($installOk -and $requirementReady -and $moduleReady) {
        Write-Host "$LogPrefix [OK] $pipBase installed" -ForegroundColor Green
        return $true
    }
    Write-Host "$LogPrefix [!] $pipBase still missing after install" -ForegroundColor DarkYellow
    return $false
}

function Test-PycorePythonModulePresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    $modLiteral = ($ModuleName -replace "'", "''")
    $code = "import importlib.util; print('__FOUND__' if importlib.util.find_spec('$modLiteral') else '__MISSING__')"
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = (& $PythonExe -c $code 2>$null) -join ''
    $ErrorActionPreference = $previousPreference
    return ($output -match '__FOUND__')
}

function Install-PycoreWinrtOcrPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'winrt.windows.media.ocr') {
        Write-Host "$LogPrefix [SKIP] Windows OCR already importable" -ForegroundColor DarkGray
        return
    }
    $rows = @(Get-PycorePolicyPackageRows -PythonExe $PythonExe -Set 'winrt')
    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($row in $rows) {
        $pipBase = Get-PipPackageBaseName -PipSpec $row.PipSpec
        if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $pipBase)) {
            $missing.Add($row.PipSpec)
        }
    }
    if ($missing.Count -gt 0) {
        Write-Host ("$LogPrefix [..] pip install {0} ..." -f ($missing -join ' ')) -ForegroundColor Yellow
        & $PipExe install @missing
    }
    if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'winrt.windows.media.ocr') {
        Write-Host "$LogPrefix [OK] Windows OCR installed" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [!] Windows OCR is unavailable; EasyOCR remains available" -ForegroundColor DarkYellow
    }
}

function Install-PycorePrepareAlignedPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    $rows = @(Get-PycorePolicyPackageRows -PythonExe $PythonExe -Set 'prepare')
    Install-PycoreWinrtOcrPackages -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
    foreach ($row in $rows) {
        if (-not (Install-PycoreDependencyMapPackage -ImportName $row.ImportName -PipSpec $row.PipSpec -PipExe $PipExe -PythonExe $PythonExe -LogPrefix $LogPrefix)) {
            throw "Prepare-aligned package failed: $($row.PipSpec)."
        }
    }
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
    if (Get-Command Ensure-PipCacheDirConfigured -ErrorAction SilentlyContinue) {
        Ensure-PipCacheDirConfigured -PipExe $PipExe
    }
    Ensure-OnnxRuntimeCpuBuild -PipExe $PipExe -LogPrefix $LogPrefix

    $installed = 0
    $failed = 0
    $rows = @(Get-PycorePolicyPackageRows -PythonExe $PythonExe -Set 'installer')
    foreach ($row in $rows) {
        if (Install-PycoreDependencyMapPackage -ImportName $row.ImportName -PipSpec $row.PipSpec -PipExe $PipExe -PythonExe $PythonExe -LogPrefix $LogPrefix) {
            $installed++
        } else {
            $failed++
        }
    }
    Write-Host "$LogPrefix Package policy summary: $installed ok, $failed missing/skipped" -ForegroundColor Cyan
    if ($failed -gt 0) {
        throw "$failed central pycore package(s) failed policy validation."
    }
    Install-PycorePrepareAlignedPackages -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
}
