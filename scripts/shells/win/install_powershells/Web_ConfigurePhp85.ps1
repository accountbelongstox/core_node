$COMPONENT_ID = 'Web_ConfigurePhp85'
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
. $managerPath

Write-FrankenPhpLog -Message "${COMPONENT_ID}: converging the embedded PHP 8.5 configuration."
Ensure-FrankenPhpPhpConfiguration | Out-Null
if (Test-Path -LiteralPath (Get-FrankenPhpPhpIniPath) -PathType Leaf) {
    Write-FrankenPhpLog -Message "$COMPONENT_ID complete." -Type 'Success'
}
else {
    Write-FrankenPhpLog -Message "$COMPONENT_ID postcondition failed." -Type 'Error'
}
