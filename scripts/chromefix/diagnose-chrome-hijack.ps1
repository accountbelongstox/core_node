<#
.SYNOPSIS
    Read-only forensic sweep for Google Chrome hijacking / DLL injection.

.DESCRIPTION
    Collects evidence explaining two symptoms:
      1. chrome.exe crashing on launch with STATUS_STACK_BUFFER_OVERRUN
         (0xC0000409) -> usually a foreign DLL injected into the process.
      2. "Settings were changed from outside of Chrome ... Pinned tabs"
         -> a process editing Chrome's Preferences / Secure Preferences.

    This script ONLY READS. It changes nothing. Review the output, then run
    the companion clean-chrome-hijack.ps1 against the confirmed targets.

.NOTES
    Run from an elevated PowerShell for full coverage (HKLM, services, tasks).
#>

$ErrorActionPreference = 'SilentlyContinue'

# --- Configuration (declared at top) ----------------------------------------
$scriptRoot       = Split-Path -Parent $MyInvocation.MyCommand.Path
$chromeAppDirs    = @(
    'C:\Program Files\Google\Chrome\Application',
    'C:\Program Files (x86)\Google\Chrome\Application',
    'D:\applications\Chrome\Chrome\Application'
)
$userDataRoots    = @(
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data')
)
$trustedSigners   = @('Google LLC', 'Google Inc', 'Microsoft Corporation', 'Microsoft Windows')
$recentDays       = 21
$shortcutDirs     = @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:PUBLIC 'Desktop'),
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch'),
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
)
$runKeys          = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run'
)
$policyKeys       = @(
    'HKLM:\SOFTWARE\Policies\Google\Chrome',
    'HKLM:\SOFTWARE\WOW6432Node\Policies\Google\Chrome',
    'HKCU:\SOFTWARE\Policies\Google\Chrome'
)
$extRegKeys       = @(
    'HKLM:\SOFTWARE\Google\Chrome\Extensions',
    'HKLM:\SOFTWARE\WOW6432Node\Google\Chrome\Extensions',
    'HKCU:\SOFTWARE\Google\Chrome\Extensions'
)

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host ('=' * 78)
    Write-Host "## $Title"
    Write-Host ('=' * 78)
}

function Test-TrustedSigner {
    param([string]$Subject)
    if (-not $Subject) { return $false }
    foreach ($s in $trustedSigners) { if ($Subject -like "*$s*") { return $true } }
    return $false
}

Write-Host "Chrome hijack diagnostic | host=$env:COMPUTERNAME user=$env:USERNAME"
Write-Host "Script root: $scriptRoot"

# 1) Chrome shortcuts -- classic hijack appends args / a URL / --load-extension
Write-Section '1. Chrome shortcuts (.lnk) with arguments or non-standard target'
$wsh = New-Object -ComObject WScript.Shell
foreach ($dir in $shortcutDirs) {
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
        $lnk = $wsh.CreateShortcut($_.FullName)
        $isChrome = ($lnk.TargetPath -match 'chrome') -or ($_.Name -match 'chrome')
        $suspicious = $lnk.Arguments -match 'http|--load-extension|--app=|\.url|\.hta|cmd|powershell'
        if ($isChrome -or $suspicious) {
            Write-Host "LNK   : $($_.FullName)"
            Write-Host "  Target: $($lnk.TargetPath)"
            Write-Host "  Args  : $($lnk.Arguments)"
            if ($suspicious) { Write-Host "  >>> SUSPICIOUS ARGUMENTS <<<" }
        }
    }
}

# 2) Enterprise policy hijack (force-installed extensions, homepage, startup)
Write-Section '2. Chrome policy registry keys (ExtensionInstallForcelist / homepage / startup)'
foreach ($k in $policyKeys) {
    if (Test-Path $k) {
        Write-Host "KEY: $k"
        Get-Item $k | Select-Object -ExpandProperty Property | ForEach-Object {
            Write-Host "  $_ = $((Get-ItemProperty $k).$_)"
        }
        Get-ChildItem -Recurse $k -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  SUBKEY: $($_.Name)"
            $sk = $_.PSPath
            (Get-Item $sk).Property | ForEach-Object { Write-Host "    $_ = $((Get-ItemProperty $sk).$_)" }
        }
    }
}

# 3) External-extension registry keys (force / silent install of extensions)
Write-Section '3. Chrome external-extension registry keys'
foreach ($k in $extRegKeys) {
    if (Test-Path $k) {
        Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object {
            $p = Get-ItemProperty $_.PSPath
            Write-Host "EXT-ID: $($_.PSChildName)  path=$($p.path)  url=$($p.update_url) ver=$($p.version)"
        }
    }
}

# 4) Installed extensions on disk (folder id + manifest name)
Write-Section '4. Installed Chrome extensions (per profile)'
foreach ($root in $userDataRoots) {
    if (-not (Test-Path $root)) { continue }
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName 'Extensions') } | ForEach-Object {
        $profile = $_.Name
        Get-ChildItem (Join-Path $_.FullName 'Extensions') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $extId = $_.Name
            $manifest = Get-ChildItem $_.FullName -Recurse -Filter manifest.json -ErrorAction SilentlyContinue | Select-Object -First 1
            $name = ''
            if ($manifest) {
                try { $name = (Get-Content $manifest.FullName -Raw | ConvertFrom-Json).name } catch {}
            }
            Write-Host "[$profile] $extId  -> $name"
        }
    }
}

# 5) Secure Preferences highlights (homepage / startup urls / default search)
Write-Section '5. Secure Preferences highlights per profile'
foreach ($root in $userDataRoots) {
    if (-not (Test-Path $root)) { continue }
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName 'Secure Preferences') } | ForEach-Object {
        $profile = $_.Name
        try {
            $sp = Get-Content (Join-Path $_.FullName 'Secure Preferences') -Raw | ConvertFrom-Json
            Write-Host "[$profile] homepage       = $($sp.homepage)"
            Write-Host "[$profile] startup_urls   = $($sp.session.startup_urls -join ', ')"
            Write-Host "[$profile] restore_on_start = $($sp.session.restore_on_startup)"
            if ($sp.default_search_provider_data) {
                Write-Host "[$profile] search_provider = $($sp.default_search_provider_data.template_url_data.keyword)"
            }
        } catch { Write-Host "[$profile] (could not parse Secure Preferences)" }
    }
}

# 6) Autorun / persistence registry locations
Write-Section '6. Run / RunOnce keys'
foreach ($k in $runKeys) {
    if (Test-Path $k) {
        Write-Host "KEY: $k"
        (Get-Item $k).Property | ForEach-Object { Write-Host "  $_ = $((Get-ItemProperty $k).$_)" }
    }
}

# 7) Winlogon Shell / Userinit hijack
Write-Section '7. Winlogon Shell / Userinit'
$wl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Get-ItemProperty $wl | Select-Object Shell, Userinit | Format-List

# 8) Image File Execution Options debugger hijack for chrome.exe
Write-Section '8. Image File Execution Options (chrome.exe debugger hijack)'
$ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
'chrome.exe', 'GoogleUpdate.exe' | ForEach-Object {
    $k = Join-Path $ifeo $_
    if (Test-Path $k) {
        $p = Get-ItemProperty $k
        Write-Host "$_ : Debugger=$($p.Debugger)  GlobalFlag=$($p.GlobalFlag)"
        if ($p.Debugger) { Write-Host "  >>> DEBUGGER HIJACK PRESENT <<<" }
    }
}

# 9) AppInit_DLLs / AppCertDLLs (force-loaded into many processes)
Write-Section '9. AppInit_DLLs / AppCertDLLs'
$ai = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows'
$aiw = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows NT\CurrentVersion\Windows'
foreach ($k in @($ai, $aiw)) {
    if (Test-Path $k) {
        $p = Get-ItemProperty $k
        Write-Host "$k : AppInit_DLLs='$($p.AppInit_DLLs)'  LoadAppInit_DLLs=$($p.LoadAppInit_DLLs)"
        if ($p.AppInit_DLLs) { Write-Host "  >>> NON-EMPTY AppInit_DLLs <<<" }
    }
}
$acd = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\AppCertDlls'
if (Test-Path $acd) { Write-Host "AppCertDlls:"; Get-Item $acd | Select-Object -ExpandProperty Property }

# 10) Proxy / PAC hijack
Write-Section '10. Internet proxy / PAC settings'
$is = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings'
Get-ItemProperty $is | Select-Object ProxyEnable, ProxyServer, AutoConfigURL | Format-List

# 11) Scheduled tasks (non-Microsoft) with their actions
Write-Section '11. Scheduled tasks (non-Microsoft)'
Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { $_.TaskPath -notmatch '^\\Microsoft\\' -and $_.TaskPath -ne '\' -or ($_.TaskPath -eq '\' -and $_.TaskName -notmatch 'GoogleUpdate|OneDrive|MicrosoftEdge') } |
    ForEach-Object {
        $act = ($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' || '
        Write-Host "[$($_.State)] $($_.TaskPath)$($_.TaskName)"
        Write-Host "    => $act"
    }

# 12) Non-Microsoft auto services with unsigned binaries
Write-Section '12. Auto-start services with non-trusted / unsigned binary'
Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
    Where-Object { $_.StartMode -eq 'Auto' -and $_.PathName } | ForEach-Object {
        $bin = ($_.PathName -replace '^"([^"]+)".*', '$1') -replace '^([^\s]+).*', '$1'
        if (Test-Path $bin) {
            $sig = Get-AuthenticodeSignature $bin
            if (-not (Test-TrustedSigner $sig.SignerCertificate.Subject)) {
                Write-Host "SVC: $($_.Name)  bin=$bin  sig=$($sig.Status)  signer=$($sig.SignerCertificate.Subject)"
            }
        }
    }

# 13) Running chrome.exe processes -- path + command line (hijack args show here)
Write-Section '13. Running chrome.exe processes (path + command line)'
Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue |
    Select-Object ProcessId, ExecutablePath, CommandLine | ForEach-Object {
        Write-Host "PID $($_.ProcessId): $($_.ExecutablePath)"
        Write-Host "   $($_.CommandLine)"
    }

# 14) Signature scan of both Chrome Application dirs -- flag non-Google binaries
Write-Section '14. Non-Google / unsigned binaries inside Chrome Application dirs (KEY for the crash)'
foreach ($dir in $chromeAppDirs) {
    if (-not (Test-Path $dir)) { continue }
    Write-Host "DIR: $dir"
    $files = Get-ChildItem $dir -Recurse -Include *.dll, *.exe -ErrorAction SilentlyContinue
    $total = $files.Count; $flagged = 0
    foreach ($f in $files) {
        $sig = Get-AuthenticodeSignature $f.FullName
        $trusted = ($sig.Status -eq 'Valid') -and (Test-TrustedSigner $sig.SignerCertificate.Subject)
        if (-not $trusted) {
            $flagged++
            Write-Host "  FLAG: $($f.FullName)"
            Write-Host "        status=$($sig.Status) signer=$($sig.SignerCertificate.Subject) modified=$($f.LastWriteTime)"
        }
    }
    Write-Host "  scanned=$total flagged=$flagged"
}

# 15) hosts file non-default entries
Write-Section '15. hosts file entries'
$hosts = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'
if (Test-Path $hosts) {
    Get-Content $hosts | Where-Object { $_ -match '^\s*[^#\s]' } | ForEach-Object { Write-Host "  $_" }
}

# 16) Windows Defender status + recent detections
Write-Section '16. Microsoft Defender status + recent detections'
Get-MpComputerStatus -ErrorAction SilentlyContinue |
    Select-Object AMRunningMode, RealTimeProtectionEnabled, AntivirusEnabled, AntivirusSignatureLastUpdated, QuickScanEndTime |
    Format-List
Get-MpThreatDetection -ErrorAction SilentlyContinue |
    Select-Object -First 25 InitialDetectionTime, ThreatID, @{n='Resources'; e={ $_.Resources -join '; ' }} |
    Format-List

# 17) Recently modified files in Chrome User Data + Application dirs
Write-Section "17. Files modified in the last $recentDays days (Chrome dirs)"
$cut = (Get-Date).AddDays(-$recentDays)
foreach ($dir in ($chromeAppDirs + $userDataRoots)) {
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt $cut -and $_.Extension -match '\.(dll|exe|json|dat|tmp|cmd|bat|ps1|vbs|js|hta)$' } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 40 |
        ForEach-Object { Write-Host "  $($_.LastWriteTime)  $($_.FullName)" }
}

Write-Host ''
Write-Host 'Diagnostic complete. Review FLAG / SUSPICIOUS / DEBUGGER HIJACK lines first.'
