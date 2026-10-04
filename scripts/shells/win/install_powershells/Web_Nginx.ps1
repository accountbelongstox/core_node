# Official nginx.org Windows build for the nginx web server plane (START_WEB_SERVER=nginx).
# Windows counterpart of Linux 33_install_nginx.sh; the services are converged by Step175_LaravelMainStart.ps1.
$COMPONENT_ID = 'Web_Nginx'
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'

. (Join-Path $commonDirectory 'GlobalVars.ps1')
. (Join-Path $commonDirectory 'CommonFunc.ps1')
. (Join-Path $commonDirectory 'NginxManager.ps1')

if ((Get-WebServerPlane) -ne 'nginx') {
    Write-NginxLog "${COMPONENT_ID}: SKIP, START_WEB_SERVER=$(Get-WebServerPlane); nginx not installed."
    return
}
if ((Install-NginxBinaries) -and (Ensure-NginxConfig)) {
    Write-NginxLog "$COMPONENT_ID complete." 'Success'
}
else {
    Write-NginxLog "$COMPONENT_ID postcondition failed." 'Error'
}
