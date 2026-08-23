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

$STEP_NUMBER = 94
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$postInstallDirectory = Join-Path $installDirectory 'postinstall'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
$phpProcessorPath = Join-Path $postInstallDirectory 'PhpPostInstallProcessor.ps1'
$phpPath = $null
$composerPath = $null
$frankenPhpRoot = $null
. $managerPath
. $phpProcessorPath

$phpPath = Get-FrankenPhpPhpPath
$composerPath = Get-FrankenPhpComposerPath
$frankenPhpRoot = Split-Path -Parent $phpPath
$env:PHP_INI_SCAN_DIR = Split-Path -Parent (Get-FrankenPhpPhpIniPath)
Write-FrankenPhpLog -Message "Step $STEP_NUMBER: ensuring Composer for the FrankenPHP PHP runtime."
if (Test-Path -LiteralPath $phpPath -PathType Leaf) {
    Install-ComposerForPhp -PhpPath $phpPath -InstallDir $frankenPhpRoot -LogPrefix "[Step $STEP_NUMBER]" | Out-Null
}
if (Test-Path -LiteralPath $composerPath -PathType Leaf) {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete: $composerPath" -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER postcondition failed." -Type 'Error'
}
