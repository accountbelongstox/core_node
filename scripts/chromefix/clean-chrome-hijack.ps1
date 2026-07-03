<#
.SYNOPSIS
    Remove the OnePlus-toolbox HackTool artifacts and repair the Chrome profile
    that was corrupted by it (cause of the STATUS_STACK_BUFFER_OVERRUN crash).

.DESCRIPTION
    Applies all fixes automatically with no required parameters. Safe to run any
    number of times; a second run on a clean machine is a no-op.

    Findings this script acts on (see diagnose-chrome-hijack.ps1 output):
      * Malware: HackTool:Win32/Malgent!MSR delivered by "一加全能工具箱21.2.exe"
        (a daxiaamu OnePlus flashing toolbox). Defender already quarantined every
        .exe instance; what remains is the SOURCE archive (.7z) and the extracted
        temp payloads -- both are re-infection vectors and are removed here.
      * Chrome crash: the stable Chrome Default profile holds corrupted session /
        pinned-tab / preferences data. A clean profile launches fine, so this
        script BACKS UP (renames, never hard-deletes) only those few files so
        Chrome regenerates them. Bookmarks, passwords, history and extensions are
        left untouched.

.PARAMETER DryRun
    Report what would be changed without making any changes. Default is to apply.

.PARAMETER Scan
    Also start a Microsoft Defender full scan after cleanup.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\clean-chrome-hijack.ps1
    powershell -ExecutionPolicy Bypass -File .\clean-chrome-hijack.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\clean-chrome-hijack.ps1 -Scan
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Scan
)

$ErrorActionPreference = 'SilentlyContinue'

# --- Configuration (declared at top) ----------------------------------------
$stamp            = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempRoot         = $env:TEMP
$malwareNameRegex = '一加|工具箱|pctool|toolbox'
$malwareDirMarker = 'daxiaamu'
$searchRoots      = @('D:\.tmp', 'D:\programing\Ace5\.tmp', (Join-Path $env:USERPROFILE 'Downloads'))
$chromeUserData   = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
$profileFiles     = @('Preferences', 'Secure Preferences', 'Current Session', 'Current Tabs', 'Last Session', 'Last Tabs')
$profileFolders   = @('Sessions')
$mpCmdRun         = Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe'
$actionCount      = 0

function Invoke-Step {
    param([string]$Description, [scriptblock]$Action)
    $script:actionCount++
    if (-not $DryRun) {
        Write-Host "APPLY : $Description"
        & $Action
    } else {
        Write-Host "WOULD : $Description"
    }
}

Write-Host ('=' * 78)
Write-Host ("Chrome hijack cleanup | mode={0} | {1}" -f ($(if ($DryRun) { 'DRY-RUN' } else { 'APPLY' })), $stamp)
Write-Host ('=' * 78)

# 1) Remove the leftover malware source archives and named droppers.
Write-Host ''
Write-Host '## 1. Malware archives / named droppers'
foreach ($root in ($searchRoots | Select-Object -Unique)) {
    if (-not (Test-Path $root)) { continue }
    Get-ChildItem $root -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { -not $_.PSIsContainer -and $_.Name -match $malwareNameRegex } | ForEach-Object {
        $target = $_.FullName
        Invoke-Step "Delete $target ($([math]::Round($_.Length/1MB,1)) MB)" { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue }
    }
}

# 2) Remove extracted toolbox payloads in TEMP (dirs containing the daxiaamu marker).
Write-Host ''
Write-Host '## 2. Extracted toolbox payloads in TEMP'
Get-ChildItem $tempRoot -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
    Test-Path (Join-Path $_.FullName $malwareDirMarker)
} | ForEach-Object {
    $dir = $_.FullName
    Invoke-Step "Remove temp payload dir $dir" { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
}

# 3) Repair the corrupted Chrome profile (back up session / preference files).
Write-Host ''
Write-Host '## 3. Chrome profile repair (rename corrupted session/preference files)'
$stableRunning = Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath -notmatch 'Chrome Beta' -and $_.CommandLine -notmatch 'chrome_clean_test' }
if ($stableRunning) {
    Write-Host "  WARNING: stable Chrome appears to be running. Close ALL Chrome windows before applying, or the files are locked."
}
if (Test-Path $chromeUserData) {
    $profiles = Get-ChildItem $chromeUserData -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' }
    foreach ($p in $profiles) {
        foreach ($f in $profileFiles) {
            $path = Join-Path $p.FullName $f
            if (Test-Path $path) {
                $bakName = (Split-Path $path -Leaf) + '.malbak-' + $stamp
                Invoke-Step "[$($p.Name)] back up file '$f' -> $bakName" { Rename-Item -LiteralPath $path -NewName $bakName -Force -ErrorAction SilentlyContinue }
            }
        }
        foreach ($d in $profileFolders) {
            $path = Join-Path $p.FullName $d
            if (Test-Path $path) {
                $bakName = (Split-Path $path -Leaf) + '.malbak-' + $stamp
                Invoke-Step "[$($p.Name)] back up folder '$d' -> $bakName" { Rename-Item -LiteralPath $path -NewName $bakName -Force -ErrorAction SilentlyContinue }
            }
        }
    }
} else {
    Write-Host "  Chrome User Data not found at $chromeUserData"
}

# 4) Optional: start a Microsoft Defender full scan.
Write-Host ''
Write-Host '## 4. Microsoft Defender full scan'
if ($Scan) {
    if (Test-Path $mpCmdRun) {
        Invoke-Step "Start Defender full scan via MpCmdRun.exe" { & $mpCmdRun -Scan -ScanType 2 | Out-Host }
    } else {
        Invoke-Step "Start Defender full scan via Start-MpScan" { Start-MpScan -ScanType FullScan }
    }
} else {
    Write-Host "  (skipped; pass -Scan to run a full scan)"
}

Write-Host ''
Write-Host ('=' * 78)
if (-not $DryRun) {
    Write-Host "Done. $actionCount actions applied. Restart Chrome; it will rebuild a clean session."
    Write-Host "Backups end in .malbak-$stamp -- delete them once Chrome is confirmed working."
} else {
    Write-Host "DRY-RUN complete. $actionCount actions would run. Re-run without -DryRun to execute."
}
Write-Host ('=' * 78)
