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

$STEP_NUMBER = 96
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
. $managerPath

Write-FrankenPhpLog -Message "Step $STEP_NUMBER: converging the embedded PHP 8.5 configuration."
Ensure-FrankenPhpPhpConfiguration | Out-Null
if (Test-Path -LiteralPath (Get-FrankenPhpPhpIniPath) -PathType Leaf) {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER postcondition failed." -Type 'Error'
}
