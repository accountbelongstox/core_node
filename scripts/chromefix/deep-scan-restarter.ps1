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
    Deep forensic scan: identify exactly what restarts PcaSvc and writes to the
    PCA Store after fix-chrome-compat-shim.ps1 has disabled PcaSvc.

.DESCRIPTION
    Three instruments run simultaneously:
      1. Autoruns (autorunsc64.exe) -- full persistence snapshot filtered to
         suspicious/unsigned entries. Shows scheduled tasks, services, COM servers,
         drivers, AppInit DLLs and all other auto-start locations.
      2. Process Monitor (Procmon64.exe) -- PML capture of all registry/file/
         process events. Filters in the Python analysis step for:
           - Registry writes to AppCompatFlags\Compatibility Assistant\Store
           - Registry writes to \Services\PcaSvc (start-type change)
           - Process Create chains (services.exe spawning svchost for PcaSvc)
           - Operations by rundll32.exe loading PcaSvc.dll
      3. PcaSvc restart watcher -- polls the service state every 200 ms. On
         detecting a transition from Stopped -> Running, immediately snapshots:
           - All recently created processes (last 5 s) via Win32_Process
           - Security event 4688 (process creation) in that window
           - System event 7036 (service state) for context
    After CaptureSeconds the script stops Procmon, converts the PML to CSV and
    runs the enhanced analyze-procmon-csv.py.

.PARAMETER CaptureSeconds
    How long to capture (default 60). Launch Chrome during this window.

.PARAMETER ChromeExe
    Path to the Chrome executable to launch automatically (optional). When
    omitted, launch Chrome manually during the capture window.

.EXAMPLE
    # Watch with no auto-launch (open Chrome yourself during the 60-second window)
    powershell -ExecutionPolicy Bypass -File .\deep-scan-restarter.ps1

    # Auto-launch the D-drive Chrome and capture for 45 seconds
    powershell -ExecutionPolicy Bypass -File .\deep-scan-restarter.ps1 -CaptureSeconds 45 -ChromeExe 'D:\applications\Chrome\Chrome\Application\chrome.exe'
#>

[CmdletBinding()]
param(
    [int]    $CaptureSeconds = 60,
    [string] $ChromeExe      = ''
)

$ErrorActionPreference = 'Stop'

# --- Configuration (declared at top) ----------------------------------------
$scriptDir        = Split-Path -Parent $MyInvocation.MyCommand.Path
$procmonDir       = 'C:\Users\mpc\Downloads\ProcessMonitor'
$autorunsDir      = 'C:\Users\mpc\Downloads\Autoruns'
$procmon          = Join-Path $procmonDir 'Procmon64.exe'
$autorunsc        = Join-Path $autorunsDir 'autorunsc64.exe'
$pythonExe        = 'D:\.dev_win10\python311\python.exe'
$analyzeScript    = Join-Path $scriptDir 'analyze-procmon-csv.py'
$stamp            = [datetime]::Now.ToString('yyyyMMdd-HHmmss')
$outDir           = Join-Path $scriptDir 'logs'
$pml              = Join-Path $outDir ('restarter_{0}.pml' -f $stamp)
$csv              = Join-Path $outDir ('restarter_{0}.csv' -f $stamp)
$autorunsCsv      = Join-Path $outDir ('autoruns_{0}.csv'  -f $stamp)
$logFile          = Join-Path $outDir ('restarter_{0}.log' -f $stamp)
$pcaSvcName       = 'PcaSvc'
$pollMs           = 200
$attrWindowSecs   = 6
$isAdmin          = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$restartDetected  = $false
$restartTime      = $null
$restartFindings  = New-Object System.Collections.Generic.List[string]

function Write-Log {
    param([string]$Msg, [string]$Color = 'White')
    $line = '[{0}] {1}' -f ([datetime]::Now.ToString('HH:mm:ss.fff')), $Msg
    Write-Host $line -ForegroundColor $Color
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}
function Write-Good  { param([string]$Msg) Write-Log ('[+] {0}' -f $Msg) 'Green'  }
function Write-Warn  { param([string]$Msg) Write-Log ('[!] {0}' -f $Msg) 'Yellow' }
function Write-Alert { param([string]$Msg) Write-Log ('[ALERT] {0}' -f $Msg) 'Red' }


# --- Validate tools ----------------------------------------------------------
if (-not (Test-Path $logFile | Split-Path)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

Write-Log ('=' * 72)
Write-Log ('Deep-scan: PcaSvc restarter investigation | admin={0}' -f $isAdmin)
Write-Log ('out dir: {0}' -f $outDir)
Write-Log ('=' * 72)

foreach ($tool in @($procmon, $autorunsc)) {
    if (-not (Test-Path $tool)) { Write-Warn "Tool not found: $tool (some steps will be skipped)" }
}
if (-not (Test-Path $pythonExe)) {
    $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pythonExe) { Write-Warn "python not found; Procmon CSV analysis will be skipped." }
}


# --- 1) Autoruns snapshot ----------------------------------------------------
Write-Log '--- Step 1: Autoruns full persistence snapshot ---'
if (Test-Path $autorunsc) {
    Write-Log ('Running: {0} /accepteula -a * -c -h > {1}' -f $autorunsc, $autorunsCsv)
    try {
        $out = & $autorunsc /accepteula -a '*' -c -h 2>$null
        $out | Set-Content -LiteralPath $autorunsCsv -Encoding UTF8
        Write-Good ('Autoruns CSV saved: {0}  ({1} lines)' -f $autorunsCsv, $out.Count)

        # Quick analysis: unsigned or suspicious entries
        $suspiciousLines = $out | Select-Object -Skip 1 | ConvertFrom-Csv -ErrorAction SilentlyContinue |
            Where-Object { $_.Signer -notmatch 'Microsoft|Google|NVIDIA|Intel|AMD' -and $_.Enabled -eq 'enabled' }
        Write-Warn ('Unsigned / non-major-vendor autoruns entries: {0}' -f @($suspiciousLines).Count)
        foreach ($entry in ($suspiciousLines | Select-Object -First 40)) {
            Write-Log ('  [{0}] {1} | signer={2} | launch={3}' -f
                $entry.'Entry Location', $entry.Entry, $entry.Signer, $entry.'Launch String')
        }
    } catch {
        Write-Warn ('Autoruns failed: {0}' -f $_.Exception.Message)
    }
} else {
    Write-Warn 'autorunsc64.exe not found; skipping Autoruns step.'
}


# --- 2) Start Procmon capture ------------------------------------------------
Write-Log '--- Step 2: Procmon capture ---'
$procmonRunning = $false
if (Test-Path $procmon) {
    Get-Process -Name 'Procmon64','Procmon','Procmon64a' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $eulaKey = 'HKCU:\Software\Sysinternals\Process Monitor'
    if (-not (Test-Path $eulaKey)) { New-Item -Path $eulaKey -Force | Out-Null }
    New-ItemProperty -Path $eulaKey -Name 'EulaAccepted' -Value 1 -PropertyType DWord -Force | Out-Null
    Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Quiet', '/Minimized', '/BackingFile', $pml)
    Start-Sleep -Seconds 2
    $pmlSize = (Get-Item $pml -ErrorAction SilentlyContinue).Length
    if ($pmlSize -gt 100000) {
        $procmonRunning = $true
        Write-Good ('Procmon armed (backing file: {0} KB)' -f [math]::Round($pmlSize/1KB))
    } else {
        Write-Warn ('Procmon backing file not growing ({0} bytes) -- may be inert.' -f $pmlSize)
    }
} else {
    Write-Warn 'Procmon64.exe not found; skipping Procmon step.'
}


# --- 3) Launch Chrome (optional) ---------------------------------------------
if ($ChromeExe -and (Test-Path $ChromeExe)) {
    Write-Log ('Launching Chrome: {0}' -f $ChromeExe)
    Start-Process -FilePath $ChromeExe
} else {
    Write-Warn ('No -ChromeExe specified or path not found. Open Chrome MANUALLY now within {0} seconds.' -f $CaptureSeconds)
}


# --- 4) PcaSvc restart watcher (runs during capture window) ------------------
Write-Log ('--- Step 3: Watching for PcaSvc restart ({0} s) ---' -f $CaptureSeconds)
$prevStatus  = [string](Get-Service $pcaSvcName -ErrorAction SilentlyContinue).Status
$deadline    = [datetime]::Now.AddSeconds($CaptureSeconds)

while ([datetime]::Now -lt $deadline) {
    Start-Sleep -Milliseconds $pollMs
    $nowStatus = [string](Get-Service $pcaSvcName -ErrorAction SilentlyContinue).Status

    if ($prevStatus -ne 'Running' -and $nowStatus -eq 'Running') {
        $restartTime = [datetime]::Now
        $restartDetected = $true
        Write-Alert ('PcaSvc transitioned {0} -> Running at {1}' -f $prevStatus, $restartTime.ToString('HH:mm:ss.fff'))

        # Snapshot all recently created processes
        $since  = $restartTime.AddSeconds(-$attrWindowSecs)
        $recent = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $ct = $_.CreationDate
                $ct -and [datetime]$ct -gt $since
            } |
            Sort-Object CreationDate
        Write-Alert ('Recently created processes ({0} s window):' -f $attrWindowSecs)
        foreach ($p in $recent) {
            $restartFindings.Add(('  pid={0,-6} created={1}  exe="{2}"  cmd="{3}"' -f
                $p.ProcessId,
                ([datetime]$p.CreationDate).ToString('HH:mm:ss.fff'),
                $p.ExecutablePath,
                ($p.CommandLine -replace '\s+', ' ')))
            Write-Alert $restartFindings[-1]
        }

        # Security 4688 (process creation audit)
        $events4688 = Get-WinEvent -FilterHashtable @{ LogName='Security'; Id=4688; StartTime=$since } -ErrorAction SilentlyContinue
        if ($events4688) {
            Write-Alert ('Security 4688 process-creation events in window: {0}' -f $events4688.Count)
            foreach ($e in ($events4688 | Select-Object -First 20)) {
                $xml  = [xml]$e.ToXml()
                $data = @{}
                foreach ($d in $xml.Event.EventData.Data) { $data[$d.Name] = $d.'#text' }
                $entry = ('  4688 | new="{0}" parent="{1}" cmdline="{2}"' -f
                    $data['NewProcessName'], $data['ParentProcessName'],
                    ($data['CommandLine'] -replace '\s+', ' '))
                $restartFindings.Add($entry)
                Write-Alert $entry
            }
        }

        # System 7036 (service state) context
        $events7036 = Get-WinEvent -FilterHashtable @{ LogName='System'; Id=7036; StartTime=$since } -ErrorAction SilentlyContinue |
            Where-Object { $_.Message -match 'PcaSvc|compat' }
        foreach ($e in $events7036) { Write-Alert ('  7036: {0}' -f $e.Message.Trim()) }
    }
    $prevStatus = $nowStatus
    $elapsed    = [int]($deadline - [datetime]::Now).TotalSeconds
    if ($elapsed % 10 -eq 0 -and $elapsed -gt 0) {
        Write-Log ('  ... {0} s remaining | PcaSvc={1}' -f $elapsed, $nowStatus)
    }
}


# --- 5) Stop Procmon, export CSV, analyze ------------------------------------
Write-Log '--- Step 4: Stop Procmon and analyze ---'
if ($procmonRunning) {
    Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Terminate') -Wait -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Write-Log 'Converting PML to CSV...'
    Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Quiet', '/Minimized', '/OpenLog', $pml, '/SaveAs', $csv) -Wait
    $csvSize = (Get-Item $csv -ErrorAction SilentlyContinue).Length
    Write-Good ('CSV: {0}  ({1} MB)' -f $csv, [math]::Round($csvSize/1MB, 1))

    if ($pythonExe -and (Test-Path $analyzeScript) -and (Test-Path $csv)) {
        Write-Log 'Running analyze-procmon-csv.py (enhanced)...'
        & $pythonExe $analyzeScript $csv $ChromeExe
    }
}


# --- 6) Summary --------------------------------------------------------------
Write-Log ('-' * 72)
Write-Log ('Capture complete. PcaSvc restart detected: {0}' -f $restartDetected)
if ($restartDetected) {
    Write-Alert ('Restart at: {0}' -f $restartTime.ToString('HH:mm:ss.fff'))
    Write-Alert 'Processes near restart (most likely restarter is the one that appeared just before):'
    foreach ($f in $restartFindings) { Write-Alert $f }
} else {
    Write-Good 'PcaSvc did NOT restart during this capture window.'
    Write-Good 'If PCA Store entries are still reappearing, open Chrome within the capture window.'
}
Write-Log ('Artifacts:  PML={0}  CSV={1}  Autoruns={2}  Log={3}' -f $pml, $csv, $autorunsCsv, $logFile)
