<#
.SYNOPSIS
    Real-time, all-round monitor for every Chrome directory, config file and
    shortcut. Alerts the instant any file is created, changed, renamed or
    deleted, and records a before/after MD5 diff for tampering proof.

.DESCRIPTION
    Watches, in real time (no polling):
      - Both chrome.exe install trees (reference + suspect Application folders),
        so binary/DLL patching is caught immediately.
      - Every Chrome "User Data" profile dir (auto-detected, including the
        --user-data-dir of any chrome.exe currently running), where rogue
        extensions inject themselves via Preferences / Secure Preferences.
      - Chrome shortcut (.lnk) hijack targets on Desktop / Start Menu / Taskbar.

    On each change it prints a coloured alert, beeps for critical files, appends
    to a log, shows the MD5 before -> after for config/binary files, and prints
    the shortcut target+arguments for .lnk changes (to expose appended
    --load-extension / URL hijacks).

    With -TrackProcess it enables Windows object-access auditing on the watched
    folders and attributes each write to the responsible process (name + PID +
    access) by reading Security event 4663 -- this is the in-box way to name the
    culprit. Requires an elevated (Administrator) session.

.PARAMETER ExtraPaths
    Additional directories to watch (e.g. a non-default portable profile).

.PARAMETER TrackProcess
    Enable file-system auditing and attribute writes to a process/PID.

.PARAMETER DebounceMs
    Collapse duplicate events for the same path+type within this window.

.NOTES
    Run elevated so Program Files / other-user dirs are readable and auditing
    can be enabled. Stop with Ctrl+C. Pair with Procmon for the full call stack:
    the alert timestamps line up with Procmon rows for the same path.
#>

param(
    [string[]] $ExtraPaths = @(),
    [switch]   $TrackProcess,
    [int]      $DebounceMs = 400
)

# --- Configuration and mutable state (declared at top) ----------------------
$ErrorActionPreference = 'Stop'

$ScriptDir      = $PSScriptRoot
$LogDir         = Join-Path $ScriptDir 'logs'
$LogFile        = Join-Path $LogDir 'chrome_monitor.log'

$ReferenceApp   = 'C:\Program Files\Google\Chrome\Application'
$SuspectApp     = 'D:\applications\Chrome\Chrome\Application'

$UserDataSeeds  = @(
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'),
    'D:\applications\Chrome\Chrome\User Data',
    'D:\applications\Chrome\User Data'
)
$ShortcutSeeds  = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    (Join-Path $env:APPDATA   'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:APPDATA   'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
)

$ChangeTypes    = @('Created', 'Changed', 'Renamed', 'Deleted')
$CriticalNames  = @('Preferences', 'Secure Preferences', 'Local State', 'Bookmarks',
                    'Web Data', 'Login Data', 'Extension Cookies')
$CriticalExts   = @('.dll', '.exe', '.lnk', '.sdb')
$AuditRights    = 'WriteData,AppendData,Delete,DeleteSubdirectoriesAndFiles,ChangePermissions,TakeOwnership'

$IsAdmin        = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
                  ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)

$script:LastSeen   = @{}   # debounce map: "path|type" -> datetime
$script:Baseline   = @{}   # lowercased path -> md5
$Watchers          = New-Object System.Collections.Generic.List[System.IO.FileSystemWatcher]
$Subscriptions     = New-Object System.Collections.Generic.List[string]
$AuditedRoots      = New-Object System.Collections.Generic.List[string]


# --- Helpers ----------------------------------------------------------------
function Get-FileMd5 {
    # MD5 with FileShare ReadWrite so locked/running Chrome files still hash.
    param([string] $Path)
    $stream = $null
    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open,
                  [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $algo  = [System.Security.Cryptography.MD5]::Create()
        $bytes = $algo.ComputeHash($stream)
        return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
    } catch {
        return $null
    } finally {
        if ($stream) { $stream.Dispose() }
    }
}

function Get-RunningUserDataDirs {
    # Pull --user-data-dir from the command line of every live chrome.exe.
    $found = New-Object System.Collections.Generic.List[string]
    $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        $cmd = $p.CommandLine
        if (-not $cmd) { continue }
        if ($cmd -match '--user-data-dir="([^"]+)"') { $found.Add($Matches[1].Trim()) }
        elseif ($cmd -match '--user-data-dir=([^\s"]+)') { $found.Add($Matches[1].Trim()) }
    }
    return $found
}

function Get-ShortcutInfo {
    param([string] $Path)
    try {
        $shell = New-Object -ComObject WScript.Shell
        $lnk   = $shell.CreateShortcut($Path)
        return ('target="{0}" args="{1}"' -f $lnk.TargetPath, $lnk.Arguments)
    } catch {
        return $null
    }
}

function Test-Critical {
    param([string] $Path, [bool] $LabelCritical)
    if ($LabelCritical) { return $true }
    $leaf = Split-Path $Path -Leaf
    if ($CriticalNames -contains $leaf) { return $true }
    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    return ($CriticalExts -contains $ext)
}

function Write-Log {
    param([string] $Line)
    Add-Content -LiteralPath $LogFile -Value $Line -Encoding UTF8
}

function Write-Alert {
    param([string] $Tag, [string] $Path, [string] $Detail, [string] $Color)
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    $head  = '[{0}] {1,-8} {2}' -f $stamp, $Tag, $Path
    Write-Host $head -ForegroundColor $Color
    Write-Log  $head
    if ($Detail) {
        $body = '           -> {0}' -f $Detail
        Write-Host $body -ForegroundColor DarkGray
        Write-Log  $body
    }
}

function Get-WriterProcess {
    # Attribute a write to a process via Security event 4663 (needs auditing on).
    param([string] $Path, [datetime] $Since)
    if (-not $TrackProcess) { return $null }
    $events = Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4663; StartTime = $Since } -ErrorAction SilentlyContinue
    foreach ($e in $events) {
        $xml  = [xml] $e.ToXml()
        $data = @{}
        foreach ($d in $xml.Event.EventData.Data) { $data[$d.Name] = $d.'#text' }
        if ($data['ObjectName'] -and ($data['ObjectName'] -ieq $Path)) {
            $procId = 0
            try { $procId = [Convert]::ToInt64($data['ProcessId'], 16) } catch { $procId = 0 }
            return ('writer="{0}" pid={1} access={2}' -f $data['ProcessName'], $procId, $data['AccessList'])
        }
    }
    return $null
}

function Enable-FileAuditing {
    param([string[]] $Roots)
    & auditpol /set /subcategory:"File System" /success:enable /failure:enable | Out-Null
    foreach ($root in $Roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        try {
            $acl  = Get-Acl -LiteralPath $root -Audit
            $rule = New-Object System.Security.AccessControl.FileSystemAuditRule(
                        'Everyone', $AuditRights,
                        'ContainerInherit,ObjectInherit', 'None', 'Success')
            $acl.AddAuditRule($rule)
            Set-Acl -LiteralPath $root -AclObject $acl
            $AuditedRoots.Add($root)
        } catch {
            Write-Host ('  audit setup failed for {0}: {1}' -f $root, $_.Exception.Message) -ForegroundColor Yellow
        }
    }
}


# --- Build the watch list ---------------------------------------------------
function New-WatchTarget {
    param([string] $Path, [string] $Label, [string] $Filter, [bool] $Recurse, [bool] $Critical)
    [pscustomobject]@{ Path = $Path; Label = $Label; Filter = $Filter; Recurse = $Recurse; Critical = $Critical }
}

$candidateTargets = New-Object System.Collections.Generic.List[object]
$candidateTargets.Add((New-WatchTarget $ReferenceApp 'REF-APP'  '*'     $true  $true))
$candidateTargets.Add((New-WatchTarget $SuspectApp   'SUS-APP'  '*'     $true  $true))

$allUserData = New-Object System.Collections.Generic.List[string]
foreach ($d in $UserDataSeeds)              { $allUserData.Add($d) }
foreach ($d in (Get-RunningUserDataDirs))   { $allUserData.Add($d) }
foreach ($d in $ExtraPaths)                 { $allUserData.Add($d) }
foreach ($d in $allUserData) {
    $candidateTargets.Add((New-WatchTarget $d 'PROFILE' '*' $true $false))
}
foreach ($d in $ShortcutSeeds) {
    $candidateTargets.Add((New-WatchTarget $d 'SHORTCUT' '*.lnk' $true $false))
}

# Keep only existing, de-duplicated directories.
$watchTargets = New-Object System.Collections.Generic.List[object]
$seenPaths    = New-Object System.Collections.Generic.HashSet[string]
foreach ($t in $candidateTargets) {
    if (-not (Test-Path -LiteralPath $t.Path -PathType Container)) { continue }
    $full = (Resolve-Path -LiteralPath $t.Path).Path
    $key  = '{0}|{1}' -f $full.ToLowerInvariant(), $t.Filter
    if ($seenPaths.Add($key)) {
        $t.Path = $full
        $watchTargets.Add($t)
    }
}


# --- Startup banner + baseline ----------------------------------------------
if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

Write-Host ('=' * 72) -ForegroundColor White
Write-Host 'CHROME REAL-TIME DIRECTORY MONITOR' -ForegroundColor White
Write-Host ('=' * 72) -ForegroundColor White
if (-not $IsAdmin) {
    Write-Host '  WARNING: not elevated -- some dirs may be unreadable; -TrackProcess disabled.' -ForegroundColor Yellow
}
Write-Host ('  log file : {0}' -f $LogFile) -ForegroundColor Gray
Write-Host '  watching :' -ForegroundColor Gray
foreach ($t in $watchTargets) {
    Write-Host ('    [{0,-8}] {1}  (filter {2}, recurse {3})' -f $t.Label, $t.Path, $t.Filter, $t.Recurse) -ForegroundColor Gray
}

# Baseline MD5 of every critical file so changes show a real before -> after.
foreach ($t in $watchTargets) {
    Get-ChildItem -LiteralPath $t.Path -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { Test-Critical $_.FullName $t.Critical } |
        ForEach-Object { $script:Baseline[$_.FullName.ToLowerInvariant()] = (Get-FileMd5 $_.FullName) }
}
Write-Host ('  baseline : {0} critical files hashed' -f $script:Baseline.Count) -ForegroundColor Gray

if ($TrackProcess) {
    if ($IsAdmin) {
        Write-Host '  auditing : enabling object-access auditing for process attribution...' -ForegroundColor Gray
        Enable-FileAuditing ($watchTargets | ForEach-Object { $_.Path })
    } else {
        Write-Host '  auditing : SKIPPED (run elevated to attribute writes to a process).' -ForegroundColor Yellow
        $TrackProcess = $false
    }
}
Write-Host ('-' * 72) -ForegroundColor White
Write-Host 'Monitoring... press Ctrl+C to stop.' -ForegroundColor Green


# --- Event handling ---------------------------------------------------------
function Resolve-Severity {
    param([string] $ChangeType, [bool] $Critical)
    if ($Critical) {
        switch ($ChangeType) {
            'Deleted'  { return @{ Color = 'Red';     Beep = $true } }
            default    { return @{ Color = 'Red';     Beep = $true } }
        }
    }
    switch ($ChangeType) {
        'Created'  { return @{ Color = 'Yellow';  Beep = $false } }
        'Changed'  { return @{ Color = 'Cyan';    Beep = $false } }
        'Renamed'  { return @{ Color = 'Magenta'; Beep = $false } }
        'Deleted'  { return @{ Color = 'Red';     Beep = $false } }
        default    { return @{ Color = 'Gray';    Beep = $false } }
    }
}

function Handle-FsEvent {
    param($Evt)
    $sea        = $Evt.SourceEventArgs
    $changeType = [string] $sea.ChangeType
    $path       = [string] $sea.FullPath
    $label      = [string] $Evt.MessageData

    $key = '{0}|{1}' -f $path.ToLowerInvariant(), $changeType
    $now = Get-Date
    if ($script:LastSeen.ContainsKey($key) -and (($now - $script:LastSeen[$key]).TotalMilliseconds -lt $DebounceMs)) { return }
    $script:LastSeen[$key] = $now

    $labelCritical = ($label -eq 'REF-APP' -or $label -eq 'SUS-APP')
    $critical      = Test-Critical $path $labelCritical
    $sev           = Resolve-Severity $changeType $critical
    $tag           = '{0}/{1}' -f $label, $changeType

    $detailParts = New-Object System.Collections.Generic.List[string]

    if ($sea -is [System.IO.RenamedEventArgs]) {
        $detailParts.Add(('from "{0}"' -f $sea.OldFullPath))
    }

    # MD5 before -> after for critical files that still exist.
    if ($critical -and $changeType -ne 'Deleted' -and (Test-Path -LiteralPath $path -PathType Leaf)) {
        $pk     = $path.ToLowerInvariant()
        $newMd5 = Get-FileMd5 $path
        $oldMd5 = $null
        if ($script:Baseline.ContainsKey($pk)) { $oldMd5 = $script:Baseline[$pk] }
        if ($newMd5) {
            if ($oldMd5 -and ($oldMd5 -ne $newMd5)) {
                $detailParts.Add(('md5 {0} -> {1}' -f $oldMd5, $newMd5))
            } elseif (-not $oldMd5) {
                $detailParts.Add(('md5 {0} (new)' -f $newMd5))
            }
            $script:Baseline[$pk] = $newMd5
        }
    }

    # Reveal shortcut target/args (exposes --load-extension / URL hijacks).
    if (([System.IO.Path]::GetExtension($path).ToLowerInvariant() -eq '.lnk') -and (Test-Path -LiteralPath $path -PathType Leaf)) {
        $info = Get-ShortcutInfo $path
        if ($info) { $detailParts.Add($info) }
    }

    # Attribute the write to a process via the audit log.
    $writer = Get-WriterProcess $path $now.AddSeconds(-5)
    if ($writer) { $detailParts.Add($writer) }

    $detail = ($detailParts -join '  |  ')
    Write-Alert $tag $path $detail $sev.Color
    if ($sev.Beep) { [console]::Beep(880, 150) }
}


# --- Register watchers and run ----------------------------------------------
try {
    $idx = 0
    foreach ($t in $watchTargets) {
        $w = New-Object System.IO.FileSystemWatcher
        $w.Path = $t.Path
        $w.Filter = $t.Filter
        $w.IncludeSubdirectories = $t.Recurse
        $w.InternalBufferSize = 65536
        $w.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor `
                          [System.IO.NotifyFilters]::DirectoryName -bor `
                          [System.IO.NotifyFilters]::LastWrite -bor `
                          [System.IO.NotifyFilters]::Size -bor `
                          [System.IO.NotifyFilters]::CreationTime -bor `
                          [System.IO.NotifyFilters]::Security
        $w.EnableRaisingEvents = $true
        foreach ($ct in $ChangeTypes) {
            $sid = 'CHROMEMON_{0}_{1}' -f $idx, $ct
            Register-ObjectEvent -InputObject $w -EventName $ct -SourceIdentifier $sid -MessageData $t.Label | Out-Null
            $Subscriptions.Add($sid)
        }
        $Watchers.Add($w)
        $idx = $idx + 1
    }

    while ($true) {
        $null = Wait-Event -Timeout 1
        foreach ($evt in (Get-Event)) {
            try { Handle-FsEvent $evt } catch { }
            Remove-Event -EventIdentifier $evt.EventIdentifier
        }
    }
} finally {
    foreach ($sid in $Subscriptions) {
        Unregister-Event -SourceIdentifier $sid -ErrorAction SilentlyContinue
    }
    foreach ($w in $Watchers) {
        $w.EnableRaisingEvents = $false
        $w.Dispose()
    }
    Write-Host ''
    Write-Host 'Monitor stopped. Watchers released.' -ForegroundColor Green
    if ($AuditedRoots.Count -gt 0) {
        Write-Host ('Audit rules left in place on {0} root(s) for future runs.' -f $AuditedRoots.Count) -ForegroundColor Gray
    }
}
