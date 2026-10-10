<#
.SYNOPSIS
    Remove Linux Dual Boot Menu
.DESCRIPTION
    Finds the Linux side of a Windows dual boot and removes it after three confirmations:
    Linux partitions (GPT/MBR Linux types), Linux-only boot/installer FAT partitions,
    Linux UEFI firmware boot entries, Linux folders and loaders on the Windows EFI partition.
    Never touches NTFS/ReFS volumes, lettered volumes, the Windows EFI/boot partitions or
    EFI\Microsoft. Removed EFI files and the BCD store are backed up first.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DiskReadinessCommon.ps1")

$script:LINUX_GPT_TYPES = @(
    "{0fc63daf-8483-4772-8e79-3d69d8477de4}",
    "{0657fd6d-a4ab-43c4-84e5-0933c84b4f4f}",
    "{e6d6d379-f507-44c2-a23c-238f2a3df928}",
    "{a19d880f-05fc-4d3b-a006-743f0f84911e}",
    "{933ac7e1-2eb4-4f13-b844-0e14e2aef915}",
    "{4f68bce3-e8cd-4db1-96e7-fbcaf984b709}",
    "{44479540-f297-41b2-9af7-d131d5f0458a}",
    "{b921b045-1df0-41c3-af44-4c6f280d3fae}",
    "{3b8f8425-20e0-4f3b-907f-1a25a76f98e8}",
    "{bc13c2ff-59e6-4262-a352-b275fd6f7172}",
    "{8da63339-0007-60c0-c436-083ac8230908}",
    "{ca7d7ccb-63ed-4c53-861c-1742536059cc}"
)
$script:LINUX_MBR_TYPES = @(130, 131, 142, 253)
$script:EFI_GPT_TYPE = "{c12a7328-f81f-11d2-ba4b-00a0c93ec93b}"
$script:BASIC_DATA_GPT_TYPE = "{ebd0a0a2-b9e5-4433-87c0-68b6b72699c7}"
$script:FAT_FILE_SYSTEMS = @("FAT", "FAT32")
$script:WINDOWS_FILE_SYSTEMS = @("NTFS", "ReFS", "exFAT")
$script:LINUX_EFI_DIRS = @("debian", "ubuntu", "kali", "fedora", "opensuse", "suse", "arch", "linuxmint", "mint", "manjaro", "centos", "redhat", "rocky", "almalinux", "pop", "elementary", "zorin", "deepin", "uos", "neon", "gentoo", "void", "nixos", "endeavouros", "grub", "systemd", "linux", "refind")
$script:LINUX_EFI_LOADERS = @("shimx64.efi", "grubx64.efi", "mmx64.efi", "fbx64.efi", "systemd-bootx64.efi", "shimaa64.efi", "grubaa64.efi", "mmaa64.efi", "fbaa64.efi")
$script:EFI_DIR_NAME = "EFI"
$script:EFI_MICROSOFT_DIR = "Microsoft"
$script:EFI_FALLBACK_DIR = "Boot"
$script:EFI_FALLBACK_LOADER = "bootx64.efi"
$script:EFI_WINDOWS_LOADER_RELATIVE = "Microsoft\Boot\bootmgfw.efi"
$script:BCD_WINDOWS_BOOT_MANAGER = "{bootmgr}"
$script:BCD_ID_PROPERTY = "identifier"
$script:BCD_PATH_PROPERTY = "path"
$script:BCD_DESCRIPTION_PROPERTY = "description"
$script:BACKUP_ROOT = Join-Path $env:ProgramData "core_node\linux_removal_backup"
$script:BACKUP_BCD_FILE = "bcd_store.bak"
$script:CONFIRM_WORD_1 = "confirm"
$script:CONFIRM_WORD_2 = "yes"
$script:MBR_REPAIR_STEPS = @(
    "Legacy BIOS boot: GRUB may still be in the disk MBR. Restore the Windows boot code manually:",
    "  Boot a Windows installation USB > Repair your computer > Troubleshoot > Command Prompt",
    "  Run: bootrec /fixmbr   then: bootrec /fixboot"
)
$script:FIRMWARE_MANUAL_STEPS = @(
    "If a Linux entry still shows in the BIOS/UEFI boot menu (some firmware recreates or keeps them):",
    "  Enter BIOS setup (F2 / Del / F12 at power-on) > Boot > delete the Linux entry or move 'Windows Boot Manager' to first, then Save & Exit."
)
#endregion

#region Discovery
function Get-VolumeRootPath {
    param(
        [Parameter(Mandatory = $true)] [object]$Partition
    )
    $volume = $Partition | Get-Volume -ErrorAction SilentlyContinue

    if ($null -eq $volume) {
        return $null
    }
    return [PSCustomObject]@{ Path = [string]$volume.Path; FileSystem = [string]$volume.FileSystem }
}

function Get-ChildNames {
    param(
        [Parameter(Mandatory = $true)] [string]$Path
    )

    if (-not [System.IO.Directory]::Exists($Path)) {
        return @()
    }
    return @([System.IO.Directory]::GetFileSystemEntries($Path) | ForEach-Object { [System.IO.Path]::GetFileName($_) })
}

function Test-LinuxPartitionType {
    param(
        [Parameter(Mandatory = $true)] [object]$Partition
    )

    if ($Partition.GptType) {
        return ($script:LINUX_GPT_TYPES -contains ([string]$Partition.GptType).ToLowerInvariant())
    }
    return ($script:LINUX_MBR_TYPES -contains [int]$Partition.MbrType)
}

function Test-LinuxBootPartition {
    param(
        [Parameter(Mandatory = $true)] [object]$Partition,
        [Parameter(Mandatory = $true)] [PSCustomObject]$Volume
    )
    $efiPath = Join-Path $Volume.Path $script:EFI_DIR_NAME
    $efiNames = @(Get-ChildNames -Path $efiPath)
    $fallbackNames = @(Get-ChildNames -Path (Join-Path $efiPath $script:EFI_FALLBACK_DIR))

    if ($efiNames.Count -eq 0 -or ($efiNames -contains $script:EFI_MICROSOFT_DIR)) {
        return $false
    }
    return (@($efiNames | Where-Object { $script:LINUX_EFI_DIRS -contains $_.ToLowerInvariant() }).Count -gt 0) -or
        (@($fallbackNames | Where-Object { $script:LINUX_EFI_LOADERS -contains $_.ToLowerInvariant() }).Count -gt 0)
}

function Get-LinuxPartitionPlan {
    $plan = @()

    foreach ($partition in @(Get-Partition)) {
        $volume = $null
        $reason = $null
        if ($partition.IsSystem -or $partition.IsBoot -or $partition.DriveLetter -match '[A-Za-z]') {
            continue
        }
        $volume = Get-VolumeRootPath -Partition $partition
        if (($null -ne $volume) -and ($script:WINDOWS_FILE_SYSTEMS -contains $volume.FileSystem)) {
            continue
        }
        if (Test-LinuxPartitionType -Partition $partition) {
            $reason = "Linux partition type"
        } elseif (($null -ne $volume) -and ($script:FAT_FILE_SYSTEMS -contains $volume.FileSystem) -and
            (@($script:EFI_GPT_TYPE, $script:BASIC_DATA_GPT_TYPE) -contains ([string]$partition.GptType).ToLowerInvariant()) -and
            (Test-LinuxBootPartition -Partition $partition -Volume $volume)) {
            $reason = ("Linux-only EFI/installer partition: {0}" -f ((Get-ChildNames -Path $volume.Path) -join ", "))
        }
        if ($null -ne $reason) {
            $plan += [PSCustomObject]@{
                DiskNumber      = $partition.DiskNumber
                PartitionNumber = $partition.PartitionNumber
                SizeGB          = [math]::Round($partition.Size / 1GB, 2)
                Reason          = $reason
            }
        }
    }
    return $plan
}

function Get-WindowsEfiRoot {
    $systemPartition = Get-Partition | Where-Object { $_.IsSystem -and ([string]$_.GptType).ToLowerInvariant() -eq $script:EFI_GPT_TYPE } | Select-Object -First 1
    $volume = $null

    if ($null -eq $systemPartition) {
        return $null
    }
    $volume = Get-VolumeRootPath -Partition $systemPartition
    if ($null -eq $volume) {
        return $null
    }
    return (Join-Path $volume.Path $script:EFI_DIR_NAME)
}

function Get-EfiFilePlan {
    param(
        [Parameter()] [string]$EfiRoot
    )
    $plan = @()
    $fallbackDir = $null
    $fallbackLoader = $null
    $windowsLoader = $null

    if ([string]::IsNullOrEmpty($EfiRoot)) {
        return $plan
    }
    foreach ($name in @(Get-ChildNames -Path $EfiRoot)) {
        if ($script:LINUX_EFI_DIRS -contains $name.ToLowerInvariant()) {
            $plan += [PSCustomObject]@{ Action = "Delete"; Path = (Join-Path $EfiRoot $name) }
        }
    }
    $fallbackDir = Join-Path $EfiRoot $script:EFI_FALLBACK_DIR
    foreach ($name in @(Get-ChildNames -Path $fallbackDir)) {
        if ($script:LINUX_EFI_LOADERS -contains $name.ToLowerInvariant()) {
            $plan += [PSCustomObject]@{ Action = "Delete"; Path = (Join-Path $fallbackDir $name) }
        }
    }
    $fallbackLoader = Join-Path $fallbackDir $script:EFI_FALLBACK_LOADER
    $windowsLoader = Join-Path $EfiRoot $script:EFI_WINDOWS_LOADER_RELATIVE
    if ([System.IO.File]::Exists($fallbackLoader) -and [System.IO.File]::Exists($windowsLoader) -and
        ((Get-FileHash -LiteralPath $fallbackLoader).Hash -ne (Get-FileHash -LiteralPath $windowsLoader).Hash)) {
        $plan += [PSCustomObject]@{ Action = "ReplaceWithWindowsLoader"; Path = $fallbackLoader }
    }
    return $plan
}

function Get-FirmwareEntries {
    $entries = @()
    $current = $null
    $key = $null

    foreach ($line in @(& $script:DISK_BCDEDIT_EXE /enum firmware)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("-")) {
            continue
        }
        $key = ($line.Trim() -split '\s+', 2)[0]
        if ($key -eq $script:BCD_ID_PROPERTY) {
            $current = [PSCustomObject]@{ Id = ($line.Trim() -split '\s+', 2)[1]; Path = ""; Description = "" }
            $entries += $current
        } elseif (($null -ne $current) -and ($key -eq $script:BCD_PATH_PROPERTY)) {
            $current.Path = ($line.Trim() -split '\s+', 2)[1]
        } elseif (($null -ne $current) -and ($key -eq $script:BCD_DESCRIPTION_PROPERTY)) {
            $current.Description = ($line.Trim() -split '\s+', 2)[1]
        }
    }
    return $entries
}

function Get-FirmwareEntryPlan {
    $plan = @()
    $segments = @()

    if ($env:firmware_type -ne $script:DISK_UEFI_FIRMWARE) {
        return $plan
    }
    foreach ($entry in @(Get-FirmwareEntries)) {
        if ([string]::IsNullOrEmpty($entry.Path) -or $entry.Id -eq $script:BCD_WINDOWS_BOOT_MANAGER) {
            continue
        }
        $segments = @($entry.Path.Trim('\') -split '\\' | ForEach-Object { $_.ToLowerInvariant() })
        if ($segments -contains $script:EFI_MICROSOFT_DIR.ToLowerInvariant()) {
            continue
        }
        if (($script:LINUX_EFI_LOADERS -contains $segments[-1]) -or (@($segments | Where-Object { $script:LINUX_EFI_DIRS -contains $_ }).Count -gt 0)) {
            $plan += $entry
        }
    }
    return $plan
}
#endregion

#region Removal
function Show-RemovalPlan {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$Plan
    )

    Write-Host ""
    Write-ColorMessage -Message "========== Linux dual boot removal plan ==========" -Type "Info"
    Write-ColorMessage -Message ("Firmware: {0}" -f $env:firmware_type) -Type "Info"
    Write-Host "Partitions to delete:"
    foreach ($item in $Plan.Partitions) {
        Write-Host ("  Disk {0} partition {1}  {2} GB  ({3})" -f $item.DiskNumber, $item.PartitionNumber, $item.SizeGB, $item.Reason) -ForegroundColor $script:COLOR_WARNING
    }
    Write-Host "UEFI boot entries to delete:"
    foreach ($entry in $Plan.FirmwareEntries) {
        Write-Host ("  {0}  {1}  {2}" -f $entry.Id, $entry.Description, $entry.Path) -ForegroundColor $script:COLOR_WARNING
    }
    Write-Host "Windows EFI partition changes:"
    foreach ($item in $Plan.EfiFiles) {
        Write-Host ("  {0}: {1}" -f $item.Action, $item.Path) -ForegroundColor $script:COLOR_WARNING
    }
    Write-ColorMessage -Message "Not touched: C:, D: and every NTFS/ReFS/exFAT or lettered volume, EFI\Microsoft, the Windows EFI/MSR/recovery partitions, WSL." -Type "Info"
    Write-ColorMessage -Message ("Backup of removed EFI files and the BCD store: {0}" -f $script:BACKUP_ROOT) -Type "Info"
}

function Confirm-LinuxRemoval {
    Write-Host ""
    Write-ColorMessage -Message "All Linux data on the partitions above is destroyed and cannot be recovered." -Type "Error"
    if ((Read-Host ("Type '{0}' to continue" -f $script:CONFIRM_WORD_1)).Trim() -ne $script:CONFIRM_WORD_1) {
        return $false
    }
    if ((Read-Host ("Type '{0}' to delete the Linux side" -f $script:CONFIRM_WORD_2)).Trim() -ne $script:CONFIRM_WORD_2) {
        return $false
    }
    return (Read-YesNoDefaultNo -Message "Last confirmation: delete now?")
}

function Backup-RemovalTargets {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$Plan
    )
    $backupDir = Join-Path $script:BACKUP_ROOT (Get-Date -Format "yyyyMMdd-HHmmss")
    $target = $null

    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    & $script:DISK_BCDEDIT_EXE /export (Join-Path $backupDir $script:BACKUP_BCD_FILE) | Out-Host
    foreach ($item in $Plan.EfiFiles) {
        $target = Join-Path $backupDir ([System.IO.Path]::GetFileName($item.Path))
        if ([System.IO.Directory]::Exists($item.Path)) {
            Copy-Item -LiteralPath $item.Path -Destination $target -Recurse -Force
        } else {
            Copy-Item -LiteralPath $item.Path -Destination $target -Force
        }
    }
    Write-ColorMessage -Message ("Backup written to {0}" -f $backupDir) -Type "Success"
}

function Remove-LinuxFirmwareEntries {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$Plan
    )
    $failed = 0

    if ($env:firmware_type -ne $script:DISK_UEFI_FIRMWARE) {
        foreach ($line in $script:MBR_REPAIR_STEPS) { Write-Host $line -ForegroundColor $script:COLOR_WARNING }
        return
    }
    foreach ($entry in $Plan.FirmwareEntries) {
        & $script:DISK_BCDEDIT_EXE /delete $entry.Id | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message ("Deleted boot entry {0} ({1})" -f $entry.Description, $entry.Id) -Type "Success"
        } else {
            $failed++
            Write-ColorMessage -Message ("Could not delete boot entry {0} ({1})" -f $entry.Description, $entry.Id) -Type "Error"
        }
    }
    & $script:DISK_BCDEDIT_EXE /set $script:DISK_FIRMWARE_BOOT_MANAGER displayorder $script:BCD_WINDOWS_BOOT_MANAGER /addfirst | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Message "Windows Boot Manager is first in the UEFI boot order" -Type "Success"
    } else {
        $failed++
    }
    if ($failed -gt 0) {
        foreach ($line in $script:FIRMWARE_MANUAL_STEPS) { Write-Host $line -ForegroundColor $script:COLOR_WARNING }
    }
}

function Remove-LinuxEfiFiles {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$Plan,
        [Parameter()] [string]$EfiRoot
    )

    foreach ($item in $Plan.EfiFiles) {
        try {
            if ($item.Action -eq "ReplaceWithWindowsLoader") {
                [System.IO.File]::Copy((Join-Path $EfiRoot $script:EFI_WINDOWS_LOADER_RELATIVE), $item.Path, $true)
            } elseif ([System.IO.Directory]::Exists($item.Path)) {
                [System.IO.Directory]::Delete($item.Path, $true)
            } else {
                [System.IO.File]::Delete($item.Path)
            }
            Write-ColorMessage -Message ("{0}: {1}" -f $item.Action, $item.Path) -Type "Success"
        } catch {
            Write-ColorMessage -Message ("Failed {0}: {1} ({2})" -f $item.Action, $item.Path, $_.Exception.Message) -Type "Error"
        }
    }
}

function Remove-LinuxPartitions {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$Plan
    )

    foreach ($item in $Plan.Partitions) {
        try {
            Remove-Partition -DiskNumber $item.DiskNumber -PartitionNumber $item.PartitionNumber -Confirm:$false -ErrorAction Stop
            Write-ColorMessage -Message ("Deleted disk {0} partition {1} ({2} GB)" -f $item.DiskNumber, $item.PartitionNumber, $item.SizeGB) -Type "Success"
        } catch {
            Write-ColorMessage -Message ("Failed to delete disk {0} partition {1}: {2}" -f $item.DiskNumber, $item.PartitionNumber, $_.Exception.Message) -Type "Error"
        }
    }
}
#endregion

#region Main Functions
function Invoke-LinuxDualBootRemoval {
    $efiRoot = $null
    $plan = $null

    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "Administrator privileges are required to remove the Linux side." -Type "Error"
        return
    }
    $efiRoot = Get-WindowsEfiRoot
    $plan = [PSCustomObject]@{
        Partitions      = @(Get-LinuxPartitionPlan)
        FirmwareEntries = @(Get-FirmwareEntryPlan)
        EfiFiles        = @(Get-EfiFilePlan -EfiRoot $efiRoot)
    }
    Show-RemovalPlan -Plan $plan
    if (($plan.Partitions.Count + $plan.FirmwareEntries.Count + $plan.EfiFiles.Count) -eq 0) {
        Write-ColorMessage -Message "No Linux partitions, boot entries or EFI files found. Nothing to do." -Type "Success"
        if ($env:firmware_type -ne $script:DISK_UEFI_FIRMWARE) {
            foreach ($line in $script:MBR_REPAIR_STEPS) { Write-Host $line -ForegroundColor $script:COLOR_WARNING }
        }
        return
    }
    if (-not (Confirm-LinuxRemoval)) {
        Write-ColorMessage -Message "Cancelled. Nothing was changed." -Type "Warning"
        return
    }

    Backup-RemovalTargets -Plan $plan
    Remove-LinuxFirmwareEntries -Plan $plan
    Remove-LinuxEfiFiles -Plan $plan -EfiRoot $efiRoot
    Remove-LinuxPartitions -Plan $plan

    Write-Host ""
    Write-ColorMessage -Message "Linux side removed. The freed space is unallocated; extend a Windows volume in Disk Management (diskmgmt.msc) if wanted." -Type "Success"
    foreach ($line in $script:FIRMWARE_MANUAL_STEPS) { Write-Host $line -ForegroundColor $script:COLOR_WARNING }
}
#endregion

#region Main Execution
Invoke-LinuxDualBootRemoval
#endregion
