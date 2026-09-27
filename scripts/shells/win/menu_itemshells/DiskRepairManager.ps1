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
    Disk Repair Menu
.DESCRIPTION
    Scans fixed drives (C:, D: ...) and runs "chkdsk <Drive>: /f" on one drive or on all drives.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:CHKDSK_EXE = Join-Path (Join-Path $env:SystemRoot "System32") "chkdsk.exe"
$script:SESSION_MANAGER_KEY = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager"
$script:SUPPORTED_FILE_SYSTEMS = @("NTFS", "FAT", "FAT32", "exFAT")
$script:FIXED_DRIVE_TYPE = 3
$script:CHKDSK_EXIT_MESSAGES = @{
    0 = "No errors were found"
    1 = "Errors were found and fixed"
    2 = "Disk cleanup was performed"
    3 = "The drive could not be checked or errors could not be fixed"
}

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")

$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Helper Functions
function Get-RepairableDrives {
    $pageFileDrives = @(Get-CimInstance Win32_PageFileUsage | ForEach-Object { Split-Path $_.Name -Qualifier })
    $volumes = @(Get-CimInstance Win32_Volume | Where-Object {
        $_.DriveLetter -and ([int]$_.DriveType -eq $script:FIXED_DRIVE_TYPE) -and ($script:SUPPORTED_FILE_SYSTEMS -contains $_.FileSystem)
    } | Sort-Object DriveLetter)

    foreach ($volume in $volumes) {
        [PSCustomObject]@{
            Drive          = $volume.DriveLetter
            Label          = [string]$volume.Label
            FileSystem     = $volume.FileSystem
            SizeGB         = [math]::Round($volume.Capacity / 1GB, 1)
            FreeGB         = [math]::Round($volume.FreeSpace / 1GB, 1)
            Dirty          = [bool]$volume.DirtyBitSet
            IsWindowsDrive = ($volume.DriveLetter -eq $env:SystemDrive)
            HasPageFile    = ($pageFileDrives -contains $volume.DriveLetter)
        }
    }
}

function Get-DriveNotes {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$DriveInfo
    )

    $notes = @(
        if ($DriveInfo.IsWindowsDrive) { "Windows drive" }
        if ($DriveInfo.HasPageFile) { "page file" }
        if ($DriveInfo.Dirty) { "dirty" }
    )
    return ($notes -join ", ")
}

function Test-DriveRepairScheduled {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    $schedulePattern = '^autocheck\s+autochk\b.*{0}' -f [regex]::Escape(('\??\{0}' -f $Drive))
    $bootExecute = @((Get-ItemProperty -Path $script:SESSION_MANAGER_KEY -Name "BootExecute").BootExecute)

    return (@($bootExecute | Where-Object { $_ -match $schedulePattern }).Count -gt 0)
}

function Select-RepairTargets {
    param(
        [Parameter(Mandatory = $true)] [object[]]$Drives
    )

    $allDriveNames = ($Drives | ForEach-Object { $_.Drive }) -join " "
    $menuItems = @(
        @{ Text = ("All drives ({0})" -f $allDriveNames); Targets = $Drives }
        foreach ($driveInfo in $Drives) {
            @{
                Text    = ("{0,-4}{1,-16}{2,-7}{3,10} GB{4,10} GB free  {5}" -f $driveInfo.Drive, $driveInfo.Label, $driveInfo.FileSystem, $driveInfo.SizeGB, $driveInfo.FreeGB, (Get-DriveNotes -DriveInfo $driveInfo))
                Targets = @($driveInfo)
            }
        }
        @{ Text = "Back"; Targets = @() }
    )
    $selectedIndex = 0

    while ($true) {
        Clear-Host
        Write-Host ""
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-ColorMessage -Message "   Disk Repair (chkdsk <Drive>: /f)" -Type "Info"
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host ""

        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host -NoNewline "  > " -ForegroundColor $script:COLOR_HIGHLIGHT
                Write-Host $menuItems[$i].Text -ForegroundColor Black -BackgroundColor White
            } else {
                Write-Host "    $($menuItems[$i].Text)"
            }
        }

        Write-Host ""
        Write-Host "Use arrow keys to navigate, Enter to select, Esc to go back" -ForegroundColor $script:COLOR_HIGHLIGHT

        switch ([Console]::ReadKey($true).Key) {
            'UpArrow'   { if ($selectedIndex -gt 0) { $selectedIndex-- } else { $selectedIndex = $menuItems.Count - 1 } }
            'DownArrow' { if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex++ } else { $selectedIndex = 0 } }
            'Enter'     { return $menuItems[$selectedIndex].Targets }
            'Escape'    { return }
        }
    }
}

function Invoke-DriveRepair {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$DriveInfo
    )

    Write-Host ""
    Write-ColorMessage -Message ("chkdsk {0} /f" -f $DriveInfo.Drive) -Type "Info"
    $process = Start-Process -FilePath $script:CHKDSK_EXE -ArgumentList @($DriveInfo.Drive, "/f") -WorkingDirectory $env:SystemRoot -NoNewWindow -Wait -PassThru

    return [PSCustomObject]@{
        Drive    = $DriveInfo.Drive
        ExitCode = $process.ExitCode
        Pending  = (Test-DriveRepairScheduled -Drive $DriveInfo.Drive)
    }
}

function Show-RepairResults {
    param(
        [Parameter(Mandatory = $true)] [object[]]$Results
    )

    Write-Host ""
    Write-ColorMessage -Message "========================================" -Type "Info"
    foreach ($result in $Results) {
        if ($result.Pending) {
            Write-ColorMessage -Message ("{0} will be checked and repaired at the next restart" -f $result.Drive) -Type "Warning"
        } elseif ($script:CHKDSK_EXIT_MESSAGES.ContainsKey($result.ExitCode)) {
            $type = if ($result.ExitCode -le 2) { "Success" } else { "Error" }
            Write-ColorMessage -Message ("{0} {1} (chkdsk exit code {2})" -f $result.Drive, $script:CHKDSK_EXIT_MESSAGES[$result.ExitCode], $result.ExitCode) -Type $type
        } else {
            Write-ColorMessage -Message ("{0} chkdsk exit code {1}" -f $result.Drive, $result.ExitCode) -Type "Error"
        }
    }
    Write-ColorMessage -Message "========================================" -Type "Info"
}

function Request-RepairRestart {
    param(
        [Parameter(Mandatory = $true)] [string[]]$PendingDrives
    )

    Write-Host ""
    Write-ColorMessage -Message ("Restart Windows to repair: {0}" -f ($PendingDrives -join ", ")) -Type "Warning"
    Write-ColorMessage -Message "Use Restart, not Shut down: Fast Startup can skip the boot-time disk check." -Type "Warning"
    Write-ColorMessage -Message "Do not press a key during the disk check countdown at startup, or the check is skipped. Large drives can take a long time." -Type "Warning"
    Write-Host ""
    $answer = Read-Host "Restart now? (Y/n)"
    if ($answer -ne "n") {
        Restart-Computer
    }
}
#endregion

#region Main Functions
function Show-DiskRepairMenu {
    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "Administrator privileges are required to run chkdsk." -Type "Error"
        return
    }

    $drives = @(Get-RepairableDrives)
    if ($drives.Count -eq 0) {
        Write-ColorMessage -Message "No local drive supported by chkdsk was found." -Type "Warning"
        return
    }

    $targets = @(Select-RepairTargets -Drives $drives)
    if ($targets.Count -eq 0) {
        return
    }

    Clear-Host
    Write-ColorMessage -Message "chkdsk cannot lock a drive in use (Windows drive, page file or open files) and offers to repair it at the next restart." -Type "Info"
    Write-ColorMessage -Message "If chkdsk asks to force a dismount, answer No (the letter shown in its prompt) to keep open files safe." -Type "Warning"
    Write-ColorMessage -Message "When chkdsk asks to check the volume the next time the system restarts, answer Yes (the letter shown in its prompt)." -Type "Warning"

    $results = @(foreach ($target in $targets) { Invoke-DriveRepair -DriveInfo $target })
    Show-RepairResults -Results $results

    $pendingDrives = @($results | Where-Object { $_.Pending } | ForEach-Object { $_.Drive })
    if ($pendingDrives.Count -gt 0) {
        Request-RepairRestart -PendingDrives $pendingDrives
    }
}
#endregion

#region Main Execution
Show-DiskRepairMenu
#endregion
