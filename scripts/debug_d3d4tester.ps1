param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug',
    [switch]$BuildOnly,
    [switch]$NoWatch
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StartScript = Join-Path (Join-Path (Join-Path (Join-Path $RepoRoot "dotapps") "d3d4tester") "scripts") "start.ps1"

& $StartScript -Configuration $Configuration -BuildOnly:$BuildOnly -NoWatch:$NoWatch
exit $LASTEXITCODE
