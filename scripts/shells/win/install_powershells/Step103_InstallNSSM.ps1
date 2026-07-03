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

# Native Windows NSSM install (idempotent, via winget) through the shared
# NssmServiceManager. NSSM wraps a plain script/command as a Windows service the SCM
# can start/stop -- needed by poly_apps/*/scripts/start.ps1's background-service option.

# Variables (declared at the beginning of the file)
$WinCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
$RepoRootDir  = Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent
$STEP_NUMBER  = 103
$nssmPath     = $null

. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")
. (Join-Path $WinCommonDir "NssmServiceManager.ps1")

Write-ColorMessage "[Step $STEP_NUMBER] NSSM install (idempotent, via winget)" -Type "Info"

$nssmPath = Ensure-Nssm -RepoRootDir $RepoRootDir

if ($nssmPath) {
    Write-ColorMessage "[Step $STEP_NUMBER] NSSM ready: $nssmPath" -Type "Success"
} else {
    Write-ColorMessage "[Step $STEP_NUMBER] NSSM install incomplete - see messages above." -Type "Error"
}
