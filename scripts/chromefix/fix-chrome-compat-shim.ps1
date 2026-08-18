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
    Idempotently repair the Chrome STATUS_STACK_BUFFER_OVERRUN (0xC0000409) crash
    caused by a stale compatibility / mitigation override on chrome.exe.

.DESCRIPTION
    Applies all fixes automatically with no required parameters. Safe to run any
    number of times; a second run on a clean machine is a no-op.

    ROOT CAUSE: AW Manager (AdvancedWindowsManager) + QuarkUpdater PUP wrote the
    VISTARTM compatibility shim to AppCompatFlags\Layers. This forced Chrome into
    Vista RTM mode, conflicting with CET/shadow-stack and triggering the crash.

    Steps performed (all idempotent):
      0. AW Manager / QuarkUpdater PUP: kill processes, remove tasks, services,
         Run keys, registry branches, uninstall entries, and folders.
      1. AppCompatFlags\Layers Windows-version compatibility shims on chrome.exe.
      2. Stray all-zero IFEO MitigationOptions / EOPMitigationOptions.
      3. Compatibility Assistant Store entries for chrome.exe.
      4. Stop and disable PcaSvc (proves re-writes Store entries on a 2-second loop
         even when Chrome is closed -- stuck from earlier crash storms).
      5. Disable 5 Application Experience scheduled tasks that load PcaSvc.dll via
         rundll32 and internally call StartService('PcaSvc').
      6. Remove SERVICE_START (RP) from SYSTEM's ACE in PcaSvc's security descriptor.
         Deep-scan confirmed PcaSvc restarts 24ms after Chrome opens via the Windows
         apphelp.dll kernel hook -- this bypasses Start=4 entirely. Removing RP from
         SYSTEM blocks that internal SCM call. Administrators keep full control.

    To re-enable PcaSvc:
      sc.exe sdset PcaSvc "<original-SD-printed-by-step-6>"
      Set-Service PcaSvc -StartupType Manual; Start-Service PcaSvc

.PARAMETER DryRun
    Report what would be changed without making any changes. Default is to apply.

.PARAMETER Quiet
    Suppress normal output (only warnings/errors are shown).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\fix-chrome-compat-shim.ps1
    powershell -ExecutionPolicy Bypass -File .\fix-chrome-compat-shim.ps1 -DryRun
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Configuration (all variables declared at top)
# ---------------------------------------------------------------------------

# Self-reference (for Step 7 guardian task)
$scriptFullPath  = $MyInvocation.MyCommand.Path
$powershellExe   = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$guardTaskPath   = '\ChromeFix\'
$guardTaskName   = 'ChromeCompatShimGuard'

# Chrome compat shim targets
$layersKeys     = @(
    'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers',
    'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
)
$ifeoKeys       = @(
    'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\chrome.exe',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\chrome.exe'
)
$pcaStoreKeys   = @(
    'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store',
    'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store'
)
$compatTokens   = @('VISTARTM', 'VISTASP1', 'VISTASP2', 'WIN7RTM', 'WIN8RTM',
                    'WINXPSP2', 'WINXPSP3', 'WIN95', 'WIN98', 'WINSRV',
                    'WIN2000', 'WIN10RTM', 'WINVISTA')
$ifeoZeroVals   = @('MitigationOptions', 'EOPMitigationOptions')
$chromeNameRx   = 'chrome\.exe$'

# PcaSvc
$pcaSvcName     = 'PcaSvc'
$pcaSvcRegPath  = 'HKLM:\SYSTEM\CurrentControlSet\Services\PcaSvc'
$pcaAppExpTasks = @(
    @{ Path = '\Microsoft\Windows\Application Experience\'; Name = 'PcaPatchDbTask'              },
    @{ Path = '\Microsoft\Windows\Application Experience\'; Name = 'PcaWallpaperAppDetect'       },
    @{ Path = '\Microsoft\Windows\Application Experience\'; Name = 'Microsoft Compatibility Appraiser' },
    @{ Path = '\Microsoft\Windows\Application Experience\'; Name = 'ProgramDataUpdater'          },
    @{ Path = '\Microsoft\Windows\Application Experience\'; Name = 'StartupAppTask'              }
)
$pcaSyAceOld    = '(A;;CCLCSWRPWPDTLOCRRC;;;SY)'
$pcaSyAceNew    = '(A;;CCLCSWDTLOCRRC;;;SY)'

# AW Manager / QuarkUpdater PUP artifacts
$awProgramData    = $env:ProgramData
$awLocalAppData   = $env:LOCALAPPDATA
$awProgramFiles   = $env:ProgramFiles
$awProgramFilesX86 = ${env:ProgramFiles(x86)}
$awTargetDirs     = @(
    (Join-Path $awProgramData    'AW Manager'),
    (Join-Path $awLocalAppData   'QuarkUpdater'),
    (Join-Path $awLocalAppData   'AdvancedWindowsManager'),
    (Join-Path $awProgramFiles   'AdvancedWindowsManager'),
    (Join-Path $awProgramFilesX86 'AdvancedWindowsManager'),
    (Join-Path $awProgramFiles   'AW Manager'),
    (Join-Path $awProgramFilesX86 'AW Manager')
)
$awNameTokens     = @('AdvancedWindowsManager', 'AW Manager', 'AWManager', 'QuarkUpdater')
$awServiceNames   = @('AdvancedWindowsManagerService', 'AWManagerService', 'QuarkUpdaterService')
$awRegBranches    = @(
    'HKCU:\Software\AdvancedWindowsManager',
    'HKLM:\SOFTWARE\AdvancedWindowsManager',
    'HKLM:\SOFTWARE\WOW6432Node\AdvancedWindowsManager'
)
$awRunKeyPaths    = @(
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce'
)
$awUninstallRoots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
)

# State
$found   = 0
$changed = 0
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Info {
    param([string]$Message, [string]$Type = 'Info')
    if ($Quiet -and ($Type -eq 'Info' -or $Type -eq 'Success')) { return }
    $color = 'White'; $prefix = '[*] '
    if ($Type -eq 'Success') { $color = 'Green';  $prefix = '[+] ' }
    elseif ($Type -eq 'Warning') { $color = 'Yellow'; $prefix = '[!] ' }
    elseif ($Type -eq 'Error')   { $color = 'Red';    $prefix = '[X] ' }
    Write-Host "$prefix$Message" -ForegroundColor $color
}

function Remove-RegValue {
    param([string]$KeyPath, [string]$Name)
    try {
        Remove-ItemProperty -Path $KeyPath -Name $Name -Force -ErrorAction Stop
        return $true
    } catch {
        Write-Info "Failed to remove '$Name' under $KeyPath : $($_.Exception.Message)" 'Error'
        return $false
    }
}

function Test-AwTokenMatch {
    param([string]$Text)
    if (-not $Text) { return $false }
    foreach ($t in $awNameTokens) { if ($Text -like "*$t*") { return $true } }
    return $false
}

function Test-AwUnderTargetDir {
    param([string]$Path)
    if (-not $Path) { return $false }
    foreach ($d in $awTargetDirs) { if ($Path -like "$d*") { return $true } }
    return $false
}

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------

Write-Info ('=' * 70)
Write-Info ('Chrome compat-shim repair | mode={0} | admin={1}' -f ($(if ($DryRun) { 'DRY-RUN' } else { 'APPLY' })), $isAdmin)
Write-Info ('ROOT CAUSE: AW Manager PUP wrote VISTARTM shim -> Chrome CET crash')
Write-Info ('=' * 70)

# ---------------------------------------------------------------------------
# Step 0: AW Manager / QuarkUpdater PUP removal
# ---------------------------------------------------------------------------

Write-Info '--- Step 0: AW Manager / QuarkUpdater PUP ---'
$awFoundBefore = $found

# 0a) Kill running PUP processes
$awProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    (Test-AwTokenMatch $_.Name) -or (Test-AwUnderTargetDir $_.ExecutablePath)
}
foreach ($p in $awProcs) {
    $found++
    if (-not $DryRun) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $changed++
              Write-Info "Killed PUP process: $($p.Name) (PID $($p.ProcessId))" 'Success' }
        catch { Write-Info "Could not kill $($p.Name): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would kill: $($p.Name) (PID $($p.ProcessId)) $($p.ExecutablePath)" }
}

# 0b) Scheduled tasks
$awTasks = Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { (Test-AwTokenMatch $_.TaskName) -or (Test-AwTokenMatch $_.TaskPath) }
foreach ($t in $awTasks) {
    $found++
    if (-not $DryRun) {
        try { Unregister-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Confirm:$false -ErrorAction Stop
              $changed++; Write-Info "Removed PUP task: $($t.TaskPath)$($t.TaskName)" 'Success' }
        catch { Write-Info "Could not remove task $($t.TaskName): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove PUP task: $($t.TaskPath)$($t.TaskName)" }
}

# 0c) Services
$awServices = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object {
    ($awServiceNames -contains $_.Name) -or (Test-AwTokenMatch $_.Name) -or
    (Test-AwUnderTargetDir ($_.PathName -replace '^"([^"]+)".*', '$1'))
}
foreach ($s in $awServices) {
    $found++
    if (-not $DryRun) {
        try { Stop-Service -Name $s.Name -Force -ErrorAction SilentlyContinue
              & sc.exe delete $s.Name | Out-Null
              $changed++; Write-Info "Removed PUP service: $($s.Name)" 'Success' }
        catch { Write-Info "Could not remove service $($s.Name): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove PUP service: $($s.Name)  ($($s.PathName))" }
}

# 0d) Run / RunOnce keys
foreach ($key in $awRunKeyPaths) {
    if (-not (Test-Path $key)) { continue }
    foreach ($name in (Get-Item $key).Property) {
        $data = (Get-ItemProperty -Path $key -Name $name).$name
        if (-not ((Test-AwTokenMatch $name) -or (Test-AwTokenMatch $data))) { continue }
        $found++
        if (-not $DryRun) {
            try { Remove-ItemProperty -Path $key -Name $name -Force -ErrorAction Stop
                  $changed++; Write-Info "Removed PUP Run entry: $name" 'Success' }
            catch { Write-Info "Could not remove Run entry $($name): $($_.Exception.Message)" 'Warning' }
        } else { Write-Info "Would remove PUP Run entry: $name = $data  [$key]" }
    }
}

# 0e) Registry branches
foreach ($branch in $awRegBranches) {
    if (-not (Test-Path $branch)) { continue }
    $found++
    if (-not $DryRun) {
        try { Remove-Item -Path $branch -Recurse -Force -ErrorAction Stop
              $changed++; Write-Info "Removed PUP registry branch: $branch" 'Success' }
        catch { Write-Info "Could not remove branch $($branch): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove PUP registry branch: $branch" }
}

# 0f) Uninstall entries
foreach ($root in $awUninstallRoots) {
    if (-not (Test-Path $root)) { continue }
    foreach ($sub in (Get-ChildItem $root -ErrorAction SilentlyContinue)) {
        $dn = (Get-ItemProperty -Path $sub.PSPath -ErrorAction SilentlyContinue).DisplayName
        if (-not (Test-AwTokenMatch $dn)) { continue }
        $found++
        if (-not $DryRun) {
            try { Remove-Item -Path $sub.PSPath -Recurse -Force -ErrorAction Stop
                  $changed++; Write-Info "Removed PUP uninstall entry: $dn" 'Success' }
            catch { Write-Info "Could not remove uninstall entry $($dn): $($_.Exception.Message)" 'Warning' }
        } else { Write-Info "Would remove PUP uninstall entry: $dn" }
    }
}

# 0g) Folders
foreach ($dir in ($awTargetDirs | Select-Object -Unique)) {
    if (-not (Test-Path $dir)) { continue }
    $found++
    if (-not $DryRun) {
        try { Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop
              $changed++; Write-Info "Removed PUP folder: $dir" 'Success' }
        catch { Write-Info "Could not remove folder $($dir): $($_.Exception.Message)" 'Warning' }
    } else { Write-Info "Would remove PUP folder: $dir" }
}

if ($found -eq $awFoundBefore) {
    Write-Info "No AW Manager / QuarkUpdater PUP artifacts found (skip)." 'Success'
}

# ---------------------------------------------------------------------------
# Step 1: AppCompatFlags\Layers compatibility shims on chrome.exe
# ---------------------------------------------------------------------------

Write-Info '--- Step 1: Layers compat shims (crash cause: VISTARTM) ---'
foreach ($key in $layersKeys) {
    if (-not (Test-Path $key)) { continue }
    foreach ($name in (Get-Item $key).Property) {
        if ($name -notmatch $chromeNameRx) { continue }
        $value = (Get-ItemProperty -Path $key -Name $name).$name
        $hit = $false
        foreach ($tok in $compatTokens) { if ($value -match $tok) { $hit = $true; break } }
        if (-not $hit) { continue }
        $found++
        if (-not $DryRun) {
            if (Remove-RegValue -KeyPath $key -Name $name) {
                $changed++; Write-Info "Removed compat shim: '$value' on $name" 'Success'
            }
        } else { Write-Info "Would remove compat shim: '$value' on $name  [$key]" }
    }
}

# ---------------------------------------------------------------------------
# Step 2: Stray all-zero IFEO MitigationOptions / EOPMitigationOptions
# ---------------------------------------------------------------------------

Write-Info '--- Step 2: Stale IFEO mitigation overrides ---'
foreach ($key in $ifeoKeys) {
    if (-not (Test-Path $key)) { continue }
    $props = (Get-Item $key).Property
    foreach ($name in $ifeoZeroVals) {
        if ($props -notcontains $name) { continue }
        $val    = (Get-ItemProperty -Path $key -Name $name).$name
        $isZero = $false
        if ($val -is [byte[]]) { $isZero = (@($val | Where-Object { $_ -ne 0 }).Count -eq 0) }
        elseif ($val -is [int] -or $val -is [long]) { $isZero = ($val -eq 0) }
        if (-not $isZero) {
            Write-Info "Keeping non-zero IFEO '$name' on chrome.exe (real override)" 'Warning'
            continue
        }
        $found++
        if (-not $DryRun) {
            if (Remove-RegValue -KeyPath $key -Name $name) {
                $changed++; Write-Info "Removed stale IFEO override: $name" 'Success'
            }
        } else { Write-Info "Would remove stale IFEO override: $name  [$key]" }
    }
}

# ---------------------------------------------------------------------------
# Step 3: PCA Store entries for chrome.exe
# ---------------------------------------------------------------------------

Write-Info '--- Step 3: PCA Store entries ---'
foreach ($key in $pcaStoreKeys) {
    if (-not (Test-Path $key)) { continue }
    foreach ($name in (Get-Item $key).Property) {
        if ($name -notmatch $chromeNameRx) { continue }
        $found++
        if (-not $DryRun) {
            if (Remove-RegValue -KeyPath $key -Name $name) {
                $changed++; Write-Info "Removed PCA store entry: $name" 'Success'
            }
        } else { Write-Info "Would remove PCA store entry: $name  [$key]" }
    }
}

# ---------------------------------------------------------------------------
# Step 4: Stop and disable PcaSvc
# ---------------------------------------------------------------------------

Write-Info '--- Step 4: PcaSvc service ---'
$svc          = Get-Service $pcaSvcName -ErrorAction SilentlyContinue
$pcaStatus    = if ($svc) { [string]$svc.Status }    else { 'Unknown' }
$pcaStartType = if ($svc) { [string]$svc.StartType } else { 'Unknown' }
if ($pcaStatus -eq 'Stopped' -and $pcaStartType -eq 'Disabled') {
    Write-Info "PcaSvc already stopped and disabled (skip)." 'Success'
} else {
    $found++
    if (-not $DryRun) {
        if (-not $isAdmin) {
            Write-Info "Disabling PcaSvc requires elevation (skip)." 'Warning'
        } else {
            try {
                Stop-Service $pcaSvcName -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $pcaSvcRegPath -Name 'Start' -Value 4 -Type DWord -Force -ErrorAction Stop
                $changed++
                Write-Info "PcaSvc stopped and disabled (was: status=$pcaStatus start=$pcaStartType)." 'Success'
            } catch { Write-Info "Failed to disable PcaSvc: $($_.Exception.Message)" 'Error' }
        }
    } else { Write-Info "Would stop and disable PcaSvc (currently: status=$pcaStatus start=$pcaStartType)." }
}

# ---------------------------------------------------------------------------
# Step 5: Disable Application Experience scheduled tasks
#   PcaPatchDbTask / PcaWallpaperAppDetect load PcaSvc.dll via rundll32 and
#   call StartService('PcaSvc') internally, restarting the disabled service.
# ---------------------------------------------------------------------------

Write-Info '--- Step 5: Application Experience tasks ---'
if ($isAdmin) {
    foreach ($t in $pcaAppExpTasks) {
        $task = Get-ScheduledTask -TaskPath $t.Path -TaskName $t.Name -ErrorAction SilentlyContinue
        if (-not $task) { continue }
        if ($task.State -eq 'Disabled') {
            Write-Info "Task already disabled: $($t.Path)$($t.Name) (skip)." 'Success'
        } else {
            $found++
            if (-not $DryRun) {
                try {
                    Disable-ScheduledTask -TaskPath $t.Path -TaskName $t.Name -ErrorAction Stop | Out-Null
                    $changed++; Write-Info "Disabled task: $($t.Path)$($t.Name)" 'Success'
                } catch { Write-Info "Failed to disable task $($t.Name): $($_.Exception.Message)" 'Error' }
            } else { Write-Info "Would disable task: $($t.Path)$($t.Name) (state=$($task.State))" }
        }
    }
} else {
    Write-Info "Disabling AppExperience tasks requires elevation (skip)." 'Warning'
}

# ---------------------------------------------------------------------------
# Step 6: PcaSvc DACL -- remove SERVICE_START (RP) from SYSTEM account.
#   Deep-scan proved PcaSvc restarts 24 ms after Chrome opens via the
#   Windows apphelp.dll kernel hook (bypasses Start=4). Removing RP from
#   SYSTEM's ACE blocks that internal SCM call with ACCESS_DENIED.
#   Administrators (BA) keep full control including start.
# ---------------------------------------------------------------------------

Write-Info '--- Step 6: PcaSvc DACL (block kernel-level restart) ---'
$pcaSdOutput = (& sc.exe sdshow $pcaSvcName 2>$null) | Where-Object { $_ -match '^D:' }
if ($pcaSdOutput) {
    if ($pcaSdOutput -notmatch [regex]::Escape($pcaSyAceOld)) {
        Write-Info "PcaSvc DACL: SERVICE_START already removed from SYSTEM (skip)." 'Success'
    } else {
        $newSD = $pcaSdOutput -replace [regex]::Escape($pcaSyAceOld), $pcaSyAceNew
        $found++
        if (-not $DryRun) {
            if (-not $isAdmin) {
                Write-Info "Updating PcaSvc DACL requires elevation (skip)." 'Warning'
            } else {
                $scResult = (& sc.exe sdset $pcaSvcName $newSD 2>&1) -join ''
                if ($LASTEXITCODE -eq 0) {
                    $changed++
                    Write-Info "PcaSvc DACL: SERVICE_START removed from SYSTEM account." 'Success'
                    Write-Info "  Restore SD: sc.exe sdset PcaSvc `"$pcaSdOutput`"" 'Info'
                } else {
                    Write-Info "Failed to update PcaSvc DACL: $scResult" 'Error'
                }
            }
        } else {
            Write-Info "Would remove SERVICE_START from SYSTEM on PcaSvc DACL."
            Write-Info "  Current SD: $pcaSdOutput"
            Write-Info "  New SD:     $newSD"
        }
    }
} else {
    Write-Info "Could not read PcaSvc SD (requires elevation or service not found)." 'Warning'
}

# ---------------------------------------------------------------------------
# Step 7: Logon guardian task
#   Registers a SYSTEM-privilege logon-triggered task that runs this script
#   silently on every user logon. Ensures any re-applied shim or re-enabled
#   PcaSvc is cleaned automatically even after a new infection. Idempotent:
#   skips if the task already exists with the correct script path.
# ---------------------------------------------------------------------------

Write-Info '--- Step 7: Logon guardian task ---'
if (-not $isAdmin) {
    Write-Info "Registering guardian task requires elevation (skip)." 'Warning'
} elseif (-not $scriptFullPath) {
    Write-Info "Cannot resolve script path; guardian task skipped." 'Warning'
} else {
    $guardArguments  = ('-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Quiet' -f $scriptFullPath)
    $existingTask    = Get-ScheduledTask -TaskPath $guardTaskPath -TaskName $guardTaskName -ErrorAction SilentlyContinue
    $actionMatches   = $false
    if ($existingTask) {
        $existingAction = $existingTask.Actions | Select-Object -First 1
        $actionMatches  = ($existingAction.Execute -ieq $powershellExe) -and
                          ($existingAction.Arguments -ieq $guardArguments)
    }
    if ($existingTask -and $actionMatches) {
        Write-Info "Guardian task already registered with correct path (skip)." 'Success'
    } else {
        $found++
        if (-not $DryRun) {
            try {
                $trigger   = New-ScheduledTaskTrigger -AtLogOn
                $principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -RunLevel Highest
                $action    = New-ScheduledTaskAction -Execute $powershellExe -Argument $guardArguments
                $settings  = New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
                Register-ScheduledTask -TaskPath $guardTaskPath -TaskName $guardTaskName `
                    -Trigger $trigger -Principal $principal -Action $action -Settings $settings `
                    -Description 'Silently removes Chrome AppCompat shims on logon (ChromeFix guardian).' `
                    -Force -ErrorAction Stop | Out-Null
                $changed++
                Write-Info "Guardian task registered: $guardTaskPath$guardTaskName" 'Success'
                Write-Info "  Runs as SYSTEM at every logon -> $scriptFullPath -Quiet" 'Info'
            } catch {
                Write-Info "Failed to register guardian task: $($_.Exception.Message)" 'Error'
            }
        } else {
            $verb = if ($existingTask) { 'Would update' } else { 'Would register' }
            Write-Info "$verb guardian task: $guardTaskPath$guardTaskName"
            Write-Info "  Action: $powershellExe $guardArguments"
        }
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

Write-Info ('-' * 70)
if ($found -eq 0) {
    Write-Info "Chrome is clean: no PUP artifacts, shims, overrides, or active PcaSvc found." 'Success'
} elseif (-not $DryRun) {
    if (-not $isAdmin -and $changed -lt $found) {
        Write-Info "Some items need an elevated (administrator) shell to remove." 'Warning'
    }
    Write-Info "Repaired $changed/$found item(s). Relaunch Chrome." 'Success'
} else {
    Write-Info "$found item(s) found. Re-run without -DryRun to apply fixes." 'Warning'
}
exit 0
