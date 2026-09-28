<#
.SYNOPSIS
    Compatibility entry point for the canonical faster-whisper installer.
.DESCRIPTION
    Delegates all package, model, idempotency, and CUDA decisions to Step11 so
    video tools cannot create a second CUDA runtime policy.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Gpu,
    [switch]$Master,
    [string]$Model = ''
)

$ErrorActionPreference = 'Stop'
$iniScriptsDir = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$videoToolsDir = Split-Path $iniScriptsDir -Parent
$scriptsDir = Split-Path $videoToolsDir -Parent
$shellsDir = Join-Path $scriptsDir 'shells'
$winDir = Join-Path $shellsDir 'win'
$installPowershellsDir = Join-Path $winDir 'install_powershells'
$canonicalInstaller = Join-Path $installPowershellsDir 'Step11_InstallFasterWhisper.ps1'
$installerArgs = @('-Python', $Python)

if ($Model) {
    $installerArgs += @('-Model', $Model)
}
if ($Master) {
    $installerArgs += '-Force'
    Write-Host '[i] -Master now maps to a forced canonical install; alternate CUDA/package channels are disabled.' -ForegroundColor DarkGray
}
if ($Gpu) {
    Write-Host '[i] -Gpu is policy-controlled; GPU is used only when CTranslate2 matches the canonical CUDA major.' -ForegroundColor DarkGray
}

& $canonicalInstaller @installerArgs
