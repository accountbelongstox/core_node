# Virtual audio cable (VB-CABLE) for Claude voice dictation (docs_fix/DESIGN_CLAUDE_VOICE_DICTATION.md):
# pycore plays a voice message into "CABLE Input" and Claude Code records it from "CABLE Output".
# Official driver pack: https://vb-audio.com/Cable/ (version and SHA-256 pinned in
# config/service_contract.json versions.vbcable / versions.vbcable_sha256). pycore only checks
# for the devices; it never installs the driver.
# Idempotent: the installed driver file present -> nothing to do.
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Region = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX    = '[Step74-VirtualAudioCable]'
$VBCABLE_VERSION = ''
$VBCABLE_SHA256  = ''
$ARCHIVE_NAME    = ''
$DOWNLOAD_BASE   = 'https://download.vb-audio.com/Download_CABLE'
$SETUP_NAME      = 'VBCABLE_Setup_x64.exe'
$SETUP_ARGUMENTS = @('-i', '-h')
$DRIVER_FILES    = @('vbaudio_cable64_win10.sys', 'vbaudio_cable64arm_win10.sys')
$winCommonDir    = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$driversDir      = Join-Path (Join-Path $env:SystemRoot 'System32') 'drivers'
$workDir         = Join-Path ([System.IO.Path]::GetTempPath()) 'core_node_vbcable'
$archivePath     = ''
$extractDir      = Join-Path $workDir 'extract'
$setupPath       = ''
$actualSha       = ''
$curl            = $null
$setupProcess    = $null

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'ServiceContract.ps1')

$VBCABLE_VERSION = [string](Get-ServiceContractValue -ContractPath 'versions.vbcable')
$VBCABLE_SHA256 = [string](Get-ServiceContractValue -ContractPath 'versions.vbcable_sha256')
$ARCHIVE_NAME = "VBCABLE_Driver_Pack$VBCABLE_VERSION.zip"
$archivePath = Join-Path $workDir $ARCHIVE_NAME
$setupPath = Join-Path $extractDir $SETUP_NAME

function Test-VirtualAudioCableInstalled {
    foreach ($driverFile in $DRIVER_FILES) {
        if (Test-Path -LiteralPath (Join-Path $driversDir $driverFile) -PathType Leaf) { return $true }
    }
    return $false
}

if ((Test-VirtualAudioCableInstalled) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [idempotent] VB-CABLE driver present in $driversDir" -ForegroundColor Green
    return
}

$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) { throw "$SCRIPT_INDEX curl.exe is required to download the VB-CABLE driver pack." }

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Write-Host "$SCRIPT_INDEX [..] downloading $DOWNLOAD_BASE/$ARCHIVE_NAME -> $archivePath" -ForegroundColor Yellow
& $curl.Source -f -L --retry 3 --connect-timeout 30 -o $archivePath "$DOWNLOAD_BASE/$ARCHIVE_NAME"
if ($LASTEXITCODE -ne 0) { throw "$SCRIPT_INDEX download of $ARCHIVE_NAME failed (curl exit $LASTEXITCODE)." }

$actualSha = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -ne $VBCABLE_SHA256) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "$SCRIPT_INDEX checksum mismatch for $ARCHIVE_NAME (expected $VBCABLE_SHA256, got $actualSha)."
}
Write-Host "$SCRIPT_INDEX [OK] checksum verified: $actualSha" -ForegroundColor Green

if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force

Write-Host "$SCRIPT_INDEX [..] installing driver: $setupPath $($SETUP_ARGUMENTS -join ' ')" -ForegroundColor Yellow
$setupProcess = Start-Process -FilePath $setupPath -ArgumentList $SETUP_ARGUMENTS -Wait -PassThru
Write-Host "$SCRIPT_INDEX setup exit code: $($setupProcess.ExitCode)" -ForegroundColor Cyan

if (-not (Test-VirtualAudioCableInstalled)) {
    throw "$SCRIPT_INDEX VB-CABLE driver not found in $driversDir after setup (exit $($setupProcess.ExitCode))."
}
Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "$SCRIPT_INDEX [OK] VB-CABLE installed (CABLE Input / CABLE Output); a reboot may be needed before the devices appear." -ForegroundColor Green
