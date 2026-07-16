# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

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
$script:CHROME_REPAIR_SCRIPT = Join-Path $script:PS_CURRENT_DIR "fix-chrome-compat-shim.ps1"
$script:CHROME_REPAIR_FALLBACK = Join-Path "D:\programing\Users\$env:USERNAME\.core_node\scripts\chromefix" "fix-chrome-compat-shim.ps1"

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
