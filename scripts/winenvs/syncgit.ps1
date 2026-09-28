<#
.SYNOPSIS
    syncgit -- quick command (D20): cd repo root, ensure origin is GitHub
    SSH, then add/commit/pull/push main.

.DESCRIPTION
    All behavior lives in scripts/shells/win/win_common/GitSyncCommon.ps1;
    this is a thin wrapper so `syncgit` is available in the same style as
    the other scripts/winenvs/ commands (no .cmd shim: no other winenvs
    command has one).

.PARAMETER DryRun
    Print every git command syncgit would run and execute none.

.EXAMPLE
    scripts\winenvs\syncgit.ps1

.EXAMPLE
    scripts\winenvs\syncgit.ps1 -DryRun
#>
param(
    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$script:SyncgitScriptDir = $PSScriptRoot
$script:SyncgitScriptsDir = Split-Path -Path $script:SyncgitScriptDir -Parent
$script:SyncgitShellsDir = Join-Path -Path $script:SyncgitScriptsDir -ChildPath "shells"
$script:SyncgitWinDir = Join-Path -Path $script:SyncgitShellsDir -ChildPath "win"
$script:SyncgitWinCommonDir = Join-Path -Path $script:SyncgitWinDir -ChildPath "win_common"
$script:SyncgitCommonPath = Join-Path -Path $script:SyncgitWinCommonDir -ChildPath "GitSyncCommon.ps1"

if (-not (Test-Path -LiteralPath $script:SyncgitCommonPath)) {
    Write-Host "[syncgit] ERROR: shared function not found: $script:SyncgitCommonPath"
    return
}

. $script:SyncgitCommonPath

$script:SyncgitRepoRoot = Get-GitSyncRepoRoot
$null = Invoke-GitSyncRun -RepoRoot $script:SyncgitRepoRoot -DryRun ([bool]$DryRun)
