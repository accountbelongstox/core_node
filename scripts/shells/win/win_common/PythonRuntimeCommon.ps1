# Shared Python runtime discovery and PATH helpers for Windows installer scripts.
# Uses absolute paths from GlobalVars and binary-on-disk checks (not exit codes).

if (-not (Get-Command Normalize-WindowsPath -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot 'WindowsPathFunction.ps1')
}

$script:PrereqPythonMinors = @(13)

function Get-OptionalGlobalValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $item = Get-Item -Path "Variable:Global:$Name" -ErrorAction SilentlyContinue
    if ($null -eq $item) {
        return $null
    }

    return $item.Value
}

function Get-PythonSitePackagesDir {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe
    )

    return Join-Path (Split-Path -Parent $PythonExe) 'Lib\site-packages'
}

function Test-PythonDistInfoPresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string[]]$DistPrefixes
    )

    $site = Get-PythonSitePackagesDir -PythonExe $PythonExe
    if (-not (Test-Path -LiteralPath $site)) {
        return $false
    }

    foreach ($prefix in $DistPrefixes) {
        $norm = ($prefix -replace '[-\.]', '_').ToLower()
        $hits = Get-ChildItem -LiteralPath $site -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "${norm}*.dist-info" -or $_.Name -like "${prefix}*.dist-info" }
        if (-not $hits) {
            return $false
        }
    }

    return $true
}

function Test-PaddleDistInfoPresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe
    )

    return (Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes @('paddlepaddle')) -or
        (Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes @('paddlepaddle_gpu'))
}

function Test-PipPackageInstalled {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )

    if (-not (Test-Path -LiteralPath $PipExe)) {
        return $false
    }

    # Prefer Scripts\python.exe (venv); else parent\python.exe (system Python layout).
    $scriptsDir = Split-Path -Parent $PipExe
    $siblingPy = Join-Path $scriptsDir 'python.exe'
    $parentPy = Join-Path (Split-Path -Parent $scriptsDir) 'python.exe'
    $pythonExe = $null
    if (Test-Path -LiteralPath $siblingPy) { $pythonExe = $siblingPy }
    elseif (Test-Path -LiteralPath $parentPy) { $pythonExe = $parentPy }
    if ($pythonExe) {
        if (Test-PythonDistInfoPresent -PythonExe $pythonExe -DistPrefixes @($PackageName)) {
            return $true
        }
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $show = & $PipExe show $PackageName 2>&1
    } finally {
        $ErrorActionPreference = $prevEap
    }
    return ("$show" -match '(?m)^Name:\s')
}

function Get-PipPackageVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )

    if (-not (Test-Path -LiteralPath $PipExe)) {
        return ''
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $show = & $PipExe show $PackageName 2>&1
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ("$show" -match '(?m)^Version:\s*(\S+)') {
        return $Matches[1]
    }

    return ''
}

function Resolve-NvidiaSmiExe {
    $candidates = @()
    $nvidiaSmiPath = Get-OptionalGlobalValue -Name 'NVidiaSmiPath'
    if ($nvidiaSmiPath) { $candidates += $nvidiaSmiPath }
    $candidates += (Join-Path $env:SystemRoot 'System32\nvidia-smi.exe')
    $cmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates += $cmd.Source }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    return $null
}

function Test-NvidiaGpuPresent {
    if ($env:TORCH_FORCE_CUDA -eq '1' -or $env:PADDLE_FORCE_CUDA -eq '1' -or $env:SOG_FORCE_GPU -eq '1') {
        return $true
    }

    $nvidiaSmi = Resolve-NvidiaSmiExe
    if (-not $nvidiaSmi) {
        return $false
    }

    $output = & $nvidiaSmi -L 2>&1
    return ("$output" -match '(?m)^GPU\s+\d+:')
}

function Get-PythonVersionTextFromExe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [string[]]$ExtraArgs = @()
    )

    if (-not (Test-Path -LiteralPath $PythonExe)) {
        return $null
    }

    try {
        $versionLines = & $PythonExe @($ExtraArgs + @('--version')) 2>&1
        return ("$versionLines").Trim()
    } catch {
        return $null
    }
}

function Test-PythonExeVersionMatches {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [int[]]$AllowedMinors = $script:PrereqPythonMinors,
        [string[]]$ExtraArgs = @()
    )

    $versionText = Get-PythonVersionTextFromExe -PythonExe $PythonExe -ExtraArgs $ExtraArgs
    if (-not $versionText) {
        return $false
    }

    foreach ($minor in $AllowedMinors) {
        if ($versionText -match "Python\s+3\.$minor(\.|$|\s)") {
            return $true
        }
    }
    return $false
}

function Get-CoreNodePythonDirCandidates {
    $dirs = New-Object System.Collections.Generic.List[string]

    if ($Global:PYTHON_DIR) {
        $dirs.Add($Global:PYTHON_DIR)
    }
    if ($Global:PYTHON_EXE_PATH) {
        $dirs.Add((Split-Path -Parent $Global:PYTHON_EXE_PATH))
    }
    if ($Global:LANG_COMPILER_DIR -and $Global:PYTHON_VERSION_COMPACT) {
        $dirs.Add((Join-Path $Global:LANG_COMPILER_DIR ("python$($Global:PYTHON_VERSION_COMPACT)")))
    }
    if ($Global:LANG_COMPILER_DIR -and (Test-Path -LiteralPath $Global:LANG_COMPILER_DIR)) {
        Get-ChildItem -Path $Global:LANG_COMPILER_DIR -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^python\d+$' } |
            ForEach-Object { $dirs.Add($_.FullName) }
    }

    return @($dirs | Select-Object -Unique)
}

function Resolve-PrereqPythonExe {
    param(
        [string]$PreferredPath
    )

    if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath) -and
        (Test-PythonExeVersionMatches -PythonExe $PreferredPath)) {
        return (Resolve-Path -LiteralPath $PreferredPath).Path
    }

    foreach ($dir in (Get-CoreNodePythonDirCandidates)) {
        $candidateExe = Join-Path $dir 'python.exe'
        if ((Test-Path -LiteralPath $candidateExe) -and
            (Test-PythonExeVersionMatches -PythonExe $candidateExe)) {
            return (Resolve-Path -LiteralPath $candidateExe).Path
        }
    }

    $pyLauncher = Join-Path $env:SystemRoot 'py.exe'
    if (Test-Path -LiteralPath $pyLauncher) {
        foreach ($ver in @('-3.13')) {
            if (Test-PythonExeVersionMatches -PythonExe $pyLauncher -ExtraArgs @($ver)) {
                return $pyLauncher
            }
        }
    }

    return $null
}

function Resolve-PrereqPythonCmd {
    param(
        [string]$PreferredPath
    )
    return Resolve-PrereqPythonExe -PreferredPath $PreferredPath
}

function Get-PythonRunArgs {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonCmd
    )

    if ($PythonCmd -match '\\py\.exe$' -or ($PythonCmd -eq 'py')) {
        foreach ($ver in @('-3.13')) {
            if (Test-PythonExeVersionMatches -PythonExe $PythonCmd -ExtraArgs @($ver)) {
                return @($PythonCmd, $ver)
            }
        }
        return @($PythonCmd, '-3.13')
    }

    return @($PythonCmd)
}

function Get-PipExeForPythonExe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe
    )

    if ($Global:PIP_EXE_PATH -and (Test-Path -LiteralPath $Global:PIP_EXE_PATH)) {
        $globalPythonDir = if ($Global:PYTHON_EXE_PATH) { Split-Path -Parent $Global:PYTHON_EXE_PATH } else { $null }
        $targetPythonDir = Split-Path -Parent $PythonExe
        if (-not $globalPythonDir -or ((Normalize-WindowsPath $globalPythonDir) -eq (Normalize-WindowsPath $targetPythonDir))) {
            return $Global:PIP_EXE_PATH
        }
    }

    $scriptsDir = Join-Path (Split-Path -Parent $PythonExe) 'Scripts'
    $pipExe = Join-Path $scriptsDir 'pip.exe'
    if (Test-Path -LiteralPath $pipExe) {
        return $pipExe
    }

    return $null
}

function Test-PythonPipBinaryReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [string[]]$PyRun
    )

    $pipExe = $Global:PIP_EXE_PATH
    return [bool]$pipExe
}

function Set-EnvironmentPathValue {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Machine', 'User')]
        [string]$Scope,
        [Parameter(Mandatory = $true)]
        [string]$NewPath
    )

    $currentPath = [Environment]::GetEnvironmentVariable('Path', $Scope)
    if ($currentPath -eq $NewPath) {
        return
    }

    if ($Scope -eq 'Machine') {
        Backup-Environment
        Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' -Name 'Path' -Value $NewPath -ErrorAction Stop
    } else {
        [Environment]::SetEnvironmentVariable('Path', $NewPath, $Scope)
    }
}

function Set-CoreNodePythonPathPriority {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonDir,
        [Parameter(Mandatory = $true)]
        [string]$ScriptsDir,
        [string]$LogPrefix = ''
    )

    $normPythonDir = Normalize-WindowsPath $PythonDir
    $normScriptsDir = Normalize-WindowsPath $ScriptsDir

    foreach ($scope in @('Machine', 'User')) {
        $currentPath = [Environment]::GetEnvironmentVariable('Path', $scope)
        if (-not $currentPath) {
            continue
        }

        $keptEntries = New-Object System.Collections.Generic.List[string]
        foreach ($segment in ($currentPath -split ';')) {
            if ([string]::IsNullOrWhiteSpace($segment)) {
                continue
            }

            $normalizedSegment = Normalize-WindowsPath $segment
            if (-not $normalizedSegment) {
                continue
            }

            if ($normalizedSegment -eq $normPythonDir -or $normalizedSegment -eq $normScriptsDir) {
                continue
            }

            if ($segment -match 'python\d+' -or $segment -match '\\Python\d+' -or $segment -match '\\Python\\') {
                if ($LogPrefix) {
                    Write-Host "$LogPrefix Removing stale Python PATH entry from $scope (install kept on disk): $segment" -ForegroundColor Yellow
                }
                continue
            }

            if (-not ($keptEntries -contains $normalizedSegment)) {
                $keptEntries.Add($normalizedSegment)
            }
        }

        $orderedEntries = @($normPythonDir, $normScriptsDir) + @($keptEntries)
        $newPath = ($orderedEntries | Where-Object { $_ }) -join ';'
        Set-EnvironmentPathValue -Scope $scope -NewPath $newPath
    }

    try {
        $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $combinedPath = if ($userPath) { "$userPath;$machinePath" } else { $machinePath }
        [Environment]::SetEnvironmentVariable('Path', $combinedPath, 'Process')
    } catch {
        if ($LogPrefix) {
            Write-Host "$LogPrefix Warning: failed to refresh process PATH: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

function Ensure-CoreNodePythonPath {
    param(
        [string]$LogPrefix = ''
    )

    $pythonDir = $Global:PYTHON_DIR
    $scriptsDir = if ($Global:PYTHON_SCRIPTS_DIR) { $Global:PYTHON_SCRIPTS_DIR } else { Join-Path $pythonDir 'Scripts' }

    if (-not $pythonDir -or -not $scriptsDir) {
        return
    }

    if ($LogPrefix) {
        Write-Host "$LogPrefix Ensuring Python $($Global:PYTHON_VERSION) PATH priority (older installs kept on disk)..." -ForegroundColor Cyan
    }

    Set-CoreNodePythonPathPriority -PythonDir $pythonDir -ScriptsDir $scriptsDir -LogPrefix $LogPrefix
}

function Get-CoreNodePythonToolPaths {
    $scriptsDir = if ($Global:PYTHON_SCRIPTS_DIR) {
        $Global:PYTHON_SCRIPTS_DIR
    } elseif ($Global:PYTHON_DIR) {
        Join-Path $Global:PYTHON_DIR 'Scripts'
    } else {
        $null
    }

    return [ordered]@{
        PythonDir  = $Global:PYTHON_DIR
        ScriptsDir = $scriptsDir
        PythonExe  = $Global:PYTHON_EXE_PATH
        PipExe     = if ($Global:PIP_EXE_PATH) { $Global:PIP_EXE_PATH } elseif ($scriptsDir) { Join-Path $scriptsDir 'pip.exe' } else { $null }
        UvExe      = if ($Global:UV_EXE_PATH) { $Global:UV_EXE_PATH } elseif ($scriptsDir) { Join-Path $scriptsDir 'uv.exe' } else { $null }
        PipxExe    = if ($Global:PIPX_EXE_PATH) { $Global:PIPX_EXE_PATH } elseif ($scriptsDir) { Join-Path $scriptsDir 'pipx.exe' } else { $null }
        PoetryExe  = if ($Global:POETRY_EXE_PATH) { $Global:POETRY_EXE_PATH } elseif ($scriptsDir) { Join-Path $scriptsDir 'poetry.exe' } else { $null }
    }
}

function Resolve-InstallerPythonExe {
    param(
        [string]$PreferredPath = ''
    )

    if (-not $PreferredPath) {
        $PreferredPath = $Global:PYTHON_EXE_PATH
    }

    if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
        $versionText = Get-PythonVersionTextFromExe -PythonExe $PreferredPath
        if ($versionText -match 'Python\s+3\.') {
            return (Resolve-Path -LiteralPath $PreferredPath).Path
        }
    }

    $resolved = Resolve-PrereqPythonExe -PreferredPath $PreferredPath
    if ($resolved -and $resolved -match '\\py\.exe$') {
        if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
            return (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path
        }
    }

    return $resolved
}

function Resolve-InstallerPipExe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe
    )

    $pipExe = Get-PipExeForPythonExe -PythonExe $PythonExe
    if ($pipExe -and (Test-Path -LiteralPath $pipExe)) {
        return (Resolve-Path -LiteralPath $pipExe).Path
    }

    return $null
}

function Test-PycorePythonModulePresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    if (-not (Test-Path -LiteralPath $PythonExe)) {
        return $false
    }

    $modLiteral = ($ModuleName -replace "'", "''")
    $pyCode = @"
import importlib.util
try:
    ok = importlib.util.find_spec('$modLiteral') is not None
except Exception:
    ok = False
print('__FOUND__' if ok else '__MISSING__')
"@
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $PythonExe -c $pyCode 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    return ($out -match '__FOUND__')
}
