# One-click remote-control host pre-install: Tailscale + VNC shared desktop (default, TightVNC service)
# + OpenSSH Server with the shared key. RDP is not touched, so a Linux viewer never locks the local
# screen: the local and the remote user operate the same console at the same time.
# Logic lives in win_common/RemoteControlCommon.ps1 (Install-RemoteControlSharedDesktopHost).
# Idempotent: installed packages, services, firewall rules and an existing VNC password are kept.
[CmdletBinding()]
param(
    [switch]$PauseAtEnd
)

$STEP72_SCRIPT_INDEX = '[Step72-RemoteControlHost]'
$STEP72_SCRIPT_PATH = $PSCommandPath
$STEP72_WIN_COMMON_DIR = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$STEP72_REMOTE_CONTROL_SCRIPT = Join-Path $STEP72_WIN_COMMON_DIR 'RemoteControlCommon.ps1'

. $STEP72_REMOTE_CONTROL_SCRIPT

if (-not $Global:IS_RUN_ADMIN) {
    Write-ColorMessage -Message "$STEP72_SCRIPT_INDEX Administrator rights are required; relaunching elevated..." -Type 'Warning'
    try {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $STEP72_SCRIPT_PATH), '-PauseAtEnd'
        ) | Out-Null
    } catch {
        Write-ColorMessage -Message "$STEP72_SCRIPT_INDEX Elevation declined or failed: $($_.Exception.Message)" -Type 'Error'
    }
    return
}

Install-RemoteControlSharedDesktopHost
if ($PauseAtEnd) { Wait-MenuContinue }
