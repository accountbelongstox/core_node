# NAT gateway monitor (NSSM service ncore-natgateway): reconciles ICS with router.conf and the
# live adapters every NatGwPollSeconds, so a re-plugged USB uplink is shared again.
# Windows counterpart of scripts/shells/linux/debian/debian_com/natgateway_monitor.sh.
param(
    [Parameter(Mandatory = $true)][string]$ConfigFile
)

$MONITOR_ENGINE_SCRIPT = Join-Path $PSScriptRoot 'NatGatewayCommon.ps1'
$MONITOR_ERROR = ''

. $MONITOR_ENGINE_SCRIPT

Initialize-NatGateway -ConfigFile $ConfigFile
Write-NatGwLog "Monitor started (config: $ConfigFile)"
while ($true) {
    try {
        Invoke-NatGwReconcile
        $MONITOR_ERROR = ''
    } catch {
        if ($_.Exception.Message -ne $MONITOR_ERROR) { Write-NatGwLog "Reconcile error: $($_.Exception.Message)" }
        $MONITOR_ERROR = $_.Exception.Message
    }
    Start-Sleep -Seconds $script:NatGwPollSeconds
}
