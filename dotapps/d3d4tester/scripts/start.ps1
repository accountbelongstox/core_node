param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug',
    [switch]$BuildOnly,
    [switch]$NoWatch,
    [switch]$WithOptional
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LOG_PREFIX = '[d3d4tester]'
$TARGETING_PROP = '-p:EnableWindowsTargeting=true'
$PREREQS_FILE_NAME = 'prereqs.json'
$CONFIG_RELATIVE_SEGMENTS = @('.core_node', '.d3check', 'd3check_config.json')
$CONFIG_KEYS_ROS = @('ros_settings', 'ros_directory')
$CONFIG_KEYS_BATTLENET = @('battlenet', 'battlenet_path')
$CONFIG_KEYS_D3 = @('d3', 'd3_path')
$DOTNET_INSTALLER_ID = 'dotnet-sdk-8'
$VCREDIST_INSTALLER_ID = 'vcredist-x64'
$BROWSER_INSTALLER_ID = 'browser'
$ULTRALYTICS_INSTALLER_ID = 'python-ultralytics'
$VCREDIST_DLLS = @('vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll')
$BROWSER_RELATIVE_PATHS = @('Google\Chrome\Application\chrome.exe', 'Microsoft\Edge\Application\msedge.exe', 'Mozilla Firefox\firefox.exe')
$DOTNET_EXE_NAME = 'dotnet.exe'
$DOTNET_SDK_FILTER = '8.*'
$ARTIFACTS_SUBDIR = 'dotnet-artifacts'
$ARTIFACTS_NAME = 'd3d4tester'

$scriptDir = Split-Path -Parent $PSCommandPath
$appDir = Split-Path -Parent $scriptDir
$dotappsDir = Split-Path -Parent $appDir
$repoRoot = Split-Path -Parent $dotappsDir
$winCommonDir = Join-Path (Join-Path (Join-Path (Join-Path $repoRoot 'scripts') 'shells') 'win') 'win_common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$commonFuncPath = Join-Path $winCommonDir 'CommonFunc.ps1'
$pythonRuntimePath = Join-Path $winCommonDir 'PythonRuntimeCommon.ps1'
$prereqsPath = Join-Path $scriptDir $PREREQS_FILE_NAME
$prereqs = $null
$prereqItem = $null
$prereqMissing = $false
$installerPath = $null
$installedInRun = @{}
$manualMissing = @()
$csprojPath = Join-Path $appDir 'd3d4tester.csproj'
$artifactsRoot = $null
$sdkVersion = $null
$artifactsPath = $null
$dotnetCommand = $null
$dotnetPath = $null
$dotnetRoot = $null
$sdkDir = $null
$sdkFound = $false
$machinePath = $null
$userPath = $null
$exitCode = 0

function Write-StartLog {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "$LOG_PREFIX $Message" -ForegroundColor Cyan
}

function Get-DotnetPath {
    $command = Get-Command -Name 'dotnet' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) {
        return [string]$command.Source
    }
    $fallback = Join-Path (Join-Path $env:ProgramFiles 'dotnet') $DOTNET_EXE_NAME
    if (Test-Path -LiteralPath $fallback -PathType Leaf) {
        return $fallback
    }
    return $null
}

function Get-DotnetSdk8Version {
    param([string]$ExePath)
    if ([string]::IsNullOrEmpty($ExePath)) {
        return $null
    }
    $root = Split-Path -Parent $ExePath
    $sdks = Join-Path $root 'sdk'
    if (-not (Test-Path -LiteralPath $sdks -PathType Container)) {
        return $null
    }
    $found = Get-ChildItem -LiteralPath $sdks -Directory -Filter $DOTNET_SDK_FILTER -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $found) {
        return $null
    }
    return $found.Name
}

function Invoke-Dotnet {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & $dotnetPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments[0]) failed with exit code $LASTEXITCODE"
    }
}

function Update-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machinePath, $userPath) -join ';'
}

function Test-VcRedistPresent {
    $system32 = Join-Path $env:SystemRoot 'System32'
    foreach ($dll in $VCREDIST_DLLS) {
        if (-not (Test-Path -LiteralPath (Join-Path $system32 $dll) -PathType Leaf)) {
            return $false
        }
    }
    return $true
}

function Get-ProgramRoots {
    $roots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)
    return @($roots | Where-Object { -not [string]::IsNullOrEmpty($_) })
}

function Test-BrowserPresent {
    foreach ($root in (Get-ProgramRoots)) {
        foreach ($rel in $BROWSER_RELATIVE_PATHS) {
            if (Test-Path -LiteralPath (Join-Path $root $rel) -PathType Leaf) {
                return $true
            }
        }
    }
    return $false
}

function Test-PythonPipsPresent {
    param([Parameter(Mandatory = $true)]$Item)
    $pythonExe = $Global:PYTHON_EXE_PATH
    $pipExe = $null
    $pipName = $null
    if ([string]::IsNullOrEmpty($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
        return $false
    }
    $pipExe = Get-PipExeForPythonExe -PythonExe $pythonExe
    foreach ($pipName in @($Item.windows.pip)) {
        if (-not (Test-PipPackageInstalled -PipExe $pipExe -PackageName $pipName)) {
            return $false
        }
    }
    return $true
}

function Test-PrereqPresent {
    param([Parameter(Mandatory = $true)][string]$Id)
    $item = @($prereqs.prereqs | Where-Object { $_.id -eq $Id })[0]
    switch ($Id) {
        $DOTNET_INSTALLER_ID { return ($null -ne (Get-DotnetSdk8Version -ExePath (Get-DotnetPath))) }
        $VCREDIST_INSTALLER_ID { return (Test-VcRedistPresent) }
        $BROWSER_INSTALLER_ID { return (Test-BrowserPresent) }
        $ULTRALYTICS_INSTALLER_ID { return (Test-PythonPipsPresent -Item $item) }
        default { return $true }
    }
}

function Install-Prereq {
    param([Parameter(Mandatory = $true)]$Item)
    $installer = Join-Path $repoRoot ([string]$Item.windows.installer)
    $pipName = $null
    if (-not $installedInRun.ContainsKey($installer)) {
        $installedInRun[$installer] = $true
        & $installer
    }
    if ($null -ne $Item.windows.PSObject.Properties['pip'] -and -not (Test-PythonPipsPresent -Item $Item)) {
        foreach ($pipName in @($Item.windows.pip)) {
            Invoke-PipCommand -PackageName $pipName | Out-Null
        }
    }
    Update-ProcessPath
}

function Get-ConfigValue {
    param($Config, [string[]]$KeyPath)
    $node = $Config
    foreach ($key in $KeyPath) {
        if ($null -eq $node -or $null -eq $node.PSObject.Properties[$key]) {
            return $null
        }
        $node = $node.$key
    }
    if ($node -is [string] -and -not [string]::IsNullOrWhiteSpace($node)) {
        return $node
    }
    return $null
}

function Get-UserConfig {
    $configPath = [Environment]::GetFolderPath('UserProfile')
    foreach ($segment in $CONFIG_RELATIVE_SEGMENTS) {
        $configPath = Join-Path $configPath $segment
    }
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        return $null
    }
    try {
        return (Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

function Test-ConfigDetected {
    param([Parameter(Mandatory = $true)][string]$Id, $Config)
    $value = $null
    switch ($Id) {
        'battlenet' { $value = Get-ConfigValue -Config $Config -KeyPath $CONFIG_KEYS_BATTLENET }
        'diablo3' { $value = Get-ConfigValue -Config $Config -KeyPath $CONFIG_KEYS_D3 }
        'rosbot' {
            $value = Get-ConfigValue -Config $Config -KeyPath $CONFIG_KEYS_ROS
            if ($null -ne $value -and (Test-Path -LiteralPath $value -PathType Container)) {
                return ($null -ne (Get-ChildItem -LiteralPath $value -Filter '*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1))
            }
            return $false
        }
    }
    return ($null -ne $value -and (Test-Path -LiteralPath $value -PathType Leaf))
}

function Test-ManualDetected {
    param([Parameter(Mandatory = $true)]$Entry, $Config)
    $roots = @()
    $rel = $null
    $root = $null
    if ($Entry.platform -eq 'windows10') {
        if (-not $Global:isWin10) {
            return $true
        }
        $roots = @($env:windir)
    }
    else {
        if (Test-ConfigDetected -Id $Entry.id -Config $Config) {
            return $true
        }
        $roots = @(Get-ProgramRoots)
    }
    foreach ($rel in @($Entry.detect)) {
        foreach ($root in $roots) {
            if ([string]::IsNullOrEmpty($root)) {
                continue
            }
            if ((Test-Path -LiteralPath (Join-Path $root $rel) -PathType Leaf) -or (Test-Path -LiteralPath (Join-Path $root (Split-Path -Leaf $rel)) -PathType Leaf)) {
                return $true
            }
        }
    }
    return $false
}

function Show-ManualPrereqs {
    param([object[]]$Manual)
    $entry = $null
    $step = $null
    $stepIndex = 0
    $config = Get-UserConfig
    foreach ($entry in $Manual) {
        if ($entry.platform -ne 'windows' -and $entry.platform -ne 'windows10') {
            continue
        }
        if ((@($entry.detect).Count -gt 0 -or $entry.id -eq 'rosbot') -and (Test-ManualDetected -Entry $entry -Config $config)) {
            Write-StartLog "Manual prerequisite present: $($entry.id)"
            continue
        }
        Write-Host "$LOG_PREFIX Manual install required: $($entry.id)" -ForegroundColor Yellow
        $stepIndex = 0
        foreach ($step in @($entry.steps)) {
            $stepIndex++
            Write-Host "$LOG_PREFIX   $stepIndex. $step" -ForegroundColor Yellow
        }
    }
}

if (-not (Test-Path -LiteralPath $csprojPath -PathType Leaf)) {
    throw "$LOG_PREFIX project not found: $csprojPath"
}

. $globalVarsPath
. $commonFuncPath
. $pythonRuntimePath
. (Join-Path $winCommonDir 'PackageManagerInvokes.ps1')

Write-StartLog 'Step 1/4: ensure prerequisites'
$prereqs = Get-Content -LiteralPath $prereqsPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($prereqItem in @($prereqs.prereqs)) {
    if ($null -eq $prereqItem.PSObject.Properties['windows']) {
        continue
    }
    $prereqMissing = -not (Test-PrereqPresent -Id $prereqItem.id)
    if (-not $prereqMissing) {
        Write-StartLog "Prerequisite present: $($prereqItem.id)"
        continue
    }
    if (-not $prereqItem.required -and -not $WithOptional) {
        Write-StartLog "Optional prerequisite missing: $($prereqItem.id) ($($prereqItem.purpose)); rerun with -WithOptional to install it"
        continue
    }
    Write-StartLog "Installing prerequisite: $($prereqItem.id) ($($prereqItem.purpose))"
    try {
        Install-Prereq -Item $prereqItem
    }
    catch {
        Write-Host "$LOG_PREFIX Prerequisite install failed for $($prereqItem.id): $($_.Exception.Message)" -ForegroundColor Yellow
    }
    if (Test-PrereqPresent -Id $prereqItem.id) {
        Write-StartLog "Prerequisite ready: $($prereqItem.id)"
    }
    else {
        Write-Host "$LOG_PREFIX Prerequisite still missing after install attempt: $($prereqItem.id)" -ForegroundColor Yellow
    }
}

Show-ManualPrereqs -Manual @($prereqs.manual)

Update-ProcessPath
$dotnetPath = Get-DotnetPath
$sdkVersion = Get-DotnetSdk8Version -ExePath $dotnetPath
if ($null -eq $sdkVersion) {
    throw "$LOG_PREFIX .NET 8 SDK is not available after the prerequisite step"
}
Write-StartLog ".NET 8 SDK present: $sdkVersion"

$artifactsRoot = Join-Path $Global:CN_CACHE_ROOT $ARTIFACTS_SUBDIR
$artifactsPath = Join-Path $artifactsRoot $ARTIFACTS_NAME
New-CnNamespaceDirectory -Path $artifactsPath
Write-StartLog "Artifacts: $artifactsPath"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'

try {
    Set-Location -LiteralPath $appDir

    Write-StartLog 'Step 2/4: restore'
    Invoke-Dotnet -Arguments @('restore', $csprojPath, $TARGETING_PROP, '--artifacts-path', $artifactsPath)

    Write-StartLog "Step 3/4: build ($Configuration)"
    Invoke-Dotnet -Arguments @('build', $csprojPath, $TARGETING_PROP, '-c', $Configuration, '--no-restore', '--artifacts-path', $artifactsPath)

    if ($BuildOnly) {
        Write-StartLog 'Step 4/4: run skipped (build-only)'
    }
    elseif ($NoWatch) {
        Write-StartLog 'Step 4/4: run (dotnet run)'
        Invoke-Dotnet -Arguments @('run', '--project', $csprojPath, $TARGETING_PROP, '-c', $Configuration, '--no-build', '--artifacts-path', $artifactsPath)
    }
    else {
        Write-StartLog 'Step 4/4: run with hot reload (dotnet watch)'
        $env:ArtifactsPath = $artifactsPath
        Invoke-Dotnet -Arguments @('watch', 'run', '--project', $csprojPath, $TARGETING_PROP, '-c', $Configuration)
    }
}
catch {
    Write-Host "$LOG_PREFIX $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}

exit $exitCode
