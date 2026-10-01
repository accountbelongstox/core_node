param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug',
    [switch]$BuildOnly,
    [switch]$NoWatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LOG_PREFIX = '[d3d4tester]'
$DOTNET_WINGET_ID = 'Microsoft.DotNet.SDK.8'
$DOTNET_EXE_NAME = 'dotnet.exe'
$DOTNET_SDK_FILTER = '8.*'
$ARTIFACTS_SUBDIR = 'dotnet-artifacts'
$APP_NAME = 'd3d4tester'

$scriptDir = Split-Path -Parent $PSCommandPath
$appDir = Split-Path -Parent $scriptDir
$dotappsDir = Split-Path -Parent $appDir
$repoRoot = Split-Path -Parent $dotappsDir
$winCommonDir = Join-Path (Join-Path (Join-Path (Join-Path $repoRoot 'scripts') 'shells') 'win') 'win_common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$commonFuncPath = Join-Path $winCommonDir 'CommonFunc.ps1'
$csprojPath = Join-Path $appDir 'd3d4tester.csproj'
$artifactsRoot = $null
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

function Test-DotnetSdk8 {
    param([string]$ExePath)
    if ([string]::IsNullOrEmpty($ExePath)) {
        return $false
    }
    $root = Split-Path -Parent $ExePath
    $sdks = Join-Path $root 'sdk'
    if (-not (Test-Path -LiteralPath $sdks -PathType Container)) {
        return $false
    }
    return $null -ne (Get-ChildItem -LiteralPath $sdks -Directory -Filter $DOTNET_SDK_FILTER -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Invoke-Dotnet {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & $dotnetPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments[0]) failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $csprojPath -PathType Leaf)) {
    throw "$LOG_PREFIX project not found: $csprojPath"
}

. $globalVarsPath
. $commonFuncPath

Write-StartLog 'Ensuring .NET 8 SDK'
$dotnetPath = Get-DotnetPath
if (-not (Test-DotnetSdk8 -ExePath $dotnetPath)) {
    Invoke-WingetCommand -Id $DOTNET_WINGET_ID -Keyword $DOTNET_EXE_NAME -ForceToInstallDir $false -IncludeSystemPaths $true | Out-Null
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machinePath, $userPath) -join ';'
    $dotnetPath = Get-DotnetPath
    if (-not (Test-DotnetSdk8 -ExePath $dotnetPath)) {
        throw "$LOG_PREFIX .NET 8 SDK is not available after install attempt"
    }
}

$artifactsRoot = Join-Path $Global:CN_CACHE_ROOT $ARTIFACTS_SUBDIR
$artifactsPath = Join-Path $artifactsRoot $APP_NAME
New-CnNamespaceDirectory -Path $artifactsPath
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'

try {
    Set-Location -LiteralPath $appDir

    Write-StartLog 'Restoring'
    Invoke-Dotnet -Arguments @('restore', $csprojPath, '--artifacts-path', $artifactsPath)

    Write-StartLog "Building ($Configuration)"
    Invoke-Dotnet -Arguments @('build', $csprojPath, '-c', $Configuration, '--no-restore', '--artifacts-path', $artifactsPath)

    if ($BuildOnly) {
        Write-StartLog 'Build finished'
    }
    elseif ($NoWatch) {
        Write-StartLog 'Running'
        Invoke-Dotnet -Arguments @('run', '--project', $csprojPath, '-c', $Configuration, '--no-build', '--artifacts-path', $artifactsPath)
    }
    else {
        Write-StartLog 'Running with hot reload'
        $env:ArtifactsPath = $artifactsPath
        Invoke-Dotnet -Arguments @('watch', 'run', '--project', $csprojPath, '-c', $Configuration)
    }
}
catch {
    Write-Host "$LOG_PREFIX $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}

exit $exitCode
