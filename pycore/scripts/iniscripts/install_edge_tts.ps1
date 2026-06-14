<#
.SYNOPSIS
    Thin delegator for the edge-tts prerequisite (DEFAULT text-to-speech engine
    for the pycore voice-subtitle pipeline). Discovered & run by prepare.ps1
    (which pyservice.ps1 invokes), it forwards directly to the single source of
    truth:

        scripts\shells\win\install_powershells\Step19_InstallEdgeTts.ps1

    That same Step script is registered in InstallerScriptsList.ps1 right after
    Step17_InstallFasterWhisper, so dd.cmd -> Run DevInstaller installs edge-tts
    in the main install flow too. Keeping the logic in one place guarantees the
    installer flow and the pyservice prerequisite flow stay identical.

    The Step script installs the LATEST edge-tts (>= 7.2.4; the old 7.2.1 pin is
    now harmful — old versions 403 on a stale handshake). A persistent 403 at
    synth time is rate-limit / region blocking, not a version issue — set
    EDGE_TTS_PROXY.

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Force
    Reinstall even if a compatible version is already present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable Declarations (all at top)
# Repo root = iniscripts -> scripts -> pycore -> <repo root> (three parents up).
$repoRoot   = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$stepScript = Join-Path $repoRoot 'scripts\shells\win\install_powershells\Step19_InstallEdgeTts.ps1'
$stepArgs   = @{}

if (-not (Test-Path $stepScript)) {
    Write-Host ("[X] edge-tts Step script not found: {0}" -f $stepScript) -ForegroundColor Red
    exit 1
}

# Forward parameters by name (hashtable splat binds by parameter name).
if ($Python) { $stepArgs['Python'] = $Python }
if ($Force)  { $stepArgs['Force']  = $true }

Write-Host ("[i] Delegating edge-tts install to: {0}" -f $stepScript) -ForegroundColor DarkGray
& $stepScript @stepArgs
exit $LASTEXITCODE
