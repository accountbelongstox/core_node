<#
.SYNOPSIS
    gitsync -- quick command (D20): cd repo root, ensure origin is GitHub
    SSH, then add/commit/pull/push main.

.DESCRIPTION
    All behavior lives in scripts/shells/win/win_common/GitSyncCommon.ps1;
    this is a thin wrapper so `gitsync` is available in the same style as
    the other scripts/winenvs/ commands (no .cmd shim: no other winenvs
    command has one).

.PARAMETER DryRun
    Print every git command gitsync would run and execute none.

.EXAMPLE
    scripts\winenvs\gitsync.ps1

.EXAMPLE
    scripts\winenvs\gitsync.ps1 -DryRun
#>
param(
    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$script:GitsyncScriptDir = $PSScriptRoot
$script:GitsyncScriptsDir = Split-Path -Path $script:GitsyncScriptDir -Parent
$script:GitsyncShellsDir = Join-Path -Path $script:GitsyncScriptsDir -ChildPath "shells"
$script:GitsyncWinDir = Join-Path -Path $script:GitsyncShellsDir -ChildPath "win"
$script:GitsyncWinCommonDir = Join-Path -Path $script:GitsyncWinDir -ChildPath "win_common"
$script:GitsyncCommonPath = Join-Path -Path $script:GitsyncWinCommonDir -ChildPath "GitSyncCommon.ps1"

if (-not (Test-Path -LiteralPath $script:GitsyncCommonPath)) {
    Write-Host "[gitsync] ERROR: shared function not found: $script:GitsyncCommonPath"
    return
}

. $script:GitsyncCommonPath

$script:GitsyncRepoRoot = Get-GitSyncRepoRoot
$null = Invoke-GitSyncRun -RepoRoot $script:GitsyncRepoRoot -DryRun ([bool]$DryRun)
