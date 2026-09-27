<#
.SYNOPSIS
    Disk Repair Menu
.DESCRIPTION
    Scans fixed drives (C:, D: ...) and runs "chkdsk <Drive>: /f" on one drive or on all drives.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DiskReadinessCommon.ps1")

$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Helper Functions
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
    Show-ChkdskPromptHints
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
