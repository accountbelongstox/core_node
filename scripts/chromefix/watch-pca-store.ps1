# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Watch the PCA Store and Layers keys for chrome.exe entries being written back
    and attribute each write-back to the responsible process.

.DESCRIPTION
    The fix-chrome-compat-shim.ps1 removes PCA Store entries for chrome.exe, but
    they keep reappearing. This script finds out exactly who writes them back.

    It:
      1. Prints an initial diagnostic: PcaSvc state, running Chrome/update
         processes, recent crash events, current key contents.
      2. Sets a registry SACL audit rule (SetValue / Success) on all four
         watched keys so Windows generates Security event 4657 on each write.
      3. Polls the keys every PollMs milliseconds and diffs vs the baseline.
      4. On detecting a new chrome.exe entry: reads Security event 4657 to name
         the writer process, snapshots running Chrome / GoogleUpdate / pcalua,
         checks Application log for concurrent Chrome crashes, and logs everything.

    Three ROOT-CAUSE signals:
      - If "proc=svchost.exe" appears in 4657 + a Chrome crash event is nearby
        -> PcaSvc (Windows PCA) is re-adding because Chrome still crashes.
        Fix: resolve the Chrome crash; or use -Lock to disable PcaSvc.
      - If "proc=svchost.exe" appears BUT no crash event
        -> PcaSvc is re-adding due to a Google Update / installer triggering PCA
           on Chrome startup. Use -Lock to disable PcaSvc.
      - If another process (GoogleUpdate.exe, some PUP, etc.) appears
        -> that process is the direct writer; identify and remove it.

    With -Lock (requires elevation):
      Stops and disables PcaSvc (Program Compatibility Assistant service).
      This prevents PCA from writing ANY compat-assistant entries for any app.
      Chrome is unaffected functionally; you just lose compat-assistant overlays.
      Re-enable with: Set-Service PcaSvc -StartupType Automatic; Start-Service PcaSvc

.PARAMETER PollMs
    Poll interval in milliseconds (default 1500).

.PARAMETER DurationSeconds
    How long to watch before exiting (default 300; 0 = run until Ctrl+C).

.PARAMETER Lock
    Stop and disable PcaSvc after the initial diagnostic. Requires elevation.

.EXAMPLE
    # Watch for 5 minutes (default)
    powershell -ExecutionPolicy Bypass -File .\watch-pca-store.ps1

    # Watch indefinitely + disable PcaSvc immediately
    powershell -ExecutionPolicy Bypass -File .\watch-pca-store.ps1 -Lock -DurationSeconds 0

    # Quick 60-second check at a faster poll rate
    powershell -ExecutionPolicy Bypass -File .\watch-pca-store.ps1 -PollMs 800 -DurationSeconds 60
#>

[CmdletBinding()]
param(
    [int]    $PollMs          = 1500,
    [int]    $DurationSeconds = 300,
    [switch] $Lock
)

$ErrorActionPreference = 'Stop'

# --- All variables declared at top -------------------------------------------
$scriptDir          = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir             = Join-Path $scriptDir 'logs'
$stamp              = [datetime]::Now.ToString('yyyyMMdd-HHmmss')
$logFile            = Join-Path $logDir ('pca_watch_{0}.log' -f $stamp)
$chromeRx           = [regex]'(?i)chrome\.exe'
$interestingNameRx  = [regex]'(?i)chrome|googleupdate|pcalua|pca\.|GoogleCrash|elevation_service'
$isAdmin            = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$pcaSvcName         = 'PcaSvc'
$pcaSvcRegPath      = 'HKLM:\SYSTEM\CurrentControlSet\Services\PcaSvc'
$attrWindowSecs     = 10
$crashLookbackSecs  = 15
$watchedKeys        = @(
    [pscustomobject]@{
        PsPath     = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store'
        Label      = 'PCA-Store-HKCU'
        NtFragment = 'Compatibility Assistant\Store'
    },
    [pscustomobject]@{
        PsPath     = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store'
        Label      = 'PCA-Store-HKLM'
        NtFragment = 'Compatibility Assistant\Store'
    },
    [pscustomobject]@{
        PsPath     = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
        Label      = 'Layers-HKCU'
        NtFragment = 'AppCompatFlags\Layers'
    },
    [pscustomobject]@{
        PsPath     = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
        Label      = 'Layers-HKLM'
        NtFragment = 'AppCompatFlags\Layers'
    }
)
$snapshots          = @{}
$saclKeys           = New-Object System.Collections.Generic.List[string]
$detectionCount     = 0
$startTime          = [datetime]::Now
$deadline           = if ($DurationSeconds -gt 0) { $startTime.AddSeconds($DurationSeconds) } else { [datetime]::MaxValue }


# --- Output helpers ----------------------------------------------------------
function Ensure-LogDir {
    if (-not (Test-Path -LiteralPath $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
}

function Write-Log {
    param([string]$Msg, [string]$Color = 'White')
    $line = '[{0}] {1}' -f ([datetime]::Now.ToString('HH:mm:ss.fff')), $Msg
    Write-Host $line -ForegroundColor $Color
    Ensure-LogDir
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Write-Warn { param([string]$Msg) Write-Log ('[!] {0}' -f $Msg) 'Yellow' }
function Write-Good  { param([string]$Msg) Write-Log ('[+] {0}' -f $Msg) 'Green' }

function Write-Alert {
    param([string]$Msg)
    $line = '[{0}] [DETECTION] {1}' -f ([datetime]::Now.ToString('HH:mm:ss.fff')), $Msg
    Write-Host $line -ForegroundColor Red
    Ensure-LogDir
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}


# --- Registry helpers --------------------------------------------------------
function Get-KeySnapshot {
    param([string]$PsPath)
    $snap = @{}
    if (-not (Test-Path -LiteralPath $PsPath -ErrorAction SilentlyContinue)) { return $snap }
    try {
        $item = Get-Item -LiteralPath $PsPath -ErrorAction Stop
        foreach ($name in $item.Property) {
            try { $snap[$name] = (Get-ItemProperty -LiteralPath $PsPath -Name $name -ErrorAction Stop).$name }
            catch {}
        }
    } catch {}
    return $snap
}

function Enable-RegistrySacl {
    param([string]$PsPath, [string]$Label)
    if (-not $isAdmin) { return $false }
    if (-not (Test-Path -LiteralPath $PsPath -ErrorAction SilentlyContinue)) { return $false }
    try {
        & auditpol /set /subcategory:"Registry" /success:enable /failure:disable | Out-Null
        $acl  = Get-Acl -Path $PsPath -Audit -ErrorAction Stop
        $rule = New-Object System.Security.AccessControl.RegistryAuditRule(
            'Everyone',
            [System.Security.AccessControl.RegistryRights]::SetValue,
            [System.Security.AccessControl.InheritanceFlags]::None,
            [System.Security.AccessControl.PropagationFlags]::None,
            [System.Security.AccessControl.AuditFlags]::Success
        )
        $acl.AddAuditRule($rule)
        Set-Acl -Path $PsPath -AclObject $acl -ErrorAction Stop
        return $true
    } catch {
        Write-Warn ('SACL setup failed on [{0}]: {1}' -f $Label, $_.Exception.Message)
        return $false
    }
}


# --- Attribution and diagnostics ---------------------------------------------
function Get-WriterEvents {
    param([datetime]$Since, [string]$NtFragment)
    $results = New-Object System.Collections.Generic.List[string]
    if (-not $isAdmin) { return $results }
    try {
        $events = Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4657; StartTime = $Since } -ErrorAction SilentlyContinue
        foreach ($e in $events) {
            $msg = $e.Message
            if (-not ($msg -match 'chrome\.exe' -or $msg -match [regex]::Escape($NtFragment))) { continue }
            $xml  = [xml]$e.ToXml()
            $data = @{}
            foreach ($d in $xml.Event.EventData.Data) { $data[$d.Name] = $d.'#text' }
            $objName = [string]$data['ObjectName']
            $valName = [string]$data['ObjectValueName']
            if (-not ($objName -match [regex]::Escape($NtFragment) -or $chromeRx.IsMatch($valName))) { continue }
            $pid  = 0
            try { $pid = [Convert]::ToInt64($data['ProcessId'], 16) } catch {}
            $results.Add(('    4657 | writer="{0}" pid={1} | key={2} | value="{3}" | new={4} | at={5}' -f
                $data['ProcessName'], $pid, $objName, $valName, $data['NewValue'],
                $e.TimeCreated.ToString('HH:mm:ss.fff')))
        }
    } catch {}
    return $results
}

function Get-InterestingProcesses {
    $lines = New-Object System.Collections.Generic.List[string]
    try {
        $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { $interestingNameRx.IsMatch([string]$_.Name) }
        foreach ($p in $procs) {
            $lines.Add(('    pid={0,-6} name={1,-30} path="{2}"' -f $p.ProcessId, $p.Name, $p.ExecutablePath))
        }
        # PcaSvc host PID via service info
        $svc = Get-CimInstance Win32_Service -Filter "Name='PcaSvc'" -ErrorAction SilentlyContinue
        if ($svc) {
            $lines.Add(('    PcaSvc: state={0} pid={1} (svchost hosting the compat-assistant service)' -f $svc.State, $svc.ProcessId))
        }
    } catch {}
    return $lines
}

function Get-RecentChromeScheduledTasks {
    $lines = New-Object System.Collections.Generic.List[string]
    try {
        $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue |
            Where-Object { $_.TaskName -match 'Chrome|Google|Update' }
        foreach ($t in $tasks) {
            $lastRun = ($t | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue).LastRunTime
            $lines.Add(('    [{0}] {1}{2} | last run: {3}' -f $t.State, $t.TaskPath, $t.TaskName, $lastRun))
        }
    } catch {}
    return $lines
}

function Get-RecentCrashEvents {
    param([datetime]$Since)
    $lines = New-Object System.Collections.Generic.List[string]
    try {
        $events = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Id = @(1000, 1001); StartTime = $Since } -ErrorAction SilentlyContinue
        foreach ($e in $events) {
            if ($e.Message -notmatch 'chrome') { continue }
            $mod = if ($e.Message -match 'Faulting module name:\s*([^\r\n,]+)') { $matches[1].Trim() } else { '?' }
            $lines.Add(('    crash event id={0} module={1} at={2}' -f $e.Id, $mod, $e.TimeCreated.ToString('HH:mm:ss.fff')))
        }
    } catch {}
    return $lines
}


# --- Startup -----------------------------------------------------------------
Ensure-LogDir

Write-Log ('=' * 72)
Write-Log ('PCA Store / Layers watcher | admin={0} | lock={1} | poll={2}ms | dur={3}s' -f $isAdmin, $Lock.IsPresent, $PollMs, $DurationSeconds)
Write-Log ('log: {0}' -f $logFile)
Write-Log ('=' * 72)

if (-not $isAdmin) {
    Write-Warn 'Not elevated: SACL audit and Security 4657 attribution unavailable.'
    Write-Warn 'Re-run as Administrator for full process attribution.'
}

# PcaSvc state
$pcaSvcObj = Get-Service -Name $pcaSvcName -ErrorAction SilentlyContinue
Write-Log ('PcaSvc: status={0} startType={1}' -f $pcaSvcObj.Status, $pcaSvcObj.StartType)

# Interesting processes right now
Write-Log 'Chrome-related processes at start:'
foreach ($line in (Get-InterestingProcesses)) { Write-Log $line }

# Google / Chrome scheduled tasks
Write-Log 'Chrome/Google scheduled tasks:'
$schedLines = Get-RecentChromeScheduledTasks
if ($schedLines.Count -eq 0) { Write-Log '    (none found)' }
foreach ($line in $schedLines) { Write-Log $line }

# Recent crash events (last hour)
Write-Log 'Chrome crash events in last 60 minutes:'
$recentCrashes = Get-RecentCrashEvents ([datetime]::Now.AddHours(-1))
if ($recentCrashes.Count -eq 0) {
    Write-Good '    None. (Chrome not crashing recently - PCA Store write-back is NOT crash-driven.)'
} else {
    Write-Warn ('    {0} crash event(s) found - PCA may be reacting to ongoing crashes.' -f $recentCrashes.Count)
    foreach ($c in $recentCrashes) { Write-Log $c }
}

# Current key state + initial snapshot
Write-Log 'Watched key state at start:'
foreach ($k in $watchedKeys) {
    $snap = Get-KeySnapshot $k.PsPath
    $chromeEntries = @($snap.Keys | Where-Object { $chromeRx.IsMatch($_) })
    if ($chromeEntries.Count -gt 0) {
        Write-Warn ('[{0}] {1} chrome.exe entry(s) PRESENT:' -f $k.Label, $chromeEntries.Count)
        foreach ($entry in $chromeEntries) {
            Write-Warn ('    value name: "{0}"  data: {1}' -f $entry, $snap[$entry])
        }
    } else {
        Write-Good ('[{0}] clean (no chrome.exe entries).' -f $k.Label)
    }
    $snapshots[$k.Label] = $snap
}


# --- SACL setup (requires elevation) -----------------------------------------
if ($isAdmin) {
    Write-Log 'Setting registry audit SACLs (SetValue/Success on Everyone)...'
    foreach ($k in $watchedKeys) {
        $ok = Enable-RegistrySacl $k.PsPath $k.Label
        if ($ok) {
            $saclKeys.Add($k.Label)
            Write-Good ('    SACL armed on [{0}]' -f $k.Label)
        }
    }
    if ($saclKeys.Count -gt 0) {
        Write-Good ('Registry auditing enabled. Security event 4657 will name the writing process.')
    }
}


# --- Lock mode: disable PcaSvc -----------------------------------------------
if ($Lock) {
    if (-not $isAdmin) {
        Write-Warn '-Lock requires elevation; skipping PcaSvc disable.'
    } else {
        Write-Log 'LOCK: stopping and disabling PcaSvc...'
        try {
            Stop-Service -Name $pcaSvcName -Force -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $pcaSvcRegPath -Name 'Start' -Value 4 -Type DWord -Force -ErrorAction Stop
            Write-Good 'LOCK: PcaSvc stopped and disabled (StartType=Disabled).'
            Write-Good '      Chrome is unaffected. To re-enable: Set-Service PcaSvc -StartupType Automatic; Start-Service PcaSvc'
        } catch {
            Write-Warn ('LOCK: could not disable PcaSvc: {0}' -f $_.Exception.Message)
        }
    }
}


# --- Poll loop ---------------------------------------------------------------
Write-Log ('-' * 72)
Write-Log ('Watching. Ctrl+C to stop early.')
Write-Log ('-' * 72)

try {
    while ([datetime]::Now -lt $deadline) {
        Start-Sleep -Milliseconds $PollMs
        $checkTime = [datetime]::Now

        foreach ($k in $watchedKeys) {
            $current   = Get-KeySnapshot $k.PsPath
            $prev      = $snapshots[$k.Label]

            # New chrome.exe entries that were absent in the last snapshot
            $newEntries = @($current.Keys | Where-Object {
                $chromeRx.IsMatch($_) -and (-not $prev.ContainsKey($_))
            })

            # Changed entries (same name, different value)
            $changedEntries = @($current.Keys | Where-Object {
                $chromeRx.IsMatch($_) -and $prev.ContainsKey($_) -and ($prev[$_] -ne $current[$_])
            })

            $totalHits = $newEntries.Count + $changedEntries.Count
            if ($totalHits -eq 0) { continue }

            $detectionCount++
            Write-Alert ('=' * 60)
            Write-Alert ('WRITE-BACK #{0} detected in [{1}] at {2}' -f $detectionCount, $k.Label, $checkTime.ToString('HH:mm:ss.fff'))

            foreach ($entry in $newEntries) {
                Write-Alert ('  NEW    value: "{0}" = {1}' -f $entry, $current[$entry])
            }
            foreach ($entry in $changedEntries) {
                Write-Alert ('  CHANGE value: "{0}" was={1} now={2}' -f $entry, $prev[$entry], $current[$entry])
            }

            # Security 4657 attribution (names the writing process from audit log)
            Write-Alert '--- Security 4657 attribution (who wrote this) ---'
            $attrSince    = $checkTime.AddSeconds(-$attrWindowSecs)
            $writerEvents = Get-WriterEvents $attrSince $k.NtFragment
            if ($writerEvents.Count -gt 0) {
                foreach ($we in $writerEvents) { Write-Alert $we }
            } else {
                Write-Alert '    No 4657 events matched.'
                if (-not $isAdmin) {
                    Write-Alert '    -> Run elevated for Security log access.'
                } elseif ($saclKeys -notcontains $k.Label) {
                    Write-Alert '    -> SACL was not set on this key (key may not have existed at start).'
                } else {
                    Write-Alert '    -> Event may have been written before the SACL armed, or Security log overflowed.'
                }
            }

            # Interesting processes at the moment of detection
            Write-Alert '--- Processes running at detection ---'
            foreach ($pline in (Get-InterestingProcesses)) { Write-Alert $pline }

            # Recent Chrome crashes near the write-back
            Write-Alert '--- Chrome crash events near write-back ---'
            $crashes = Get-RecentCrashEvents $checkTime.AddSeconds(-$crashLookbackSecs)
            if ($crashes.Count -gt 0) {
                Write-Alert ('    {0} crash event(s) found near write-back.' -f $crashes.Count)
                Write-Alert '    ROOT CAUSE: Chrome is still crashing -> PcaSvc writes to PCA Store.'
                Write-Alert '    Fix: resolve the Chrome crash first, or use -Lock to disable PcaSvc.'
                foreach ($c in $crashes) { Write-Alert $c }
            } else {
                Write-Alert '    No Chrome crash events. Write-back is NOT crash-triggered.'
                Write-Alert '    ROOT CAUSE: a process is deliberately writing this key (see 4657 above),'
                Write-Alert '    OR PcaSvc is triggered by a Chrome/GoogleUpdate startup (not crash).'
            }

            Write-Alert ('=' * 60)
            $snapshots[$k.Label] = $current
        }
    }
} finally {
    Write-Log ('-' * 72)
    Write-Log ('Watch complete. Total write-back detections: {0}. Log: {1}' -f $detectionCount, $logFile)

    if ($detectionCount -eq 0) {
        Write-Good 'No write-backs observed during this session.'
        Write-Log  '  Tip: launch Chrome during the watch window to trigger any PCA write-back.'
    }

    if ($detectionCount -gt 0 -and -not $Lock) {
        Write-Warn 'To prevent further write-backs (if PcaSvc is confirmed as writer):'
        Write-Warn '  Re-run with: .\watch-pca-store.ps1 -Lock -DurationSeconds 0'
    }
}
