<#
.SYNOPSIS
    Scan poly_apps projects, assign ports, persist discovery payload, and hand off to the Python TUI helper.

.NOTES
    All textual keys are centralized inside $KeyCenter to honor the "key center" requirement.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$KeyCenter = [ordered]@{
    RepoRoot         = 'repo_root'
    PolyRoot         = 'poly_root'
    PolyAppsFolder   = 'poly_apps'
    ProjectCount     = 'project_count'
    BuildModeIndex   = 'build_mode_index'
    PlatformIndex    = 'platform_index'
    BuildModeLabel   = 'build_mode_label'
    PlatformLabel    = 'platform_label'
    Projects         = 'projects'
    ProjectName      = 'project_name'
    ProjectPath      = 'project_path'
    ProjectPort      = 'project_port'
    ProjectType      = 'project_type'
    DisplayLine      = 'display_line'
    BasePort         = 'base_port'
    Timestamp        = 'generated_at'
    CommandWindows   = 'command_windows'
    CommandUnix      = 'command_unix'
    EnvVarCount      = 'env_var_count'
    EnvVarName       = 'env_var_name'
    EnvVarValue      = 'env_var_value'
    Files            = @{
        State     = 'poly_apps_state.txt'
        MenuCache = 'poly_apps_menu_cache.txt'
        Selection = 'poly_apps_selection.txt'
    }
    HelperScriptName = 'poly_apps_helper.py'
    CacheFolderName  = 'cache'
}

function Get-KeyValue {
    param(
        [Parameter(Mandatory)]
        [string]$KeyName
    )
    return $KeyCenter.$KeyName
}

function New-KeyValueLine {
    param(
        [Parameter(Mandatory)]
        [string]$Key,
        [Parameter(Mandatory)]
        [AllowNull()]
        [AllowEmptyString()]
        [object]$Value
    )

    $valueString = ''
    if ($null -ne $Value) {
        $valueString = [string]$Value
    }
    return ("{0}`t{1}" -f $Key, $valueString)
}

$scriptFolder = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-PolyAppsPath {
    param(
        [Parameter(Mandatory)]
        [string]$StartDir
    )

    $current = $StartDir
    while ($true) {
        $candidate = Join-Path -Path $current -ChildPath $KeyCenter.PolyAppsFolder
        if (Test-Path -Path $candidate -PathType Container) {
            return $candidate
        }

        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrEmpty($parent) -or ($parent -eq $current)) {
            break
        }
        $current = $parent
    }

    throw "Unable to resolve the poly_apps directory relative to $StartDir"
}

$polyAppsRoot = Resolve-PolyAppsPath -StartDir $scriptFolder
$repoRoot = Split-Path -Parent $polyAppsRoot

if (-not (Test-Path -Path $polyAppsRoot -PathType Container)) {
    throw "Unable to locate $(Get-KeyValue -KeyName 'PolyRoot') directory at $polyAppsRoot"
}

$projectDirectories = Get-ChildItem -Path $polyAppsRoot -Directory | Sort-Object -Property Name

if ($projectDirectories.Count -eq 0) {
    Write-Warning "No project directories were found under $polyAppsRoot. Nothing to do."
    return
}

$nextPort = 10000
$projectPayload = @()

foreach ($dir in $projectDirectories) {
    $projectPayload += [ordered]@{
        ($KeyCenter.ProjectName) = [string]$dir.Name
        ($KeyCenter.ProjectPath) = [string]$dir.FullName
        ($KeyCenter.ProjectPort) = $nextPort
        ($KeyCenter.ProjectType) = $null
    }
    $nextPort++
}

$cacheRoot = Join-Path $scriptFolder 'build_py_tools'
if (-not (Test-Path -Path $cacheRoot -PathType Container)) {
    New-Item -Path $cacheRoot -ItemType Directory | Out-Null
}

$stateFilePath = Join-Path $cacheRoot $KeyCenter.Files.State
$stateLines = @()
$stateLines += New-KeyValueLine -Key $KeyCenter.RepoRoot -Value ([string]$repoRoot)
$stateLines += New-KeyValueLine -Key $KeyCenter.PolyRoot -Value ([string]$polyAppsRoot)
$stateLines += New-KeyValueLine -Key $KeyCenter.BasePort -Value 10000
$stateLines += New-KeyValueLine -Key $KeyCenter.Timestamp -Value ((Get-Date).ToString('s'))
$stateLines += New-KeyValueLine -Key $KeyCenter.ProjectCount -Value ($projectPayload.Count)

for ($idx = 0; $idx -lt $projectPayload.Count; $idx++) {
    $project = $projectPayload[$idx]
    $stateLines += New-KeyValueLine -Key ("{0}_{1}" -f $KeyCenter.ProjectName, $idx) -Value $project[$KeyCenter.ProjectName]
    $stateLines += New-KeyValueLine -Key ("{0}_{1}" -f $KeyCenter.ProjectPath, $idx) -Value $project[$KeyCenter.ProjectPath]
    $stateLines += New-KeyValueLine -Key ("{0}_{1}" -f $KeyCenter.ProjectPort, $idx) -Value $project[$KeyCenter.ProjectPort]
    $stateLines += New-KeyValueLine -Key ("{0}_{1}" -f $KeyCenter.ProjectType, $idx) -Value $project[$KeyCenter.ProjectType]
}

Set-Content -Path $stateFilePath -Value $stateLines -Encoding UTF8

$helperScript = Join-Path $cacheRoot $KeyCenter.HelperScriptName
if (-not (Test-Path -Path $helperScript -PathType Leaf)) {
    throw "Python helper $($KeyCenter.HelperScriptName) was not found at $helperScript"
}

$pythonExecutable = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExecutable = 'python'
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExecutable = 'py'
} else {
    throw "Unable to find a Python executable on PATH."
}

Write-Host "State cached to $stateFilePath. Launching Python helper..."

$selectionFile = Join-Path $cacheRoot $KeyCenter.Files.Selection
if (Test-Path $selectionFile -PathType Leaf) {
    Remove-Item $selectionFile -Force
}

& $pythonExecutable $helperScript

if (-not (Test-Path $selectionFile -PathType Leaf)) {
    Write-Warning "Helper finished without creating $selectionFile. See helper output for details."
    return
}

$selectionData = Get-Content -Path $selectionFile -Encoding UTF8
$selectionMap = @{}
foreach ($line in $selectionData) {
    if ($line -match '^\s*$') {
        continue
    }
    $segments = $line -split "`t", 2
    if ($segments.Count -eq 2) {
        $selectionMap[$segments[0]] = $segments[1]
    }
}

if (-not $selectionMap.ContainsKey($KeyCenter.ProjectPath)) {
    Write-Warning "Selection file missing project path."
    return
}

$selectedPath = $selectionMap[$KeyCenter.ProjectPath]
if (-not (Test-Path $selectedPath -PathType Container)) {
    Write-Warning "Selected project path $selectedPath is invalid."
    return
}

Write-Host "Selection stored at $selectionFile"
Write-Host "Switching directory to $selectedPath"
Set-Location -Path $selectedPath

if ($selectionMap.ContainsKey($KeyCenter.DisplayLine)) {
    Write-Host "Selected -> $($selectionMap[$KeyCenter.DisplayLine])"
}

$projectType = ''
if ($selectionMap.ContainsKey($KeyCenter.ProjectType)) {
    $projectType = $selectionMap[$KeyCenter.ProjectType]
    Write-Host "Project type: $projectType"
}

$projectPort = 0
if ($selectionMap.ContainsKey($KeyCenter.ProjectPort)) {
    [void][int]::TryParse($selectionMap[$KeyCenter.ProjectPort], [ref]$projectPort)
    Write-Host "Port assignment: $projectPort"
}

if ($selectionMap.ContainsKey($KeyCenter.BuildModeLabel)) {
    Write-Host "Build mode: $($selectionMap[$KeyCenter.BuildModeLabel])"
}
if ($selectionMap.ContainsKey($KeyCenter.PlatformLabel)) {
    Write-Host "Platform: $($selectionMap[$KeyCenter.PlatformLabel])"
}

$envVarCount = 0
if ($selectionMap.ContainsKey($KeyCenter.EnvVarCount)) {
    [void][int]::TryParse($selectionMap[$KeyCenter.EnvVarCount], [ref]$envVarCount)
}

for ($envIndex = 0; $envIndex -lt $envVarCount; $envIndex++) {
    $envNameKey = "{0}_{1}" -f $KeyCenter.EnvVarName, $envIndex
    $envValueKey = "{0}_{1}" -f $KeyCenter.EnvVarValue, $envIndex
    if ($selectionMap.ContainsKey($envNameKey)) {
        $name = $selectionMap[$envNameKey]
        $value = ''
        if ($selectionMap.ContainsKey($envValueKey)) {
            $value = $selectionMap[$envValueKey]
        }
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            Write-Host "Setting $name=$value"
            Set-Item -Path ("Env:{0}" -f $name) -Value $value
        }
    }
}

$commandToRun = ''
if ($selectionMap.ContainsKey($KeyCenter.CommandWindows)) {
    $commandToRun = $selectionMap[$KeyCenter.CommandWindows]
}

if (-not [string]::IsNullOrWhiteSpace($commandToRun)) {
    Write-Host "Executing command: $commandToRun"
    Invoke-Expression $commandToRun
} else {
    Write-Warning "Selection did not provide a command to run."
}
