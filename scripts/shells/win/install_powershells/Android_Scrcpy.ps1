# scrcpy + adb prerequisite: the official Genymobile release bundle
# (scrcpy.exe, adb.exe, scrcpy-server) installed into the program-drive tool root
# ($env:SCRCPY_HOME = <CN_TOOL_ROOT>\scrcpy, exported by SharedCacheEnv.ps1).
# pycore only checks those three files; it never downloads them.
#
# Official: https://github.com/Genymobile/scrcpy/releases (v3.3.4 asset
# scrcpy-win64-v3.3.4.zip, checksum in the release asset SHA256SUMS.txt).
# Idempotent: the three files present and non-empty -> nothing to do.
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX    = '[Android_Scrcpy]'
$SCRCPY_VERSION  = ''
$RELEASE_BASE    = ''
$ARCHIVE_NAME    = ''
$SUMS_NAME       = 'SHA256SUMS.txt'
$REQUIRED_FILES  = @('scrcpy.exe', 'adb.exe', 'scrcpy-server')
$winCommonDir    = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$scrcpyDir       = $null
$workDir         = $null
$archivePath     = $null
$sumsPath        = $null
$extractDir      = $null
$bundleDir       = $null
$expectedSha     = ''
$curl            = $null
$missing         = @()
$item            = $null
$line            = ''
$fields          = @()

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. (Join-Path $winCommonDir 'ServiceContract.ps1')

$SCRCPY_VERSION = [string](Get-ServiceContractValue -ContractPath 'versions.scrcpy')
$RELEASE_BASE = "https://github.com/Genymobile/scrcpy/releases/download/v$SCRCPY_VERSION"
$ARCHIVE_NAME = "scrcpy-win64-v$SCRCPY_VERSION.zip"

function Get-ScrcpyMissingFiles {
    $result = @()
    $path = ''
    foreach ($required in $REQUIRED_FILES) {
        $path = Join-Path $scrcpyDir $required
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -le 0) { $result += $required }
    }
    return $result
}

$scrcpyDir = $env:SCRCPY_HOME
if (-not $scrcpyDir) { throw "$SCRIPT_INDEX SCRCPY_HOME is not set (SharedCacheEnv.ps1 exports it)." }
Write-ProgramDriveFallbackWarning

$missing = @(Get-ScrcpyMissingFiles)
if ($missing.Count -eq 0 -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [idempotent] scrcpy bundle present: $scrcpyDir" -ForegroundColor Green
    return
}

$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) { throw "$SCRIPT_INDEX curl.exe is required to download the scrcpy release." }

$workDir = Join-Path $scrcpyDir '.download'
New-CnNamespaceDirectory -Path $workDir
$archivePath = Join-Path $workDir $ARCHIVE_NAME
$sumsPath = Join-Path $workDir $SUMS_NAME
$extractDir = Join-Path $workDir 'extract'

Write-Host "$SCRIPT_INDEX [..] downloading $SUMS_NAME and $ARCHIVE_NAME ..." -ForegroundColor Yellow
& $curl.Source -f -L --retry 3 --connect-timeout 30 -o $sumsPath "$RELEASE_BASE/$SUMS_NAME"
if ($LASTEXITCODE -ne 0) { throw "$SCRIPT_INDEX download of $SUMS_NAME failed (curl exit $LASTEXITCODE)." }
& $curl.Source -f -L -C - --retry 3 --connect-timeout 30 -o $archivePath "$RELEASE_BASE/$ARCHIVE_NAME"
if ($LASTEXITCODE -ne 0) { throw "$SCRIPT_INDEX download of $ARCHIVE_NAME failed (curl exit $LASTEXITCODE)." }

foreach ($line in Get-Content -LiteralPath $sumsPath) {
    $fields = @($line -split '\s+' | Where-Object { $_ })
    if ($fields.Count -ge 2 -and $fields[-1].TrimStart('*') -eq $ARCHIVE_NAME) { $expectedSha = $fields[0].ToLowerInvariant() }
}
if (-not $expectedSha) { throw "$SCRIPT_INDEX $ARCHIVE_NAME is not listed in $SUMS_NAME." }
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedSha) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "$SCRIPT_INDEX sha256 mismatch for $ARCHIVE_NAME; the archive was removed and the next run re-downloads it."
}

if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force
$bundleDir = (Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1).FullName
if (-not $bundleDir) { throw "$SCRIPT_INDEX $ARCHIVE_NAME has no top-level directory." }
foreach ($item in Get-ChildItem -LiteralPath $bundleDir -Force) {
    Copy-Item -LiteralPath $item.FullName -Destination $scrcpyDir -Recurse -Force
}
Remove-Item -LiteralPath $workDir -Recurse -Force

$missing = @(Get-ScrcpyMissingFiles)
if ($missing.Count -gt 0) {
    Write-Host ("$SCRIPT_INDEX [!] bundle incomplete, missing: {0}" -f ($missing -join ', ')) -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}
Write-Host "$SCRIPT_INDEX [OK] scrcpy $SCRCPY_VERSION ready: $scrcpyDir" -ForegroundColor Green
