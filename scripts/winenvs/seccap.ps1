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
    Capture system activity with Sysinternals Process Monitor for N seconds and
    convert it to CSV, then print a quick operation summary.

.DESCRIPTION
    Headless wrapper around Procmon (installed by Step32_InstallSecurityTools).
    Pre-kills any stale Procmon, runs a fixed-duration backing-file capture,
    terminates it, converts the .pml log to .csv, and prints the top operations
    (optionally filtered to a process name). Use it to see what a suspicious
    process actually touches on disk / in the registry.

    Idempotent: it cleans its own temp .pml before each run. Requires an elevated
    shell (Procmon needs administrator rights to load its driver).

.EXAMPLE
    seccap.ps1 -Seconds 20
    seccap.ps1 -Seconds 30 -ProcessName chrome.exe
    seccap.ps1 -Seconds 15 -OutCsv D:\.tmp\capture.csv
#>

[CmdletBinding()]
param(
    [int]$Seconds = 20,
    [string]$ProcessName,
    [string]$OutCsv
)

$ErrorActionPreference = 'Stop'

# --- Configuration (declared at top) ----------------------------------------
$procmonName  = 'Procmon.exe'
$candidateDirs = @(
    (Join-Path $env:SystemDrive '.dev_win10\Sysinternals'),
    'D:\.dev_win10\Sysinternals',
    'D:\.dev_win11\Sysinternals',
    'C:\.dev_win10\Sysinternals'
)
$workDir   = Join-Path $env:TEMP 'seccap'
$pmlPath   = Join-Path $workDir 'seccap.pml'
$csvPath   = if ($OutCsv) { $OutCsv } else { Join-Path $workDir 'seccap.csv' }
$eulaKey   = 'HKCU:\Software\Sysinternals\Process Monitor'
$procmonExe = $null
$isAdmin   = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

function Write-Line {
    param([string]$Message, [string]$Color = 'Gray')
    Write-Host $Message -ForegroundColor $Color
}

function Resolve-Procmon {
    $cmd = Get-Command $procmonName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($dir in $candidateDirs) {
        $candidate = Join-Path $dir $procmonName
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

$procmonExe = Resolve-Procmon
if (-not $procmonExe) {
    Write-Line "Procmon not found. Run the installer (Step32_InstallSecurityTools) first." 'Red'
    exit 1
}
if (-not $isAdmin) {
    Write-Line "Procmon requires an elevated (administrator) shell. Re-run as admin." 'Red'
    exit 1
}

if (-not (Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir -Force | Out-Null }

# Pre-accept EULA so the GUI dialog never blocks the capture.
if (-not (Test-Path $eulaKey)) { New-Item -Path $eulaKey -Force | Out-Null }
Set-ItemProperty -Path $eulaKey -Name 'EulaAccepted' -Value 1 -Type DWord

# Kill any stale Procmon and clean the previous backing file (idempotent).
Get-Process -Name 'Procmon', 'Procmon64' -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch { }
}
& $procmonExe /Terminate 2>$null | Out-Null
foreach ($f in @($pmlPath, $csvPath)) { if (Test-Path $f) { Remove-Item -Path $f -Force -ErrorAction SilentlyContinue } }

Write-Line ('=' * 78) 'Cyan'
Write-Line ("seccap | procmon='{0}' | seconds={1} | filter='{2}'" -f $procmonExe, $Seconds, $(if ($ProcessName) { $ProcessName } else { '(none)' })) 'Cyan'

# Start the capture into a backing file, wait, then terminate cleanly.
Write-Line "Starting capture..." 'Yellow'
Start-Process -FilePath $procmonExe -ArgumentList '/AcceptEula', '/Quiet', '/Minimized', '/BackingFile', $pmlPath | Out-Null

$elapsed = 0
while ($elapsed -lt $Seconds) {
    Start-Sleep -Seconds 1
    $elapsed++
    Write-Host ("`r  capturing... {0}/{1}s" -f $elapsed, $Seconds) -NoNewline
}
Write-Host ""

Write-Line "Stopping capture..." 'Yellow'
& $procmonExe /Terminate 2>$null | Out-Null
Start-Sleep -Seconds 2

if (-not (Test-Path $pmlPath)) {
    Write-Line "Capture produced no log file." 'Red'
    exit 1
}

# Convert the binary log to CSV for downstream parsing.
Write-Line "Converting to CSV..." 'Yellow'
& $procmonExe /OpenLog $pmlPath /SaveAs $csvPath 2>$null | Out-Null
Start-Sleep -Seconds 2

if (-not (Test-Path $csvPath)) {
    Write-Line "CSV conversion failed." 'Red'
    exit 1
}

Write-Line ("CSV written: {0}" -f $csvPath) 'Green'

# Quick summary: top operations (optionally filtered to a process name).
try {
    $rows = Import-Csv -Path $csvPath -ErrorAction Stop
    if ($ProcessName) {
        $rows = $rows | Where-Object { $_.'Process Name' -like "*$ProcessName*" }
    }
    Write-Line ('-' * 78) 'DarkCyan'
    Write-Line ("Events: {0}" -f $rows.Count) 'White'
    Write-Line "Top operations:" 'Yellow'
    $rows | Group-Object Operation | Sort-Object Count -Descending | Select-Object -First 12 | ForEach-Object {
        Write-Line ("  {0,7}  {1}" -f $_.Count, $_.Name)
    }
} catch {
    Write-Line "Could not summarize CSV (open it manually): $($_.Exception.Message)" 'DarkYellow'
}

Write-Line ('=' * 78) 'Cyan'
exit 0
