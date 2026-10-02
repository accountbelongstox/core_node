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
$PREREQS_FILE_NAME = 'prereqs.conf'
$CONFIG_RELATIVE_SEGMENTS = @('.core_node', '.d3check', 'd3check_config.json')
$FIELD_SEPARATOR = '|'
$LIST_SEPARATOR = ';'
$PLATFORM_WINDOWS = 'windows'
$PLATFORM_WINDOWS10 = 'windows10'
$ROSBOT_ID = 'rosbot'
$DOTNET_COMMAND = 'dotnet'
$ARTIFACTS_SUBDIR = 'dotnet-artifacts'
$ARTIFACTS_NAME = 'd3d4tester'
$APP_PROCESS_NAME = 'd3d4tester'
$DOTNET_PROCESS_FILTER = "Name='dotnet.exe'"

$scriptDir = Split-Path -Parent $PSCommandPath
$appDir = Split-Path -Parent $scriptDir
$dotappsDir = Split-Path -Parent $appDir
$repoRoot = Split-Path -Parent $dotappsDir
$winCommonDir = Join-Path (Join-Path (Join-Path (Join-Path $repoRoot 'scripts') 'shells') 'win') 'win_common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$commonFuncPath = Join-Path $winCommonDir 'CommonFunc.ps1'
$prereqsPath = Join-Path $scriptDir $PREREQS_FILE_NAME
$prereqRows = @()
$manualRows = @()
$prereqRow = $null
$prereqId = $null
$installedInRun = @{}
$csprojPath = Join-Path $appDir 'd3d4tester.csproj'
$artifactsRoot = $null
$artifactsPath = $null
$exitCode = 0
$restoreStamp = $null
$restoreStale = $true
$dotcoreDir = $null
$restoreInputs = $null
$previousRun = @()

function Write-StartLog {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "$LOG_PREFIX $Message" -ForegroundColor Cyan
}

function Read-PrereqManifest {
    param([Parameter(Mandatory = $true)][string]$Path)
    $rows = @()
    $line = $null
    foreach ($line in (Get-Content -LiteralPath $Path -Encoding UTF8)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
            continue
        }
        $rows += , @($line.TrimEnd() -split [regex]::Escape($FIELD_SEPARATOR))
    }
    return $rows
}

function Get-RowField {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string[]]$Row, [Parameter(Mandatory = $true)][int]$Index)
    if ($Index -ge $Row.Count) {
        return ''
    }
    return $Row[$Index]
}

function Split-RowList {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) {
        return @()
    }
    return @($Value -split [regex]::Escape($LIST_SEPARATOR))
}

function Invoke-Dotnet {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & $DOTNET_COMMAND @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments[0]) failed with exit code $LASTEXITCODE"
    }
}

function Update-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machinePath, $userPath) -join ';'
}

function Get-ProgramRoots {
    $roots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)
    return @($roots | Where-Object { -not [string]::IsNullOrEmpty($_) })
}

function Get-PreviousRunProcess {
    $ancestors = @{}
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
    while ($null -ne $current -and -not $ancestors.ContainsKey([int]$current.ProcessId)) {
        $ancestors[[int]$current.ProcessId] = $true
        $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($current.ParentProcessId)"
    }
    $dotnetRuns = @(Get-CimInstance Win32_Process -Filter $DOTNET_PROCESS_FILTER |
        Where-Object { -not $ancestors.ContainsKey([int]$_.ProcessId) -and $null -ne $_.CommandLine -and $_.CommandLine.Contains($csprojPath) })
    $appRuns = @(Get-Process -Name $APP_PROCESS_NAME -ErrorAction SilentlyContinue)
    return @($dotnetRuns | ForEach-Object { [int]$_.ProcessId }) + @($appRuns | ForEach-Object { $_.Id })
}

function Stop-PreviousRun {
    $previousRun = @(Get-PreviousRunProcess)
    if ($previousRun.Count -eq 0) {
        return
    }
    Write-StartLog "Stopping previous d3d4tester run (pid $($previousRun -join ', ')) so builds do not share obj/pdb files"
    Stop-Process -Id $previousRun -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $previousRun -Timeout 15 -ErrorAction SilentlyContinue
}

function Invoke-PrereqInstaller {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string[]]$Row)
    $installer = Join-Path $repoRoot (Get-RowField -Row $Row -Index 4)
    $installerArgs = @(Split-RowList -Value (Get-RowField -Row $Row -Index 6))
    $runKey = (@($installer) + $installerArgs) -join $FIELD_SEPARATOR
    if ($installedInRun.ContainsKey($runKey)) {
        return
    }
    $installedInRun[$runKey] = $true
    & $installer @installerArgs
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
    param([Parameter(Mandatory = $true)][string]$Id, [string]$ConfigKey, $Config)
    if ([string]::IsNullOrEmpty($ConfigKey)) {
        return $false
    }
    $value = Get-ConfigValue -Config $Config -KeyPath @($ConfigKey -split '\.')
    if ($null -eq $value) {
        return $false
    }
    if ($Id -eq $ROSBOT_ID) {
        if (-not (Test-Path -LiteralPath $value -PathType Container)) {
            return $false
        }
        return ($null -ne (Get-ChildItem -LiteralPath $value -Filter '*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1))
    }
    return (Test-Path -LiteralPath $value -PathType Leaf)
}

function Test-ManualDetected {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string[]]$Row, $Config)
    $id = Get-RowField -Row $Row -Index 1
    $platform = Get-RowField -Row $Row -Index 2
    $detectPaths = @(Split-RowList -Value (Get-RowField -Row $Row -Index 3))
    $configKey = Get-RowField -Row $Row -Index 4
    $roots = @()
    if ($platform -eq $PLATFORM_WINDOWS10) {
        if (-not $Global:isWin10) {
            return $true
        }
        $roots = @($env:windir)
    }
    else {
        if (Test-ConfigDetected -Id $id -ConfigKey $configKey -Config $Config) {
            return $true
        }
        $roots = @(Get-ProgramRoots)
    }
    foreach ($rel in $detectPaths) {
        foreach ($root in $roots) {
            if ((Test-Path -LiteralPath (Join-Path $root $rel) -PathType Leaf) -or (Test-Path -LiteralPath (Join-Path $root (Split-Path -Leaf $rel)) -PathType Leaf)) {
                return $true
            }
        }
    }
    return $false
}

function Show-ManualPrereqs {
    param([object[]]$Rows)
    $row = $null
    $id = $null
    $platform = $null
    $step = $null
    $stepIndex = 0
    $config = Get-UserConfig
    foreach ($row in $Rows) {
        $id = Get-RowField -Row $row -Index 1
        $platform = Get-RowField -Row $row -Index 2
        if ($platform -ne $PLATFORM_WINDOWS -and $platform -ne $PLATFORM_WINDOWS10) {
            continue
        }
        if (Test-ManualDetected -Row $row -Config $config) {
            Write-StartLog "Manual prerequisite present: $id"
            continue
        }
        Write-Host "$LOG_PREFIX Manual install required: $id" -ForegroundColor Yellow
        $stepIndex = 0
        foreach ($step in (Split-RowList -Value (Get-RowField -Row $row -Index 5))) {
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

Write-StartLog 'Step 1/4: ensure prerequisites'
$prereqRows = @(Read-PrereqManifest -Path $prereqsPath)
$manualRows = @($prereqRows | Where-Object { $_[0] -eq 'manual' })
foreach ($prereqRow in @($prereqRows | Where-Object { $_[0] -eq 'prereq' -and (Get-RowField -Row $_ -Index 3) -eq $PLATFORM_WINDOWS })) {
    $prereqId = Get-RowField -Row $prereqRow -Index 1
    if ((Get-RowField -Row $prereqRow -Index 2) -ne 'true' -and -not $WithOptional) {
        Write-StartLog "Optional prerequisite skipped: $prereqId; rerun with -WithOptional to ensure it"
        continue
    }
    Write-StartLog "Ensuring prerequisite: $prereqId"
    try {
        Invoke-PrereqInstaller -Row $prereqRow
    }
    catch {
        Write-Host "$LOG_PREFIX Prerequisite installer failed for ${prereqId}: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Show-ManualPrereqs -Rows $manualRows
Update-ProcessPath

$artifactsRoot = Join-Path $Global:CN_CACHE_ROOT $ARTIFACTS_SUBDIR
$artifactsPath = Join-Path $artifactsRoot $ARTIFACTS_NAME
New-CnNamespaceDirectory -Path $artifactsPath
Write-StartLog "Artifacts: $artifactsPath"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$env:MSBUILDDISABLENODEREUSE = '1'
$env:DOTNET_WATCH_RESTART_ON_RUDE_EDIT = 'true'
Stop-PreviousRun

$dotcoreDir = Join-Path $repoRoot 'dotcore'
$restoreStamp = Join-Path (Join-Path (Join-Path $artifactsPath 'obj') $ARTIFACTS_NAME) 'project.assets.json'
if (Test-Path -LiteralPath $restoreStamp -PathType Leaf) {
    $restoreInputs = @(Get-ChildItem -LiteralPath $appDir, $dotcoreDir -Recurse -File -Include '*.csproj', 'Directory.*.props', 'nuget.config' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -gt (Get-Item -LiteralPath $restoreStamp).LastWriteTimeUtc })
    $restoreStale = $restoreInputs.Count -gt 0
}

try {
    Set-Location -LiteralPath $appDir

    if ($restoreStale) {
        Write-StartLog 'Step 2/4: restore'
        Invoke-Dotnet -Arguments @('restore', $csprojPath, $TARGETING_PROP, '--artifacts-path', $artifactsPath)
        (Get-Item -LiteralPath $restoreStamp).LastWriteTimeUtc = [DateTime]::UtcNow
    }
    else {
        Write-StartLog 'Step 2/4: restore skipped (up-to-date)'
    }

    if ($BuildOnly -or $NoWatch) {
        Write-StartLog "Step 3/4: build ($Configuration, incremental)"
        Invoke-Dotnet -Arguments @('build', $csprojPath, $TARGETING_PROP, '-c', $Configuration, '--no-restore', '--artifacts-path', $artifactsPath)
    }
    else {
        Write-StartLog 'Step 3/4: build delegated to dotnet watch (single incremental build)'
    }

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
        Invoke-Dotnet -Arguments @('watch', 'run', '--project', $csprojPath, $TARGETING_PROP, '-c', $Configuration, '--no-restore')
    }
}
catch {
    Write-Host "$LOG_PREFIX $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}

exit $exitCode
