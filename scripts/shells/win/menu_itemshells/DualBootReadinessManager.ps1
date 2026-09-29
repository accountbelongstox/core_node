<#
.SYNOPSIS
    Linux Dual Boot Readiness Menu
.DESCRIPTION
    Turns off Fast Startup and hibernation, then checks every fixed drive so Linux can mount it read-write.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DiskReadinessCommon.ps1")
#endregion

#region Helper Functions
function Show-DriveReadiness {
    param(
        [Parameter(Mandatory = $true)] [object[]]$Drives,
        [Parameter()] [string[]]$BitLockerDrives = @(),
        [Parameter()] [string[]]$UncheckedDrives = @()
    )

    foreach ($bitLockerDrive in $BitLockerDrives) {
        Write-ColorMessage -Message ("{0} BitLocker is on: Linux cannot mount it until BitLocker is turned off (manage-bde -off {0})" -f $bitLockerDrive) -Type "Error"
    }
    foreach ($uncheckedDrive in $UncheckedDrives) {
        Write-ColorMessage -Message ("{0} has a file system this check does not support (ReFS, RAW or unreadable): Linux may not mount it" -f $uncheckedDrive) -Type "Warning"
    }
    foreach ($driveInfo in $Drives) {
        if ($driveInfo.Scheduled) {
            Write-ColorMessage -Message ("{0} disk check is pending: start Windows once to run it before switching to Linux" -f $driveInfo.Drive) -Type "Warning"
        } elseif ($driveInfo.NeedsRepair) {
            Write-ColorMessage -Message ("{0} needs repair ({1}): Linux mounts it read-only or refuses it" -f $driveInfo.Drive, (Get-DriveNotes -DriveInfo $driveInfo)) -Type "Error"
        } elseif ($BitLockerDrives -notcontains $driveInfo.Drive) {
            Write-ColorMessage -Message ("{0} {1} is ready for Linux" -f $driveInfo.Drive, $driveInfo.FileSystem) -Type "Success"
        }
    }
}
#endregion

#region Main Functions
function Show-DualBootReadiness {
    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "Administrator privileges are required to change power settings and run chkdsk." -Type "Error"
        return
    }

    Clear-Host
    Write-Host ""
    Write-ColorMessage -Message "========================================" -Type "Info"
    Write-ColorMessage -Message "   Linux Dual Boot Readiness" -Type "Info"
    Write-ColorMessage -Message "========================================" -Type "Info"
    Write-Host ""

    $fastStartupState = Disable-FastStartup
    Show-FastStartupState -State $fastStartupState
    Write-Host ""

    $drives = @(Get-RepairableDrives)
    $bitLockerDrives = @(Get-BitLockerIncompleteDrives)
    $checkedDrives = @($drives | ForEach-Object { $_.Drive })
    $uncheckedDrives = @(Get-FixedDriveLetters | Where-Object { ($checkedDrives -notcontains $_) -and ($bitLockerDrives -notcontains $_) })
    Show-DriveReadiness -Drives $drives -BitLockerDrives $bitLockerDrives -UncheckedDrives $uncheckedDrives

    $dirtyDrives = @($drives | Where-Object { $_.NeedsRepair -and -not $_.Scheduled })
    if ($dirtyDrives.Count -gt 0) {
        Write-Host ""
        if (Read-YesNoDefaultYes -Message ("Repair {0} now with chkdsk /f?" -f (($dirtyDrives | ForEach-Object { $_.Drive }) -join ", "))) {
            Show-ChkdskPromptHints
            $results = @(foreach ($driveInfo in $dirtyDrives) { Invoke-DriveRepair -DriveInfo $driveInfo })
            Show-RepairResults -Results $results
            $drives = @(Get-RepairableDrives)
        }
    }

    $pendingDrives = @($drives | Where-Object { $_.Scheduled } | ForEach-Object { $_.Drive })
    if ($pendingDrives.Count -gt 0) {
        Request-RepairRestart -PendingDrives $pendingDrives
        return
    }

    $repairDrives = @($drives | Where-Object { $_.NeedsRepair })
    Write-Host ""
    if ($fastStartupState.Ready -and $repairDrives.Count -eq 0 -and $bitLockerDrives.Count -eq 0 -and $uncheckedDrives.Count -eq 0) {
        Write-ColorMessage -Message "All fixed drives are ready for Linux. Switch with Restart or Shut down, never Sleep or Hibernate." -Type "Success"
    } else {
        Write-ColorMessage -Message "Some items are not ready for Linux yet. Fix the items above, then run this check again." -Type "Warning"
    }
}
#endregion

#region Main Execution
Show-DualBootReadiness
#endregion
