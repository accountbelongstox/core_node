param(
    [int]$WatchSeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LOG_PREFIX = '[bnprobe]'
$ARTIFACTS_SUBDIR = 'dotnet-artifacts'
$ARTIFACTS_NAME = 'bnprobe'
$OUTPUT_SUBDIR = 'bnprobe'
$PROBE_EXE_NAME = 'bnprobe.exe'
$BUILD_CONFIGURATION = 'debug'

$scriptDir = Split-Path -Parent $PSCommandPath
$appDir = Split-Path -Parent $scriptDir
$dotappsDir = Split-Path -Parent $appDir
$repoRoot = Split-Path -Parent $dotappsDir
$winCommonDir = Join-Path (Join-Path (Join-Path (Join-Path $repoRoot 'scripts') 'shells') 'win') 'win_common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$commonFuncPath = Join-Path $winCommonDir 'CommonFunc.ps1'
$projectPath = Join-Path (Join-Path (Join-Path $appDir 'tools') 'BnProbe') 'BnProbe.csproj'
$artifactsPath = $null
$outputDir = $null
$probeExe = $null
$probeArgs = @()

. $globalVarsPath
. $commonFuncPath

$artifactsPath = Join-Path (Join-Path $Global:CN_CACHE_ROOT $ARTIFACTS_SUBDIR) $ARTIFACTS_NAME
$outputDir = Join-Path $Global:CN_CACHE_ROOT $OUTPUT_SUBDIR
New-CnNamespaceDirectory -Path $artifactsPath
New-CnNamespaceDirectory -Path $outputDir
$probeExe = Join-Path (Join-Path (Join-Path (Join-Path $artifactsPath 'bin') 'BnProbe') $BUILD_CONFIGURATION) $PROBE_EXE_NAME

$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$env:MSBUILDDISABLENODEREUSE = '1'

Write-Host "$LOG_PREFIX ensure probe build (incremental): $projectPath" -ForegroundColor Cyan
& dotnet build $projectPath -c Debug --artifacts-path $artifactsPath -nologo -v q
if ($LASTEXITCODE -ne 0) {
    throw "$LOG_PREFIX build failed with exit code $LASTEXITCODE"
}

$probeArgs = @($outputDir)
if ($WatchSeconds -gt 0) {
    $probeArgs += @('--watch', [string]$WatchSeconds)
}
Write-Host "$LOG_PREFIX scanning Battle.net (passive) -> $outputDir" -ForegroundColor Cyan
& $probeExe @probeArgs
