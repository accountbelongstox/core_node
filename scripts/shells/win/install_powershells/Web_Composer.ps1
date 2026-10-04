$COMPONENT_ID = 'Web_Composer'
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
Write-FrankenPhpLog -Message "${COMPONENT_ID}: ensuring Composer for the FrankenPHP PHP runtime."
if (Test-Path -LiteralPath $phpPath -PathType Leaf) {
    Install-ComposerForPhp -PhpPath $phpPath -InstallDir $frankenPhpRoot -LogPrefix "[$COMPONENT_ID]" | Out-Null
}
if (Test-Path -LiteralPath $composerPath -PathType Leaf) {
    Write-FrankenPhpLog -Message "$COMPONENT_ID complete: $composerPath" -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "$COMPONENT_ID postcondition failed." -Type 'Error'
}
