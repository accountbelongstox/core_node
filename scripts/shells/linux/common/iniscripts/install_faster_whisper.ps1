<#
.SYNOPSIS
    Thin delegator for the faster-whisper prerequisite (DEFAULT STT engine for the
    pycore "Video Extraction" feature). Discovered & run by prepare.ps1 (which
    pyservice.ps1 invokes), it forwards directly to the single source of truth:

        scripts\shells\win\install_powershells\Step17_InstallFasterWhisper.ps1

    That same Step script is registered in InstallerScriptsList.ps1 right after
    Step9_InstallPython, so dd.cmd -> Run DevInstaller installs faster-whisper
    immediately after Python. Keeping the logic in one place guarantees the
    installer flow and the pyservice prerequisite flow stay identical.

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Model
    If set (and not 'auto'), also pre-download this whisper model.

.PARAMETER Force
    Reinstall even if it already imports, and bypass the capacity guard.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [string]$Model  = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable Declarations (all at top)
# Repo root = iniscripts -> common -> linux -> shells -> scripts -> <repo root> (five parents up).
$repoRoot   = Split-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) -Parent
$stepScript = Join-Path $repoRoot 'scripts\shells\win\install_powershells\Step17_InstallFasterWhisper.ps1'
$stepArgs   = @{}

if (-not (Test-Path $stepScript)) {
    Write-Host ("[X] faster-whisper Step script not found: {0}" -f $stepScript) -ForegroundColor Red
    exit 1
}

# Forward parameters by name (hashtable splat binds by parameter name).
if ($Python) { $stepArgs['Python'] = $Python }
if ($Model)  { $stepArgs['Model']  = $Model }
if ($Force)  { $stepArgs['Force']  = $true }

Write-Host ("[i] Delegating faster-whisper install to: {0}" -f $stepScript) -ForegroundColor DarkGray
& $stepScript @stepArgs
exit $LASTEXITCODE
