# Mesh VPN client for the selected provider (MESH_VPN_PROVIDER: headscale | tailscale | none).
# Windows counterpart of scripts/shells/linux/debian/install_shells/97_install_tailscale.sh; Windows has
# no Headscale server (Linux 98). Logic lives in win_common/TailscaleCommon.ps1 and MeshCommon.ps1.
# Idempotent: winget is skipped when Tailscale is installed, and the converge probes live state first.
[CmdletBinding()]
param(
    [switch]$PauseAtEnd
)

$STEP97_SCRIPT_INDEX = '[Step97-MeshVpn]'
$STEP97_WIN_COMMON_DIR = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$STEP97_TAILSCALE_COMMON_SCRIPT = Join-Path $STEP97_WIN_COMMON_DIR 'TailscaleCommon.ps1'
$STEP97_PROVIDER = ''

. $STEP97_TAILSCALE_COMMON_SCRIPT

$STEP97_PROVIDER = Get-MeshVpnProvider
Write-ColorMessage -Message "$STEP97_SCRIPT_INDEX Mesh VPN provider: $STEP97_PROVIDER" -Type 'Info'
if ((Test-MeshProviderNone) -or (Install-TailscaleWinget)) {
    [void](Invoke-MeshProviderConverge -SkipSite -NoInteractive)
}
if ($PauseAtEnd) { Wait-MenuContinue }
