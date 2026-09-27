$STEP_NUMBER = 96
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
. $managerPath

Write-FrankenPhpLog -Message "Step ${STEP_NUMBER}: converging the embedded PHP 8.5 configuration."
Ensure-FrankenPhpPhpConfiguration | Out-Null
if (Test-Path -LiteralPath (Get-FrankenPhpPhpIniPath) -PathType Leaf) {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER postcondition failed." -Type 'Error'
}
