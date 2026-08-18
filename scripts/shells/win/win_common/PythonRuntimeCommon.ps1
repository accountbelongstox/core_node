# Shared Python runtime discovery and PATH helpers for Windows installer scripts.
# Uses absolute paths from GlobalVars and binary-on-disk checks (not exit codes).
#
# Install-PinnedTransformers is retained as the shared entry point for existing callers;
# it now preserves any installed compatible distribution and delegates constraints to pip.

$windowsPathFunctionPath = Join-Path $PSScriptRoot 'WindowsPathFunction.ps1'
$windowsPathFunctionLoaded = Get-Variable -Name 'PycoreWindowsPathFunctionLoaded' -Scope Script -ErrorAction SilentlyContinue
$script:PrereqPythonMinors = @(13)
$script:PipInstalledPackageCache = @{}
if ($null -eq $windowsPathFunctionLoaded -or -not [bool]$windowsPathFunctionLoaded.Value) {
    . $windowsPathFunctionPath
    Set-Variable -Name 'PycoreWindowsPathFunctionLoaded' -Scope Script -Value $true
}

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

    $entry = $null
    $entryName = ''
    $normalizedPrefix = ''
    $prefix = ''
    $present = $false
    $site = Get-PythonSitePackagesDir -PythonExe $PythonExe
    if (-not (Test-Path -LiteralPath $site)) {
        return $false
    }

    foreach ($prefix in $DistPrefixes) {
        $normalizedPrefix = $prefix.Replace('-', '_').Replace('.', '_').ToLowerInvariant()
        $present = $false
        foreach ($entry in (Get-ChildItem -LiteralPath $site -Directory -Filter '*.dist-info' -ErrorAction SilentlyContinue)) {
            $entryName = $entry.Name.ToLowerInvariant()
            if ($entryName.StartsWith("$normalizedPrefix-", [System.StringComparison]::Ordinal)) {
                $present = $true
                break
            }
        }
        if (-not $present) {
            return $false
        }
    }

    return $true
}

function Test-PaddlePackageInstalled {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe
    )

    $pipExe = Get-PipExeForPythonExe -PythonExe $PythonExe
    if (-not $pipExe) {
        return $false
    }
    return (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'paddlepaddle') -or
        (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'paddlepaddle-gpu')
}

function Test-PipPackageInstalled {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )

    $nameLine = $null
    $prevEap = $ErrorActionPreference
    $show = @()
    if (-not (Test-Path -LiteralPath $PipExe)) {
        return $false
    }

    $ErrorActionPreference = 'Continue'
    try {
        $show = & $PipExe show $PackageName 2>&1
    } finally {
        $ErrorActionPreference = $prevEap
    }
    $nameLine = @($show) | Where-Object { ([string]$_).Trim().StartsWith('Name:', [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
    return $null -ne $nameLine
}

function Get-PipPackageNameFromSpec {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipSpec
    )

    $name = ([string]$PipSpec).Trim()
    $separatorIndex = $name.IndexOfAny([char[]]'[<>=!~; ')
    if ($separatorIndex -ge 0) {
        $name = $name.Substring(0, $separatorIndex)
    }
    return $name.Trim()
}

function ConvertTo-PipPackageKey {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )

    return $PackageName.Trim().Replace('_', '-').Replace('.', '-').ToLowerInvariant()
}

function Get-PipInstalledPackageSet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [switch]$Refresh
    )

    $cacheKey = $PipExe.ToLowerInvariant()
    $installed = @{}
    $item = $null
    $items = @()
    $jsonText = ''
    $name = ''
    if (-not (Test-Path -LiteralPath $PipExe)) {
        return $installed
    }
    if (-not $Refresh -and $script:PipInstalledPackageCache.ContainsKey($cacheKey)) {
        return $script:PipInstalledPackageCache[$cacheKey]
    }

    $jsonText = (& $PipExe list --format=json --disable-pip-version-check 2>$null) -join [Environment]::NewLine
    if (-not $jsonText.Trim().StartsWith('[', [System.StringComparison]::Ordinal)) {
        throw "pip metadata snapshot is unavailable from $PipExe"
    }
    $items = $jsonText | ConvertFrom-Json
    foreach ($item in $items) {
        $name = ConvertTo-PipPackageKey -PackageName ([string]$item.name)
        if ($name) {
            $installed[$name] = $true
        }
    }
    $script:PipInstalledPackageCache[$cacheKey] = $installed
    return $installed
}

function Test-PipPackageInSet {
    param(
        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$InstalledPackages,
        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )

    $key = ConvertTo-PipPackageKey -PackageName $PackageName
    return [bool]$InstalledPackages[$key]
}

function Test-PythonRequirementSatisfied {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipSpec
    )
    $packageName = ''
    $pipExe = $null
    $packageName = Get-PipPackageNameFromSpec -PipSpec $PipSpec
    $pipExe = Get-PipExeForPythonExe -PythonExe $PythonExe
    if (-not $pipExe -or -not $packageName) { return $false }
    return Test-PipPackageInstalled -PipExe $pipExe -PackageName $packageName
}

function Install-PinnedTransformers {
    <#
    .SYNOPSIS
        Idempotent transformers install for the shared Bucket-A LLM stack.
    .DESCRIPTION
        Implements the Bucket-A rule in
        development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7:
        DeepSeek-VL/DeepSeek-OCR/Qwen2.5/NLLB-200/Bark share the system interpreter.
        Existing distributions are preserved; missing packages are delegated to pip.
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$Spec = '',
        [string]$Prefix = ''
    )

    $effectiveSpec = $Spec
    $packageName = 'transformers'

    if (-not $effectiveSpec) {
        $effectiveSpec = $Global:LLM_TRANSFORMERS_SPEC
    }
    if (-not $effectiveSpec) {
        $effectiveSpec = Get-AiRuntimePolicyValue -Name 'AI_SHARED_TRANSFORMERS_SPEC' -Default 'transformers'
    }

    if (-not (Test-Path -LiteralPath $PipExe)) {
        Write-Host ("{0}[shared-transformers] pip not found at {1}; cannot install {2}." -f $Prefix, $PipExe, $effectiveSpec) -ForegroundColor DarkYellow
        return $false
    }

    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $packageName) {
        Write-Host ("{0}[shared-transformers] {1} is installed -> skip (idempotent)." -f $Prefix, $packageName) -ForegroundColor Green
        return $true
    }

    Write-Host ("{0}[shared-transformers] {1} is missing -> installing {2}." -f $Prefix, $packageName, $effectiveSpec) -ForegroundColor Yellow
    & $PipExe install $effectiveSpec | Out-Host

    return Test-PipPackageInstalled -PipExe $PipExe -PackageName $packageName
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
    $lineText = ''
    $nvidiaSmi = $null
    $output = @()
    if ($env:TORCH_FORCE_CUDA -eq '1' -or $env:PADDLE_FORCE_CUDA -eq '1' -or $env:SOG_FORCE_GPU -eq '1') {
        return $true
    }

    $nvidiaSmi = Resolve-NvidiaSmiExe
    if (-not $nvidiaSmi) {
        return $false
    }

    $output = & $nvidiaSmi -L 2>&1
    foreach ($line in @($output)) {
        $lineText = ([string]$line).Trim()
        if ($lineText.StartsWith('GPU ', [System.StringComparison]::OrdinalIgnoreCase) -and $lineText.Contains(':')) {
            return $true
        }
    }
    return $false
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

    $previousPreference = $ErrorActionPreference
    $major = 0
    $minor = 0
    $versionText = ''
    $versionParts = @()
    $versionLines = @()
    $ErrorActionPreference = 'Continue'
    $versionLines = & $PythonExe @($ExtraArgs + @('--version')) 2>&1
    $ErrorActionPreference = $previousPreference
    $versionText = ("$versionLines").Trim()
    if (-not $versionText.StartsWith('Python ', [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
    $versionParts = $versionText.Substring(7).Split('.')
    if ($versionParts.Length -lt 2 -or
        -not [int]::TryParse($versionParts[0], [ref]$major) -or
        -not [int]::TryParse($versionParts[1], [ref]$minor)) { return $null }
    return $versionText
}

function Test-PythonExeVersionMatches {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [int[]]$AllowedMinors = $script:PrereqPythonMinors,
        [string[]]$ExtraArgs = @()
    )

    $major = 0
    $minor = 0
    $versionText = ''
    $versionParts = @()
    $versionText = Get-PythonVersionTextFromExe -PythonExe $PythonExe -ExtraArgs $ExtraArgs
    if (-not $versionText) {
        return $false
    }

    $versionParts = $versionText.Substring(7).Split('.')
    if ($versionParts.Length -lt 2 -or
        -not [int]::TryParse($versionParts[0], [ref]$major) -or
        -not [int]::TryParse($versionParts[1], [ref]$minor)) { return $false }
    return $major -eq 3 -and $AllowedMinors -contains $minor
}

function Get-CoreNodePythonDirCandidates {
    $dirs = @()
    $entry = $null
    $entries = @()
    $numericSuffix = 0
    $suffix = ''

    if ($Global:PYTHON_DIR) {
        $dirs += $Global:PYTHON_DIR
    }
    if ($Global:PYTHON_EXE_PATH) {
        $dirs += (Split-Path -Parent $Global:PYTHON_EXE_PATH)
    }
    if ($Global:LANG_COMPILER_DIR -and $Global:PYTHON_VERSION_COMPACT) {
        $dirs += (Join-Path $Global:LANG_COMPILER_DIR ("python$($Global:PYTHON_VERSION_COMPACT)"))
    }
    if ($Global:LANG_COMPILER_DIR -and (Test-Path -LiteralPath $Global:LANG_COMPILER_DIR)) {
        $entries = @(Get-ChildItem -Path $Global:LANG_COMPILER_DIR -Directory -ErrorAction SilentlyContinue)
        foreach ($entry in $entries) {
            $suffix = $entry.Name.Substring([Math]::Min(6, $entry.Name.Length))
            $numericSuffix = 0
            if ($entry.Name.StartsWith('python', [System.StringComparison]::OrdinalIgnoreCase) -and
                $suffix -and [int]::TryParse($suffix, [ref]$numericSuffix)) {
                $dirs += $entry.FullName
            }
        }
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

    if ((Split-Path -Leaf $PythonCmd) -eq 'py.exe' -or ($PythonCmd -eq 'py')) {
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

        $keptEntries = @()
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

            if ($segment.ToLowerInvariant().Contains('python')) {
                if ($LogPrefix) {
                    Write-Host "$LogPrefix Removing stale Python PATH entry from $scope (install kept on disk): $segment" -ForegroundColor Yellow
                }
                continue
            }

            if (-not ($keptEntries -contains $normalizedSegment)) {
                $keptEntries += $normalizedSegment
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
        if ($versionText.StartsWith('Python 3.', [System.StringComparison]::OrdinalIgnoreCase)) {
            return (Resolve-Path -LiteralPath $PreferredPath).Path
        }
    }

    $resolved = Resolve-PrereqPythonExe -PreferredPath $PreferredPath
    if ($resolved -and (Split-Path -Leaf $resolved) -eq 'py.exe') {
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
