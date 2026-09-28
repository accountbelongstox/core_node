$STEP_NUMBER = 93
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
. $managerPath

Write-FrankenPhpLog -Message "Step ${STEP_NUMBER}: ensuring the official native Windows runtime."
Ensure-FrankenPhpNativeInstall | Out-Null
if (Test-FrankenPhpNativePayload) {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER postcondition failed." -Type 'Error'
}
