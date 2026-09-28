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
Write-FrankenPhpLog -Message "Step ${STEP_NUMBER}: ensuring Composer for the FrankenPHP PHP runtime."
if (Test-Path -LiteralPath $phpPath -PathType Leaf) {
    Install-ComposerForPhp -PhpPath $phpPath -InstallDir $frankenPhpRoot -LogPrefix "[Step $STEP_NUMBER]" | Out-Null
}
if (Test-Path -LiteralPath $composerPath -PathType Leaf) {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete: $composerPath" -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER postcondition failed." -Type 'Error'
}
