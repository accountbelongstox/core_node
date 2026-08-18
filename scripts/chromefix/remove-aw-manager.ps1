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
    Idempotently remove the "AW Manager" / AdvancedWindowsManager + QuarkUpdater
    PUP bundle (the source of the Chrome Vista compatibility shim).

.DESCRIPTION
    Applies all removals automatically with no required parameters. Safe to run
    any number of times; a second run on a clean machine is a no-op.

    Evidence (updates.aiu) identifies "AW Manager" as AdvancedWindowsManager, a
    PUP/adware updater that silent-installs from a sketchy domain and runs elevated;
    bundled with QuarkUpdater. It is the most likely source of the machine-wide
    AppCompat Vista shim that broke Chrome. This script removes its processes,
    scheduled tasks, services, Run-key entries, registry branches and folders.

.PARAMETER DryRun
    Report what would be removed without making any changes. Default is to apply.

.PARAMETER Quiet
    Suppress normal output (only warnings/errors are shown). For the install hook.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\remove-aw-manager.ps1
    powershell -ExecutionPolicy Bypass -File .\remove-aw-manager.ps1 -DryRun
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# --- Configuration (declared at top) ----------------------------------------
$programData     = $env:ProgramData
$localAppData    = $env:LOCALAPPDATA
$programFiles    = $env:ProgramFiles
$programFilesX86 = ${env:ProgramFiles(x86)}
$targetDirs      = @(
    (Join-Path $programData   'AW Manager'),
    (Join-Path $localAppData  'QuarkUpdater'),
    (Join-Path $localAppData  'AdvancedWindowsManager'),
    (Join-Path $programFiles  'AdvancedWindowsManager'),
    (Join-Path $programFilesX86 'AdvancedWindowsManager'),
    (Join-Path $programFiles  'AW Manager'),
    (Join-Path $programFilesX86 'AW Manager')
)
$nameTokens      = @('AdvancedWindowsManager', 'AW Manager', 'AWManager', 'QuarkUpdater')
$serviceNames    = @('AdvancedWindowsManagerService', 'AWManagerService', 'QuarkUpdaterService')
$regBranches     = @(
    'HKCU:\Software\AdvancedWindowsManager',
    'HKLM:\SOFTWARE\AdvancedWindowsManager',
    'HKLM:\SOFTWARE\WOW6432Node\AdvancedWindowsManager'
)
$runKeyPaths     = @(
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce'
)
$uninstallRoots  = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
)
$found           = 0
$changed         = 0
$isAdmin         = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

function Write-Info {
    param([string]$Message, [string]$Type = 'Info')
    if ($Quiet -and ($Type -eq 'Info' -or $Type -eq 'Success')) { return }
    $color = 'White'; $prefix = '[*] '
    if ($Type -eq 'Success') { $color = 'Green'; $prefix = '[+] ' }
    elseif ($Type -eq 'Warning') { $color = 'Yellow'; $prefix = '[!] ' }
    elseif ($Type -eq 'Error') { $color = 'Red'; $prefix = '[X] ' }
    Write-Host "$prefix$Message" -ForegroundColor $color
}

function Test-TokenMatch {
    param([string]$Text)
    if (-not $Text) { return $false }
    foreach ($t in $nameTokens) { if ($Text -like "*$t*") { return $true } }
    return $false
}

function Test-UnderTargetDir {
    param([string]$Path)
    if (-not $Path) { return $false }
    foreach ($d in $targetDirs) { if ($Path -like "$d*") { return $true } }
    return $false
}

Write-Info ('=' * 70)
Write-Info ("Remove AW Manager / Quark PUP | mode={0} | admin={1}" -f ($(if ($DryRun) { 'DRY-RUN' } else { 'APPLY' })), $isAdmin)
Write-Info ('=' * 70)

# 1) Terminate running PUP processes (by name token or image under a target dir).
$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    (Test-TokenMatch $_.Name) -or (Test-UnderTargetDir $_.ExecutablePath)
}
foreach ($p in $procs) {
    $found++
    if (-not $DryRun) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $changed++; Write-Info "Killed process: $($p.Name) (PID $($p.ProcessId))" 'Success' }
        catch { Write-Info "Could not kill $($p.Name): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would kill process: $($p.Name) (PID $($p.ProcessId)) $($p.ExecutablePath)" }
}

# 2) Scheduled tasks.
$tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { (Test-TokenMatch $_.TaskName) -or (Test-TokenMatch $_.TaskPath) }
foreach ($t in $tasks) {
    $found++
    if (-not $DryRun) {
        try { Unregister-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Confirm:$false -ErrorAction Stop; $changed++; Write-Info "Removed scheduled task: $($t.TaskPath)$($t.TaskName)" 'Success' }
        catch { Write-Info "Could not remove task $($t.TaskName): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove scheduled task: $($t.TaskPath)$($t.TaskName)" }
}

# 3) Services (known names + any service whose binary is under a target dir).
$services = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object {
    ($serviceNames -contains $_.Name) -or (Test-TokenMatch $_.Name) -or (Test-UnderTargetDir ($_.PathName -replace '^"([^"]+)".*', '$1'))
}
foreach ($s in $services) {
    $found++
    if (-not $DryRun) {
        try {
            Stop-Service -Name $s.Name -Force -ErrorAction SilentlyContinue
            & sc.exe delete $s.Name | Out-Null
            $changed++; Write-Info "Removed service: $($s.Name)" 'Success'
        } catch { Write-Info "Could not remove service $($s.Name): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove service: $($s.Name)  ($($s.PathName))" }
}

# 4) Run / RunOnce key entries (value name or data matching a token).
foreach ($key in $runKeyPaths) {
    if (-not (Test-Path $key)) { continue }
    foreach ($name in (Get-Item $key).Property) {
        $data = (Get-ItemProperty -Path $key -Name $name).$name
        if (-not ((Test-TokenMatch $name) -or (Test-TokenMatch $data))) { continue }
        $found++
        if (-not $DryRun) {
            try { Remove-ItemProperty -Path $key -Name $name -Force -ErrorAction Stop; $changed++; Write-Info "Removed Run entry: $name" 'Success' }
            catch { Write-Info "Could not remove Run entry $($name): $($_.Exception.Message)" 'Warning' }
        } else { Write-Info "Would remove Run entry: $name = $data  [$key]" }
    }
}

# 5) Registry branches.
foreach ($branch in $regBranches) {
    if (-not (Test-Path $branch)) { continue }
    $found++
    if (-not $DryRun) {
        try { Remove-Item -Path $branch -Recurse -Force -ErrorAction Stop; $changed++; Write-Info "Removed registry branch: $branch" 'Success' }
        catch { Write-Info "Could not remove branch $($branch): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove registry branch: $branch" }
}

# 6) Uninstall entries whose DisplayName matches a token.
foreach ($root in $uninstallRoots) {
    if (-not (Test-Path $root)) { continue }
    foreach ($sub in (Get-ChildItem $root -ErrorAction SilentlyContinue)) {
        $dn = (Get-ItemProperty -Path $sub.PSPath -ErrorAction SilentlyContinue).DisplayName
        if (-not (Test-TokenMatch $dn)) { continue }
        $found++
        if (-not $DryRun) {
            try { Remove-Item -Path $sub.PSPath -Recurse -Force -ErrorAction Stop; $changed++; Write-Info "Removed uninstall entry: $dn" 'Success' }
            catch { Write-Info "Could not remove uninstall entry $($dn): $($_.Exception.Message)" 'Warning' }
        } else { Write-Info "Would remove uninstall entry: $dn" }
    }
}

# 7) Folders.
foreach ($dir in ($targetDirs | Select-Object -Unique)) {
    if (-not (Test-Path $dir)) { continue }
    $found++
    if (-not $DryRun) {
        try { Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop; $changed++; Write-Info "Removed folder: $dir" 'Success' }
        catch { Write-Info "Could not remove folder $($dir): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove folder: $dir" }
}

Write-Info ('-' * 70)
if ($found -eq 0) {
    Write-Info "No AW Manager / Quark PUP artifacts found (skip)." 'Success'
} elseif (-not $DryRun) {
    if (-not $isAdmin -and $changed -lt $found) { Write-Info "Some items need an elevated (administrator) shell to remove." 'Warning' }
    Write-Info "Removed $changed/$found artifact(s)." 'Success'
} else {
    Write-Info "$found artifact(s) found. Re-run without -DryRun to remove." 'Warning'
}
exit 0
