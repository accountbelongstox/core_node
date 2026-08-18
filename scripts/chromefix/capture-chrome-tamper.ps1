<#
.SYNOPSIS
    Reproduce the D-drive Chrome STATUS_STACK_BUFFER_OVERRUN crash under three
    instruments at once and capture which process/DLL tampers with it.

.DESCRIPTION
    Hypothesis under test: a resident process watches for a chrome.exe launched
    from a path OTHER than C:\Program Files\..., and on seeing the D-drive Chrome
    either rewrites its config (Secure Preferences / Preferences / Local State)
    or injects a DLL into it, causing the crash after the first page renders.

    Instruments (all require an elevated shell):
      1. Process Monitor (Sysinternals) -> full file/registry/process/image trace.
      2. File-system auditing (auditpol + SACL) -> Security 4663 names the writer
         of the three Chrome config files.
      3. Live loaded-module snapshots of the D-drive chrome processes -> any
         foreign (non-Chrome, non-Windows) DLL mapped into the browser.

    Output goes to a timestamped folder; analyze capture.csv with
    analyze-procmon-csv.py.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\capture-chrome-tamper.ps1
    powershell -ExecutionPolicy Bypass -File .\capture-chrome-tamper.ps1 -ChromeExe 'D:\applications\Chrome\Chrome\Application\chrome.exe' -CaptureSeconds 18
#>

[CmdletBinding()]
param(
    [string]$ChromeExe = 'D:\applications\Chrome\Chrome\Application\chrome.exe',
    [int]$CaptureSeconds = 18,
    [string]$Url = '',
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'

# --- Configuration (declared at top) ----------------------------------------
$stamp        = Get-Date -Format 'yyyyMMdd-HHmmss'
$procmonDir   = 'C:\Users\mpc\Downloads\ProcessMonitor'
$procmon      = Join-Path $procmonDir 'Procmon64.exe'
$userData     = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
$configFiles  = @(
    (Join-Path $userData 'Default\Secure Preferences'),
    (Join-Path $userData 'Default\Preferences'),
    (Join-Path $userData 'Local State')
)
$chromeRoots  = @('C:\Program Files\Google\Chrome', 'D:\applications\Chrome', 'D:\applications\Chrome Beta')
$auditRule    = $null
$preState     = @{}
$foreignMods  = New-Object 'System.Collections.Generic.HashSet[string]'
$startTime    = $null

if (-not $OutDir) { $OutDir = Join-Path $env:TEMP "chrome_tamper_$stamp" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$pml = Join-Path $OutDir 'capture.pml'
$csv = Join-Path $OutDir 'capture.csv'

function Test-ForeignModule {
    param([string]$Path)
    if (-not $Path) { return $false }
    if ($Path -like "$env:WINDIR*") { return $false }
    foreach ($r in $chromeRoots) { if ($Path -like "$r*") { return $false } }
    return $true
}

if (-not (Test-Path $procmon)) { throw "Procmon64.exe not found at $procmon" }
if (-not (Test-Path $ChromeExe)) { throw "Chrome not found at $ChromeExe" }

# Pre-clean: kill any stale ProcMon, accept its EULA (so /Quiet does not stall),
# and close leftover instances of the target Chrome for a clean reproduction.
Write-Host "Pre-clean: stopping stale Procmon / target Chrome..."
Get-Process -Name 'Procmon', 'Procmon64', 'Procmon64a' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Terminate') -Wait -ErrorAction SilentlyContinue
$eulaKey = 'HKCU:\Software\Sysinternals\Process Monitor'
if (-not (Test-Path $eulaKey)) { New-Item -Path $eulaKey -Force | Out-Null }
New-ItemProperty -Path $eulaKey -Name 'EulaAccepted' -Value 1 -PropertyType DWord -Force | Out-Null
Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -eq $ChromeExe } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# 0) Generate a local page so a real renderer spins up without needing network
if (-not $Url) {
    $testHtml = Join-Path $OutDir 'render_test.html'
    $html = '<!doctype html><html><head><meta charset="utf-8"><title>render-test</title></head>' +
            '<body><h1>render test</h1><canvas id="c" width="320" height="160"></canvas>' +
            '<script>var x=document.getElementById("c").getContext("2d");x.fillRect(10,10,100,100);' +
            'for(var i=0;i<3000;i++){var d=document.createElement("div");d.textContent="row "+i;document.body.appendChild(d);}' +
            'document.title="rendered";</script></body></html>'
    Set-Content -LiteralPath $testHtml -Value $html -Encoding UTF8
    $Url = 'file:///' + ($testHtml -replace '\\', '/')
}

Write-Host ('=' * 78)
Write-Host "Chrome tamper capture | out=$OutDir"
Write-Host "Target : $ChromeExe"
Write-Host "Page   : $Url"
Write-Host ('=' * 78)

# 1) Enable file-system auditing on the three config files
try {
    auditpol /set /subcategory:"File System" /success:enable /failure:disable | Out-Null
    $auditRule = New-Object System.Security.AccessControl.FileSystemAuditRule(
        'Everyone', 'Write,Delete', 'Success')
    foreach ($f in $configFiles) {
        if (Test-Path $f) {
            $acl = Get-Acl -Path $f -Audit
            $acl.AddAuditRule($auditRule) | Out-Null
            Set-Acl -Path $f -AclObject $acl
        }
    }
    Write-Host "Auditing enabled on config files."
} catch {
    Write-Host "WARN: could not enable auditing: $($_.Exception.Message)"
}

$startTime = Get-Date
foreach ($f in $configFiles) { if (Test-Path $f) { $preState[$f] = (Get-Item $f).LastWriteTime } }

# 2) Start Process Monitor capturing to a backing file, then VERIFY it armed
Write-Host "Starting Process Monitor capture..."
Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Quiet', '/Minimized', '/BackingFile', $pml)
$armed = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    $sz = (Get-Item $pml -ErrorAction SilentlyContinue).Length
    if ($sz -gt 200000) { $armed = $true; Write-Host "  ProcMon armed (backing file growing: $([math]::Round($sz/1KB)) KB)"; break }
}
if (-not $armed) {
    Write-Host "  WARN: ProcMon backing file did not grow ($((Get-Item $pml -ErrorAction SilentlyContinue).Length) bytes) — capture may be inert."
}

# 3) Launch the suspect Chrome at the local page (real profile)
Write-Host "Launching Chrome..."
Start-Process -FilePath $ChromeExe -ArgumentList @('--new-window', $Url)

# 4) Watch for CaptureSeconds: snapshot modules + detect crash
$deadline = (Get-Date).AddSeconds($CaptureSeconds)
$crashed = $false
while ((Get-Date) -lt $deadline) {
    $procs = Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.ExecutablePath -eq $ChromeExe }
    foreach ($pp in ($procs | Select-Object -First 8)) {
        try {
            (Get-Process -Id $pp.ProcessId -ErrorAction Stop).Modules | ForEach-Object {
                if (Test-ForeignModule $_.FileName) { [void]$foreignMods.Add($_.FileName) }
            }
        } catch {}
    }
    Start-Sleep -Milliseconds 900
}

# 5) Stop Process Monitor and finalize the log; close leftover target Chrome
Write-Host "Stopping Process Monitor..."
Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Terminate') -Wait
for ($i = 0; $i -lt 15; $i++) {
    if (-not (Get-Process -Name 'Procmon64' -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Seconds 1
}
Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -eq $ChromeExe } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$pmlSize = (Get-Item $pml -ErrorAction SilentlyContinue).Length
Write-Host "  Backing file final size: $([math]::Round($pmlSize/1MB,2)) MB"

# 6) Convert the binary log to CSV for scripted analysis
Write-Host "Converting capture to CSV (this can take a minute)..."
Start-Process -FilePath $procmon -ArgumentList @('/AcceptEula', '/Quiet', '/Minimized', '/OpenLog', $pml, '/SaveAs', $csv) -Wait

# 7) Quick on-the-spot findings ----------------------------------------------
Write-Host ''
Write-Host ('#' * 78)
Write-Host '# QUICK FINDINGS'
Write-Host ('#' * 78)

Write-Host ''
Write-Host '## A. Foreign DLLs mapped into the suspect Chrome (injection check)'
if ($foreignMods.Count -eq 0) { Write-Host '  none observed' }
else { $foreignMods | Sort-Object | ForEach-Object { Write-Host "  $_" } }

Write-Host ''
Write-Host '## B. Config files rewritten during the window + auditor (4663) attribution'
foreach ($f in $configFiles) {
    if (Test-Path $f) {
        $now = (Get-Item $f).LastWriteTime
        $changed = ($preState[$f] -ne $now)
        Write-Host ("  {0} : changed={1} (pre={2} post={3})" -f (Split-Path $f -Leaf), $changed, $preState[$f], $now)
    }
}
Write-Host '  -- Security 4663 write events on those files --'
try {
    $names = $configFiles | ForEach-Object { Split-Path $_ -Leaf } | Select-Object -Unique
    Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4663; StartTime=$startTime} -ErrorAction SilentlyContinue |
        Where-Object { $m = $_.Message; ($names | Where-Object { $m -match [regex]::Escape($_) }) } |
        Select-Object -First 30 | ForEach-Object {
            $procName = if ($_.Message -match 'Process Name:\s+(.+)') { $matches[1].Trim() } else { '?' }
            $objName = if ($_.Message -match 'Object Name:\s+(.+)') { $matches[1].Trim() } else { '?' }
            Write-Host ("    {0}  proc={1}  -> {2}" -f $_.TimeCreated.ToString('HH:mm:ss'), $procName, $objName)
        }
} catch { Write-Host "    (could not read Security log: $($_.Exception.Message))" }

Write-Host ''
Write-Host '## C. Crash events during the window'
Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000,1001; StartTime=$startTime} -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match 'chrome' } |
    Select-Object -First 8 | ForEach-Object {
        $mod = if ($_.Message -match 'Faulting module name: ([^,]+)') { $matches[1] } elseif ($_.Message -match 'P4: (\S+)') { $matches[1] } else { '?' }
        Write-Host ("  {0}  id={1}  module={2}" -f $_.TimeCreated.ToString('HH:mm:ss'), $_.Id, $mod)
    }

# 8) Cleanup auditing SACLs (leave the rest in place)
try {
    foreach ($f in $configFiles) {
        if (Test-Path $f) {
            $acl = Get-Acl -Path $f -Audit
            $acl.GetAuditRules($true, $false, [System.Security.Principal.NTAccount]) | ForEach-Object { $acl.RemoveAuditRule($_) | Out-Null }
            Set-Acl -Path $f -AclObject $acl
        }
    }
} catch {}

Write-Host ''
Write-Host ('=' * 78)
Write-Host "Artifacts:"
Write-Host "  PML : $pml"
Write-Host "  CSV : $csv  ($( if (Test-Path $csv) { [math]::Round((Get-Item $csv).Length/1MB,1) } else { 0 } ) MB)"
Write-Host "Next: python analyze-procmon-csv.py `"$csv`" `"$ChromeExe`""
Write-Host ('=' * 78)
