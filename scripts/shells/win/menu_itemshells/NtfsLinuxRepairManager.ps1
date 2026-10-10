<#
.SYNOPSIS
    NTFS Repair After Linux Menu
.DESCRIPTION
    One idempotent action per NTFS drive: reset TxF, chkdsk /f when the read-only check
    finds errors (at restart if busy), restore the USN journal, consolidate free space
    for shrinking, rewrite Linux-written shrink blockers through Windows until all free space
    is shrinkable, then open Disk Management. Run it again after a restart to continue.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DiskReadinessCommon.ps1")

$script:NTFS_FILE_SYSTEM = "NTFS"
#endregion

#region Main Functions
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
            Text   = ("Repair {0,-4}{1,-16}{2,10} GB{3,10} GB free  {4}" -f $driveInfo.Drive, $driveInfo.Label, $driveInfo.SizeGB, $driveInfo.FreeGB, (Get-DriveNotes -DriveInfo $driveInfo))
            Action = [scriptblock]::Create(("Invoke-NtfsLinuxRepair -DriveInfo (Get-RepairableDrives | Where-Object {{ `$_.Drive -eq '{0}' }} | Select-Object -First 1)" -f $driveInfo.Drive))
        }
    }
    Show-NumberedMenu -Title "Management & Backup > System Tools > NTFS repair after Linux" -Items $menuItems
}
#endregion

#region Main Execution
Show-NtfsLinuxRepairMenu
#endregion
