<#
.SYNOPSIS
    Unified Chrome crash repair: AW Manager / Quark PUP removal + compat shim fix.

.DESCRIPTION
    Single entry point for Chrome STATUS_STACK_BUFFER_OVERRUN (0xC0000409) repair.
    Delegates to fix-chrome-compat-shim.ps1, which idempotently removes the PUP
    root cause and repairs stale compatibility shims on chrome.exe.

.PARAMETER DryRun
    Report what would be changed without making any changes.

.PARAMETER Quiet
    Suppress normal output (only warnings/errors are shown).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\repair-chrome-crash.ps1
    powershell -ExecutionPolicy Bypass -File .\repair-chrome-crash.ps1 -DryRun
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Quiet
)

$script:PS_CURRENT_DIR = $PSScriptRoot
$script:SCRIPTS_DIR = Split-Path $script:PS_CURRENT_DIR -Parent
$script:SHELLS_DIR = Join-Path $script:SCRIPTS_DIR 'shells'
$script:WIN_DIR = Join-Path $script:SHELLS_DIR 'win'
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR 'win_common'
$script:SHARED_CACHE_ENV_PATH = Join-Path $script:WIN_COMMON_DIR 'SharedCacheEnv.ps1'
. $script:SHARED_CACHE_ENV_PATH
$script:CHROME_REPAIR_SCRIPT = Join-Path $script:PS_CURRENT_DIR "fix-chrome-compat-shim.ps1"
$script:CHROME_REPAIR_FALLBACK = Join-Path (Join-Path $Global:CORE_NODE_DATA_DIR 'scripts\chromefix') 'fix-chrome-compat-shim.ps1'

$repairScript = $script:CHROME_REPAIR_SCRIPT
if (-not (Test-Path $repairScript)) {
    $repairScript = $script:CHROME_REPAIR_FALLBACK
}

if (-not (Test-Path $repairScript)) {
    Write-Error "Chrome repair script not found: $repairScript"
    exit 1
}

$repairArgs = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $repairScript
)
if ($DryRun) {
    $repairArgs += '-DryRun'
}
if ($Quiet) {
    $repairArgs += '-Quiet'
}

& powershell @repairArgs
