<#
.SYNOPSIS
    Thin delegator for the offline-TTS prerequisite (Sherpa-ONNX + model;
    MeloTTS opt-in) used as fallbacks by the pycore voice-subtitle pipeline.

.DESCRIPTION
    Discovered & run by prepare.ps1 (pyservice). Forwards to the single source of
    truth, which is also registered in the dd.cmd DevInstaller flow:

        scripts\shells\win\install_powershells\Step13_InstallTtsOffline.ps1

    Installs sherpa-onnx + a Kokoro (zh/en) model by default. MeloTTS is opt-in
    (-Melotts) because it pins transformers==4.27.4. GPT-SoVITS is not installed
    (the pycore client calls its api server on 127.0.0.1:9880 if present).

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.
.PARAMETER Melotts
    Also install MeloTTS (opt-in; may downgrade the shared env's transformers).
.PARAMETER Force
    Reinstall / re-download even if present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Melotts,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable Declarations (all at top)
$repoRoot   = Split-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) -Parent
$stepScript = Join-Path $repoRoot 'scripts\shells\win\install_powershells\Step13_InstallTtsOffline.ps1'
$stepArgs   = @{}

if (-not (Test-Path $stepScript)) {
    Write-Host ("[X] offline-TTS Step script not found: {0}" -f $stepScript) -ForegroundColor Red
    exit 1
}

if ($Python)  { $stepArgs['Python']  = $Python }
if ($Melotts) { $stepArgs['Melotts'] = $true }
if ($Force)   { $stepArgs['Force']   = $true }

Write-Host ("[i] Delegating offline-TTS install to: {0}" -f $stepScript) -ForegroundColor DarkGray
& $stepScript @stepArgs
exit $LASTEXITCODE
