<#
.SYNOPSIS
    Disk Optimize Menu
.DESCRIPTION
    Lists fixed drives with their media type and runs "defrag <Drive>: /O /U /V"
    (defragment HDD, retrim SSD) on one drive or all drives; also opens dfrgui.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DiskReadinessCommon.ps1")

$script:DEFRAG_OPTIMIZE_ARGUMENTS = @("/O", "/U", "/V")
$script:UNKNOWN_MEDIA_TYPE = "Unknown"
#endregion

#region Helper Functions
function Get-DriveMediaType {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    try {
        $disk = Get-Partition -DriveLetter $Drive.TrimEnd(':') -ErrorAction Stop | Get-Disk -ErrorAction Stop
        $physicalDisk = Get-PhysicalDisk -ErrorAction Stop | Where-Object { [string]$_.DeviceId -eq [string]$disk.Number } | Select-Object -First 1
        if ($null -ne $physicalDisk -and [string]$physicalDisk.MediaType -ne "Unspecified") { return [string]$physicalDisk.MediaType }
    } catch {
    }
    return $script:UNKNOWN_MEDIA_TYPE
}

function Get-OptimizeDriveText {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$DriveInfo
    )

    return ("Optimize {0,-4}{1,-16}{2,-7}{3,-8}{4,10} GB{5,10} GB free" -f $DriveInfo.Drive, $DriveInfo.Label, $DriveInfo.FileSystem, (Get-DriveMediaType -Drive $DriveInfo.Drive), $DriveInfo.SizeGB, $DriveInfo.FreeGB)
}

function Invoke-DriveOptimize {
    param(
        [Parameter(Mandatory = $true)] [string[]]$DriveLetters
    )
    $process = $null

    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "Administrator privileges are required to run defrag." -Type "Error"
        return
    }
    foreach ($driveLetter in $DriveLetters) {
        Write-Host ""
        Write-ColorMessage -Message ("defrag {0} {1}" -f $driveLetter, ($script:DEFRAG_OPTIMIZE_ARGUMENTS -join " ")) -Type "Info"
        $process = Start-Process -FilePath $script:DISK_DEFRAG_EXE -ArgumentList (@($driveLetter) + $script:DEFRAG_OPTIMIZE_ARGUMENTS) -WorkingDirectory $env:SystemRoot -NoNewWindow -Wait -PassThru
        if ($process.ExitCode -eq 0) {
            Write-ColorMessage -Message ("{0} optimized" -f $driveLetter) -Type "Success"
        } else {
            Write-ColorMessage -Message ("{0} defrag exit code {1}" -f $driveLetter, $process.ExitCode) -Type "Error"
        }
    }
}
#endregion

#region Main Functions
function Show-DiskOptimizeMenu {
    $drives = @(Get-RepairableDrives)
    $driveLetters = @($drives | ForEach-Object { $_.Drive })
    $menuItems = @()

    if ($drives.Count -eq 0) {
        Write-ColorMessage -Message "No local drive supported by defrag was found." -Type "Warning"
        return
    }

    $menuItems += @{ Text = "Open Windows Optimize Drives (dfrgui)"; NoPause = $true; Action = { Start-Process -FilePath $script:DISK_DFRGUI_EXE } }
    $menuItems += @{ Text = ("Optimize all drives ({0})" -f ($driveLetters -join " ")); Action = [scriptblock]::Create(("Invoke-DriveOptimize -DriveLetters @('{0}')" -f ($driveLetters -join "','"))) }
    foreach ($driveInfo in $drives) {
        $menuItems += @{ Text = (Get-OptimizeDriveText -DriveInfo $driveInfo); Action = [scriptblock]::Create(("Invoke-DriveOptimize -DriveLetters @('{0}')" -f $driveInfo.Drive)) }
    }
    Show-NumberedMenu -Title "Management & Backup > System Tools > Disk Optimize (defrag / TRIM)" -Items $menuItems
}
#endregion

#region Main Execution
Show-DiskOptimizeMenu
#endregion
