<#
.SYNOPSIS
    NTFS Repair After Linux Menu
.DESCRIPTION
    For NTFS drives written by Linux: health report (lost space, TxF, USN, NTFS events,
    shrink limit and blocker), read-only chkdsk, repair (TxF auto-reset + chkdsk /f),
    USN journal restore and shrink preparation (defrag /X).
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DiskReadinessCommon.ps1")

$script:NTFS_FILE_SYSTEM = "NTFS"
$script:DISK_MANAGEMENT_MSC = Join-Path $script:DISK_SYSTEM32_DIR "diskmgmt.msc"
$script:MENU_TITLE_ROOT = "Management & Backup > System Tools > NTFS repair after Linux"
#endregion

#region Main Functions
function Show-NtfsDriveActionMenu {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    Show-NumberedMenu -Title ("{0} > {1}" -f $script:MENU_TITLE_ROOT, $drive) -Items @(
        @{ Text = "Health report (quick)"; Action = [scriptblock]::Create(("Show-NtfsHealthReport -Report (Get-NtfsHealthReport -Drive '{0}')" -f $drive)) },
        @{ Text = "Health report with lost-space scan (lists all files, slow)"; Action = [scriptblock]::Create(("Show-NtfsHealthReport -Report (Get-NtfsHealthReport -Drive '{0}' -CountFiles)" -f $drive)) },
        @{ Text = "Read-only chkdsk (no changes)"; Action = [scriptblock]::Create(("Invoke-NtfsReadOnlyCheck -Drive '{0}'" -f $drive)) },
        @{ Text = "Repair: reset TxF + chkdsk /f (frees lost space; at restart if busy)"; Action = [scriptblock]::Create(("Invoke-NtfsLinuxRepair -DriveInfo (Get-RepairableDrives | Where-Object {{ `$_.Drive -eq '{0}' }} | Select-Object -First 1)" -f $drive)) },
        @{ Text = "After repair: restore USN journal + report"; Action = [scriptblock]::Create(("Enable-NtfsUsnJournal -Drive '{0}'; Show-NtfsHealthReport -Report (Get-NtfsHealthReport -Drive '{0}')" -f $drive)) },
        @{ Text = "Prepare shrink: consolidate free space (defrag /X) + shrink limit"; Action = [scriptblock]::Create(("Invoke-NtfsShrinkPrepare -Drive '{0}'" -f $drive)) },
        @{ Text = "Open Disk Management (shrink volume)"; NoPause = $true; Action = { Start-Process -FilePath "mmc.exe" -ArgumentList @($script:DISK_MANAGEMENT_MSC) } }
    )
}

function Show-NtfsLinuxRepairMenu {
    $drives = @()
    $menuItems = @()

    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "Administrator privileges are required for NTFS repair." -Type "Error"
        return
    }
    $drives = @(Get-RepairableDrives | Where-Object { $_.FileSystem -eq $script:NTFS_FILE_SYSTEM })
    if ($drives.Count -eq 0) {
        Write-ColorMessage -Message "No fixed NTFS drive was found." -Type "Warning"
        return
    }
    foreach ($driveInfo in $drives) {
        $menuItems += @{
            Text    = ("{0,-4}{1,-16}{2,10} GB{3,10} GB free  {4}" -f $driveInfo.Drive, $driveInfo.Label, $driveInfo.SizeGB, $driveInfo.FreeGB, (Get-DriveNotes -DriveInfo $driveInfo))
            Submenu = $true
            NoPause = $true
            Action  = [scriptblock]::Create(("Show-NtfsDriveActionMenu -Drive '{0}'" -f $driveInfo.Drive))
        }
    }
    Show-NumberedMenu -Title $script:MENU_TITLE_ROOT -Items $menuItems
}
#endregion

#region Main Execution
Show-NtfsLinuxRepairMenu
#endregion
