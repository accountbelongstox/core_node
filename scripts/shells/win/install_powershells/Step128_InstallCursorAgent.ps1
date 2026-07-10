# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# Cursor Agent standalone install: same logic as Cursor PostInstallCallbacks (agent CLI + RipGrep), without installing Cursor app.

$PSScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:POSTINSTALL_DIR = Join-Path $PSScriptRoot "postinstall"
$script:PROCESSOR_SCRIPT = Join-Path $script:POSTINSTALL_DIR "CursorAgentPostInstallProcessor.ps1"

$SCRIPT_INDEX = "[Step 128]"
Write-Host "$SCRIPT_INDEX Cursor Agent standalone (agent CLI + RipGrep, no Cursor app)" -ForegroundColor Cyan

if (-not (Test-Path $script:PROCESSOR_SCRIPT)) {
    Write-Host "$SCRIPT_INDEX Error: Processor not found: $script:PROCESSOR_SCRIPT" -ForegroundColor Red
    return
}

. $script:PROCESSOR_SCRIPT
$dummyPath = $env:USERPROFILE
Invoke-CursorAgentPostInstallProcessor -CursorAgentCallback @{} -PackageName "CursorAgent" -ExecutablePath $dummyPath -InstallDir $dummyPath -LogPrefix $SCRIPT_INDEX
