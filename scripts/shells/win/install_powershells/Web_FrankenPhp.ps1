$COMPONENT_ID = 'Web_FrankenPhp'
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
. $managerPath

Write-FrankenPhpLog -Message "${COMPONENT_ID}: ensuring the official native Windows runtime."
Ensure-FrankenPhpNativeInstall | Out-Null
if (Test-FrankenPhpNativePayload) {
    Write-FrankenPhpLog -Message "$COMPONENT_ID complete." -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "$COMPONENT_ID postcondition failed." -Type 'Error'
}
