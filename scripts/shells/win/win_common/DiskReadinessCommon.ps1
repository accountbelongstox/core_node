<#
.SYNOPSIS
    Shared disk readiness helpers: fixed drive scan, chkdsk repair, Fast Startup state for Linux dual boot.
#>

#region Variable Declarations
$script:DISK_SESSION_MANAGER_KEY = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager"
$script:DISK_SESSION_POWER_KEY = Join-Path $script:DISK_SESSION_MANAGER_KEY "Power"
$script:DISK_CONTROL_POWER_KEY = "HKLM:\SYSTEM\CurrentControlSet\Control\Power"
$script:DISK_POLICY_SYSTEM_KEY = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
$script:DISK_HIBERBOOT_VALUE = "HiberbootEnabled"
$script:DISK_HIBERNATE_VALUE = "HibernateEnabled"
$script:DISK_AUTOCHK_TIMEOUT_VALUE = "AutoChkTimeout"
$script:DISK_AUTOCHK_DEFAULT_TIMEOUT = 8
$script:DISK_SYSTEM32_DIR = Join-Path $env:SystemRoot "System32"
$script:DISK_CHKDSK_EXE = Join-Path $script:DISK_SYSTEM32_DIR "chkdsk.exe"
$script:DISK_DEFRAG_EXE = Join-Path $script:DISK_SYSTEM32_DIR "defrag.exe"
$script:DISK_DFRGUI_EXE = Join-Path $script:DISK_SYSTEM32_DIR "dfrgui.exe"
$script:DISK_POWERCFG_EXE =Join-Path $script:DISK_SYSTEM32_DIR "powercfg.exe"
$script:DISK_BCDEDIT_EXE = Join-Path $script:DISK_SYSTEM32_DIR "bcdedit.exe"
$script:DISK_FSUTIL_EXE = Join-Path $script:DISK_SYSTEM32_DIR "fsutil.exe"
$script:DISK_SHRINK_EVENT_ID = 259
$script:DISK_SHRINK_EVENT_MARKER = "The last unmovable file appears to be:"
$script:DISK_USN_MAX_SIZE = "0x2000000"
$script:DISK_USN_ALLOCATION_DELTA = "0x800000"
$script:DISK_SHRINK_DEFRAG_ARGUMENTS = @("/X", "/U", "/V")
$script:DISK_SHRINK_MAX_PASSES = 20
$script:DISK_SHRINK_RESOLVED = "resolved"
$script:DISK_SHRINK_RESTART = "restart"
$script:DISK_SHRINK_UNRESOLVED = "unresolved"
$script:DISK_EXTEND_DIR = '$Extend'
$script:DISK_PAGE_FILE_NAMES = @("pagefile.sys", "swapfile.sys")
$script:DISK_DISKMGMT_MSC = Join-Path $script:DISK_SYSTEM32_DIR "diskmgmt.msc"
$script:DISK_VSSADMIN_EXE = Join-Path $script:DISK_SYSTEM32_DIR "vssadmin.exe"
$script:DISK_ROBOCOPY_EXE = Join-Path $script:DISK_SYSTEM32_DIR "robocopy.exe"
$script:DISK_SHRINK_ROBOCOPY_ARGUMENTS = @("/E", "/MOVE", "/COPY:DAT", "/DCOPY:DAT", "/XJ", "/R:1", "/W:1", "/NFL", "/NDL", "/NP")
$script:DISK_ROBOCOPY_FAILURE_CODE = 8
$script:DISK_SHRINK_REWRITE_SUFFIX = ".shrink-rewrite"
$script:DISK_SECURITY_DESCRIPTOR_STREAM = '$SECURITY_DESCRIPTOR'
$script:DISK_RECYCLE_BIN_DIR = '$RECYCLE.BIN'
$script:DISK_SYSTEM_VOLUME_INFO_DIR = "System Volume Information"
$script:DISK_HIBERFIL = Join-Path $env:SystemDrive "hiberfil.sys"
$script:DISK_STORAGE_NAMESPACE = "root/Microsoft/Windows/Storage"
$script:DISK_ENCRYPTION_NAMESPACE = "root/cimv2/Security/MicrosoftVolumeEncryption"
$script:DISK_INTERNAL_ENCRYPTABLE_TYPES = @(0, 1)
$script:DISK_FILE_SYSTEMS = @("NTFS", "FAT", "FAT32", "exFAT")
$script:DISK_FIXED_DRIVE_TYPE = 3
$script:DISK_HEALTHY_STATUS = @("0", "Healthy")
$script:DISK_BITLOCKER_DECRYPTED = "FullyDecrypted"
$script:DISK_UEFI_FIRMWARE = "UEFI"
$script:DISK_FIRMWARE_BOOT_MANAGER = "{fwbootmgr}"
$script:DISK_WINDOWS_BOOT_MANAGER = "{bootmgr}"
$script:DISK_CHKDSK_EXIT_MESSAGES = @{
    0 = "No errors were found"
    1 = "Errors were found and fixed"
    2 = "Disk cleanup was performed"
    3 = "The drive could not be checked or errors could not be fixed"
}
$script:DISK_FAST_STARTUP_MANUAL_STEPS = @(
    "Turn off Fast Startup manually (administrator account required):",
    "  Quick way: press Win+R and run: control.exe /name Microsoft.PowerOptions /page pageGlobalSettings",
    "  Windows 11: Control Panel > System and Security > Power Options > Choose what the power buttons do",
    "  Windows 10: Settings > System > Power & sleep > Additional power settings > Choose what the power buttons do",
    "  Then: Change settings that are currently unavailable > clear 'Turn on fast startup (recommended)' > Save changes",
    "  If the option is greyed out: gpedit.msc > Computer Configuration > Administrative Templates > System > Shutdown > Require use of fast startup > Not Configured",
    "  Also run in an elevated Command Prompt: powercfg /hibernate off"
)

. (Join-Path $PSScriptRoot "NssmServiceManager.ps1")
#endregion

#region Registry
function Get-RegistryValueOrNull {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    return (Get-Item -LiteralPath $Path).GetValue($Name, $null)
}
#endregion

#region Fast Startup
function Get-FastStartupState {
    $localValue = Get-RegistryValueOrNull -Path $script:DISK_SESSION_POWER_KEY -Name $script:DISK_HIBERBOOT_VALUE
    $policyValue = Get-RegistryValueOrNull -Path $script:DISK_POLICY_SYSTEM_KEY -Name $script:DISK_HIBERBOOT_VALUE
    $hibernateValue = Get-RegistryValueOrNull -Path $script:DISK_CONTROL_POWER_KEY -Name $script:DISK_HIBERNATE_VALUE
    $localEnabled = ($null -eq $localValue) -or ([int]$localValue -ne 0)
    $policyForced = ($null -ne $policyValue) -and ([int]$policyValue -eq 1)
    $hibernationActive = (($null -ne $hibernateValue) -and ([int]$hibernateValue -ne 0)) -or [System.IO.File]::Exists($script:DISK_HIBERFIL)

    return [PSCustomObject]@{
        LocalEnabled      = $localEnabled
        PolicyForced      = $policyForced
        HibernationActive = $hibernationActive
        Effective         = ($hibernationActive -and ($localEnabled -or $policyForced))
        Ready             = (-not $localEnabled) -and (-not $policyForced) -and (-not $hibernationActive)
    }
}

function Disable-FastStartup {
    $state = Get-FastStartupState

    try {
        if ($state.LocalEnabled) {
            New-ItemProperty -LiteralPath $script:DISK_SESSION_POWER_KEY -Name $script:DISK_HIBERBOOT_VALUE -PropertyType DWord -Value 0 -Force | Out-Null
        }
        if ($state.HibernationActive) {
            & $script:DISK_POWERCFG_EXE /hibernate off | Out-Host
        }
    } catch {
        Write-ColorMessage -Message ("Failed to turn off Fast Startup: {0}" -f $_.Exception.Message) -Type "Error"
    }

    return Get-FastStartupState
}

function Show-FastStartupState {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$State
    )

    if ($State.Ready) {
        Write-ColorMessage -Message "Fast Startup and hibernation are off." -Type "Success"
        return
    }
    if ($State.PolicyForced) {
        Write-ColorMessage -Message "Group Policy 'Require use of fast startup' forces Fast Startup on." -Type "Error"
    }
    if ($State.Effective) {
        Write-ColorMessage -Message "Fast Startup is still turned on." -Type "Error"
    } elseif ($State.LocalEnabled) {
        Write-ColorMessage -Message "The Fast Startup setting is still on; it returns as soon as hibernation is turned on again." -Type "Error"
    }
    if ($State.HibernationActive) {
        Write-ColorMessage -Message "Hibernation is still turned on." -Type "Error"
    }
    foreach ($line in $script:DISK_FAST_STARTUP_MANUAL_STEPS) {
        Write-Host $line -ForegroundColor $script:COLOR_WARNING
    }
}
#endregion

#region Drives
function Test-DriveRepairScheduled {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    $schedulePattern = '^autocheck\s+autochk\b.*{0}' -f [regex]::Escape(('\??\{0}' -f $Drive))
    $bootExecute = @((Get-ItemProperty -Path $script:DISK_SESSION_MANAGER_KEY -Name "BootExecute").BootExecute)

    return (@($bootExecute | Where-Object { $_ -match $schedulePattern }).Count -gt 0)
}

function Get-FixedDriveLetters {
    Get-CimInstance Win32_Volume | Where-Object {
        $_.DriveLetter -and ([int]$_.DriveType -eq $script:DISK_FIXED_DRIVE_TYPE)
    } | ForEach-Object { $_.DriveLetter }
}

function Get-UnhealthyDriveLetters {
    Get-CimInstance -Namespace $script:DISK_STORAGE_NAMESPACE -ClassName MSFT_Volume | Where-Object {
        ($null -ne $_.DriveLetter) -and ($script:DISK_HEALTHY_STATUS -notcontains [string]$_.HealthStatus)
    } | ForEach-Object { '{0}:' -f $_.DriveLetter }
}

function Get-RepairableDrives {
    $pageFileDrives = @(Get-CimInstance Win32_PageFileUsage | ForEach-Object { Split-Path $_.Name -Qualifier })
    $unhealthyDrives = @(Get-UnhealthyDriveLetters)
    $volumes = @(Get-CimInstance Win32_Volume | Where-Object {
        $_.DriveLetter -and ([int]$_.DriveType -eq $script:DISK_FIXED_DRIVE_TYPE) -and ($script:DISK_FILE_SYSTEMS -contains $_.FileSystem)
    } | Sort-Object DriveLetter)

    foreach ($volume in $volumes) {
        $isDirty = [bool]$volume.DirtyBitSet
        $needsScan = $unhealthyDrives -contains $volume.DriveLetter
        [PSCustomObject]@{
            Drive          = $volume.DriveLetter
            Label          = [string]$volume.Label
            FileSystem     = $volume.FileSystem
            SizeGB         = [math]::Round($volume.Capacity / 1GB, 1)
            FreeGB         = [math]::Round($volume.FreeSpace / 1GB, 1)
            Dirty          = $isDirty
            NeedsScan      = $needsScan
            NeedsRepair    = ($isDirty -or $needsScan)
            Scheduled      = (Test-DriveRepairScheduled -Drive $volume.DriveLetter)
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
        if ($DriveInfo.NeedsScan) { "scan needed" }
        if ($DriveInfo.Scheduled) { "check pending restart" }
    )
    return ($notes -join ", ")
}

function Get-FixedBitLockerVolumes {
    $internalDrives = @(Get-CimInstance -Namespace $script:DISK_ENCRYPTION_NAMESPACE -ClassName Win32_EncryptableVolume -ErrorAction Stop | Where-Object {
        $_.DriveLetter -and ($script:DISK_INTERNAL_ENCRYPTABLE_TYPES -contains [int]$_.VolumeType)
    } | ForEach-Object { $_.DriveLetter })
    Get-BitLockerVolume -ErrorAction Stop | Where-Object { $internalDrives -contains $_.MountPoint }
}

function Test-BitLockerIncomplete {
    param(
        [Parameter(Mandatory = $true)] [object]$Volume
    )

    return (($Volume.VolumeStatus -ne $script:DISK_BITLOCKER_DECRYPTED) -or ($Volume.ProtectionStatus -eq "On"))
}

function Get-BitLockerIncompleteDrives {
    if ($null -eq (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue)) {
        return
    }
    try {
        Get-FixedBitLockerVolumes | Where-Object { Test-BitLockerIncomplete -Volume $_ } | ForEach-Object { $_.MountPoint }
    } catch {
        Write-ColorMessage -Message ("Failed to query BitLocker status: {0}" -f $_.Exception.Message) -Type "Warning"
    }
}
#endregion

#region chkdsk
function Show-ChkdskPromptHints {
    Write-ColorMessage -Message "chkdsk cannot lock a drive in use (Windows drive, page file or open files) and offers to repair it at the next restart." -Type "Info"
    Write-ColorMessage -Message "If chkdsk asks to force a dismount, answer No (the letter shown in its prompt) to keep open files safe." -Type "Warning"
    Write-ColorMessage -Message "When chkdsk asks to check the volume the next time the system restarts, answer Yes (the letter shown in its prompt)." -Type "Warning"
}

function Invoke-DriveRepair {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$DriveInfo
    )

    Write-Host ""
    Write-ColorMessage -Message ("chkdsk {0} /f" -f $DriveInfo.Drive) -Type "Info"
    $process = Start-Process -FilePath $script:DISK_CHKDSK_EXE -ArgumentList @($DriveInfo.Drive, "/f") -WorkingDirectory $env:SystemRoot -NoNewWindow -Wait -PassThru

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
            Write-ColorMessage -Message ("{0} will be checked and repaired at the next Windows startup" -f $result.Drive) -Type "Warning"
        } elseif ($script:DISK_CHKDSK_EXIT_MESSAGES.ContainsKey($result.ExitCode)) {
            $type = if ($result.ExitCode -le 2) { "Success" } else { "Error" }
            Write-ColorMessage -Message ("{0} {1} (chkdsk exit code {2})" -f $result.Drive, $script:DISK_CHKDSK_EXIT_MESSAGES[$result.ExitCode], $result.ExitCode) -Type $type
        } else {
            Write-ColorMessage -Message ("{0} chkdsk exit code {1}" -f $result.Drive, $result.ExitCode) -Type "Error"
        }
    }
    Write-ColorMessage -Message "========================================" -Type "Info"
}

function Set-NextBootWindows {
    if ($env:firmware_type -ne $script:DISK_UEFI_FIRMWARE) {
        return $false
    }
    & $script:DISK_BCDEDIT_EXE /set $script:DISK_FIRMWARE_BOOT_MANAGER bootsequence $script:DISK_WINDOWS_BOOT_MANAGER | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Request-RepairRestart {
    param(
        [Parameter(Mandatory = $true)] [string[]]$PendingDrives
    )

    $autochkTimeout = Get-RegistryValueOrNull -Path $script:DISK_SESSION_MANAGER_KEY -Name $script:DISK_AUTOCHK_TIMEOUT_VALUE
    if ($null -eq $autochkTimeout) {
        $autochkTimeout = $script:DISK_AUTOCHK_DEFAULT_TIMEOUT
    }

    Write-Host ""
    Write-ColorMessage -Message ("Restart Windows to repair: {0}" -f ($PendingDrives -join ", ")) -Type "Warning"
    Write-ColorMessage -Message "The disk check only runs while Windows starts, not when Linux starts." -Type "Warning"
    Write-ColorMessage -Message ("Do not press a key during the {0}-second disk check countdown, or the check is skipped. Large drives can take a long time." -f $autochkTimeout) -Type "Warning"
    Write-ColorMessage -Message "Switch to Linux only after Windows has finished the check and started." -Type "Warning"
    Write-Host ""
    if (-not (Read-YesNoDefaultYes -Message "Restart now?")) {
        Write-ColorMessage -Message "At the next restart choose Windows in the boot menu so the disk check can run." -Type "Warning"
        return
    }
    if (Set-NextBootWindows) {
        Write-ColorMessage -Message "The next boot starts Windows once; the default boot menu order is unchanged." -Type "Info"
    } else {
        Write-ColorMessage -Message "Could not select Windows for the next boot. Choose Windows in the boot menu." -Type "Warning"
    }
    Restart-Computer
}
#endregion

#region NTFS after Linux
function Test-NtfsTransactionManagerOk {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    & $script:DISK_FSUTIL_EXE resource info ('{0}\' -f $Drive) | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Test-NtfsUsnJournalActive {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    & $script:DISK_FSUTIL_EXE usn queryjournal $Drive | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Test-NtfsReadOnlyCheckClean {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    Write-ColorMessage -Message ("chkdsk {0} (read-only check, no changes)..." -f $Drive) -Type "Info"
    & $script:DISK_CHKDSK_EXE $Drive | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-LastUnmovableFile {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $filter = @{ LogName = "Application"; Id = $script:DISK_SHRINK_EVENT_ID }
    $shrinkEvent = Get-WinEvent -FilterHashtable $filter -MaxEvents 50 -ErrorAction SilentlyContinue | Where-Object { $_.Message -like ('*({0})*' -f $Drive) } | Select-Object -First 1
    $markerLine = $null

    if ($null -eq $shrinkEvent) {
        return $null
    }
    $markerLine = @($shrinkEvent.Message -split "`r?`n" | Where-Object { $_.Contains($script:DISK_SHRINK_EVENT_MARKER) }) | Select-Object -First 1
    if ($null -eq $markerLine) {
        return $null
    }
    return $markerLine.Substring($markerLine.IndexOf($script:DISK_SHRINK_EVENT_MARKER) + $script:DISK_SHRINK_EVENT_MARKER.Length).Trim()
}

function Show-NtfsVolumeSummary {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $driveLetter = $Drive.TrimEnd(':')
    $volume = Get-Volume -DriveLetter $driveLetter
    $shrinkableMB = Get-ShrinkableMB -Drive $Drive
    $blocker = Get-LastUnmovableFile -Drive $Drive

    Write-Host ""
    Write-ColorMessage -Message ("{0} size {1} GB, used {2} GB, free {3} GB" -f $Drive, [math]::Round($volume.Size / 1GB, 1), [math]::Round(($volume.Size - $volume.SizeRemaining) / 1GB, 1), [math]::Round($volume.SizeRemaining / 1GB, 1)) -Type "Info"
    Write-ColorMessage -Message ("{0} can shrink by {1} MB" -f $Drive, $shrinkableMB) -Type "Info"
    if ($null -ne $blocker) {
        Write-ColorMessage -Message ("Last shrink blocker: {0}" -f $blocker) -Type "Info"
    }
}

function Invoke-NtfsLinuxRepair {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$DriveInfo
    )
    $drive = $DriveInfo.Drive
    $result = $null

    Show-NtfsVolumeSummary -Drive $drive
    if ($DriveInfo.Scheduled) {
        Write-ColorMessage -Message ("{0} repair is already scheduled; restart Windows, then run this item again." -f $drive) -Type "Warning"
        Request-RepairRestart -PendingDrives @($drive)
        return
    }

    Write-ColorMessage -Message "[1/4] NTFS transaction manager (TxF)" -Type "Info"
    if (Test-NtfsTransactionManagerOk -Drive $drive) {
        Write-ColorMessage -Message "TxF is running" -Type "Success"
    } else {
        & $script:DISK_FSUTIL_EXE resource setautoreset true ('{0}\' -f $drive) | Out-Host
        Write-ColorMessage -Message "TxF metadata resets at the next mount" -Type "Info"
    }

    Write-ColorMessage -Message "[2/4] File system check" -Type "Info"
    if ($DriveInfo.Dirty -or (-not (Test-NtfsReadOnlyCheckClean -Drive $drive))) {
        Write-ColorMessage -Message ("{0} has file system errors (orphan records / lost clusters); repairing with chkdsk /f" -f $drive) -Type "Warning"
        Show-ChkdskPromptHints
        $result = Invoke-DriveRepair -DriveInfo $DriveInfo
        Show-RepairResults -Results @($result)
        if ($result.Pending) {
            Write-ColorMessage -Message "After Windows restarts, run this item again to finish the remaining steps." -Type "Warning"
            Request-RepairRestart -PendingDrives @($drive)
            return
        }
    } else {
        Write-ColorMessage -Message ("{0} file system is clean" -f $drive) -Type "Success"
    }

    Write-ColorMessage -Message "[3/4] USN change journal" -Type "Info"
    Enable-NtfsUsnJournal -Drive $drive

    Write-ColorMessage -Message "[4/4] Clear shrink blockers (Linux-written files, then defrag)" -Type "Info"
    Invoke-ShrinkBlockerCleanup -Drive $drive
    Enable-NtfsUsnJournal -Drive $drive

    Show-NtfsVolumeSummary -Drive $drive
    Write-ColorMessage -Message "Done. Shrink the volume in Disk Management (Shrink Volume)." -Type "Success"
    Start-Process -FilePath $script:DISK_DISKMGMT_MSC
}

function Enable-NtfsUsnJournal {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    if (Test-NtfsUsnJournalActive -Drive $Drive) {
        Write-ColorMessage -Message "USN journal is active" -Type "Success"
        return
    }
    & $script:DISK_FSUTIL_EXE usn createjournal ("m={0}" -f $script:DISK_USN_MAX_SIZE) ("a={0}" -f $script:DISK_USN_ALLOCATION_DELTA) $Drive | Out-Host
}

function Invoke-ShrinkDefrag {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    Start-Process -FilePath $script:DISK_DEFRAG_EXE -ArgumentList (@($Drive) + $script:DISK_SHRINK_DEFRAG_ARGUMENTS) -WorkingDirectory $env:SystemRoot -NoNewWindow -Wait | Out-Null
}
#endregion

#region Shrink
function Get-ShrinkableMB {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $driveLetter = $Drive.TrimEnd(':')
    $partition = $null
    $supported = $null

    Update-HostStorageCache
    $partition = Get-Partition -DriveLetter $driveLetter
    $supported = Get-PartitionSupportedSize -DriveLetter $driveLetter
    return [math]::Floor(($partition.Size - $supported.SizeMin) / 1MB)
}

function Get-DrivePageFileSettings {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    @(Get-CimInstance Win32_PageFileSetting -ErrorAction SilentlyContinue | Where-Object { (Split-Path $_.Name -Qualifier) -eq $Drive })
}

function Invoke-NtfsPathRewrite {
    param(
        [Parameter(Mandatory = $true)] [string]$Path
    )
    $rewritePath = '{0}{1}' -f $Path, $script:DISK_SHRINK_REWRITE_SUFFIX
    $process = $null

    if (Test-Path -LiteralPath $rewritePath) {
        Write-ColorMessage -Message ("{0} exists from an interrupted rewrite; merge or remove it first." -f $rewritePath) -Type "Error"
        return $false
    }
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        Copy-Item -LiteralPath $Path -Destination $rewritePath -Force
        Move-Item -LiteralPath $rewritePath -Destination $Path -Force
        return $true
    }
    $process = Start-Process -FilePath $script:DISK_ROBOCOPY_EXE -ArgumentList (@($Path, $rewritePath) + $script:DISK_SHRINK_ROBOCOPY_ARGUMENTS) -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ge $script:DISK_ROBOCOPY_FAILURE_CODE) {
        Write-ColorMessage -Message ("robocopy failed with exit code {0}" -f $process.ExitCode) -Type "Error"
    }
    if (Test-Path -LiteralPath $Path) {
        Write-ColorMessage -Message ("Some files of {0} could not be moved (in use or Linux symlinks); moving the rewritten files back." -f $Path) -Type "Warning"
        Start-Process -FilePath $script:DISK_ROBOCOPY_EXE -ArgumentList (@($rewritePath, $Path) + $script:DISK_SHRINK_ROBOCOPY_ARGUMENTS) -NoNewWindow -Wait | Out-Null
        return $true
    }
    Rename-Item -LiteralPath $rewritePath -NewName (Split-Path $Path -Leaf)
    return $true
}

function Resolve-ShrinkBlocker {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive,
        [Parameter(Mandatory = $true)] [string]$Blocker
    )
    $blockerParts = $Blocker -split '::', 2
    $segments = @($blockerParts[0].TrimStart('\') -split '\\')
    $stream = if ($blockerParts.Count -gt 1) { $blockerParts[1] } else { "" }
    $topName = $segments[0]
    $rewritePath = Join-Path ('{0}\' -f $Drive) $topName
    $pageFileSettings = @()

    if ($topName -eq $script:DISK_RECYCLE_BIN_DIR) {
        if (-not (Read-YesNoDefaultNo -Message ("The Recycle Bin of {0} blocks the shrink. Empty it?" -f $Drive))) {
            return $script:DISK_SHRINK_UNRESOLVED
        }
        Clear-RecycleBin -DriveLetter $Drive.TrimEnd(':') -Force
        return $script:DISK_SHRINK_RESOLVED
    }
    if ($topName -eq $script:DISK_SYSTEM_VOLUME_INFO_DIR) {
        if (-not (Read-YesNoDefaultNo -Message ("Shadow copies (restore points) of {0} block the shrink. Delete them?" -f $Drive))) {
            return $script:DISK_SHRINK_UNRESOLVED
        }
        & $script:DISK_VSSADMIN_EXE delete shadows ("/for={0}" -f $Drive) /all /quiet | Out-Host
        return $script:DISK_SHRINK_RESOLVED
    }
    if ($topName -eq $script:DISK_EXTEND_DIR) {
        & $script:DISK_FSUTIL_EXE usn deletejournal /d $Drive | Out-Host
        return $script:DISK_SHRINK_RESOLVED
    }
    if ($script:DISK_PAGE_FILE_NAMES -contains $topName) {
        $pageFileSettings = @(Get-DrivePageFileSettings -Drive $Drive)
        if ($pageFileSettings.Count -eq 0) {
            Write-ColorMessage -Message "The page file is system managed; move it in SystemPropertiesPerformance.exe > Advanced > Virtual memory." -Type "Warning"
            return $script:DISK_SHRINK_UNRESOLVED
        }
        if (-not (Read-YesNoDefaultNo -Message ("The page file of {0} blocks the shrink. Remove it (takes effect after a restart)?" -f $Drive))) {
            return $script:DISK_SHRINK_UNRESOLVED
        }
        $pageFileSettings | Remove-CimInstance
        return $script:DISK_SHRINK_RESTART
    }
    if ($topName.StartsWith('$')) {
        Write-ColorMessage -Message "NTFS metadata cannot be moved while Windows runs." -Type "Warning"
        return $script:DISK_SHRINK_UNRESOLVED
    }
    if ($stream -ne $script:DISK_SECURITY_DESCRIPTOR_STREAM) {
        return $script:DISK_SHRINK_UNRESOLVED
    }
    Write-ColorMessage -Message ("Linux-written files keep their own security descriptor, which Windows cannot move; rewriting {0} through Windows." -f $rewritePath) -Type "Warning"
    if (Invoke-NtfsPathRewrite -Path $rewritePath) {
        return $script:DISK_SHRINK_RESOLVED
    }
    return $script:DISK_SHRINK_UNRESOLVED
}

function Invoke-ShrinkBlockerCleanup {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $freeMB = [math]::Floor((Get-Volume -DriveLetter $Drive.TrimEnd(':')).SizeRemaining / 1MB)
    $shrinkableMB = 0
    $previousMB = -1
    $pass = 0
    $blocker = $null
    $previousBlocker = $null
    $status = $script:DISK_SHRINK_UNRESOLVED
    $stalled = $false

    Write-ColorMessage -Message ("Querying the shrinkable size of {0} (can take minutes)..." -f $Drive) -Type "Info"
    $shrinkableMB = Get-ShrinkableMB -Drive $Drive
    Write-ColorMessage -Message ("{0} can shrink by {1} of {2} MB free" -f $Drive, $shrinkableMB, $freeMB) -Type "Info"
    while ((-not $stalled) -and ($pass -lt $script:DISK_SHRINK_MAX_PASSES)) {
        $pass++
        $previousMB = $shrinkableMB
        $blocker = Get-LastUnmovableFile -Drive $Drive
        Write-ColorMessage -Message ("[pass {0}/{1}] shrink blocker: {2}" -f $pass, $script:DISK_SHRINK_MAX_PASSES, $blocker) -Type "Info"
        $status = $script:DISK_SHRINK_UNRESOLVED
        if (($null -ne $blocker) -and ($blocker -ne $previousBlocker)) {
            $status = Resolve-ShrinkBlocker -Drive $Drive -Blocker $blocker
        }
        if ($status -eq $script:DISK_SHRINK_RESTART) {
            Write-ColorMessage -Message "Restart Windows, then run this item again to continue." -Type "Warning"
            return
        }
        if ($status -eq $script:DISK_SHRINK_UNRESOLVED) {
            Write-ColorMessage -Message ("defrag {0} {1}" -f $Drive, ($script:DISK_SHRINK_DEFRAG_ARGUMENTS -join " ")) -Type "Info"
            Invoke-ShrinkDefrag -Drive $Drive
        }
        $previousBlocker = $blocker
        $shrinkableMB = Get-ShrinkableMB -Drive $Drive
        $stalled = ($status -eq $script:DISK_SHRINK_UNRESOLVED) -and ($shrinkableMB -le $previousMB)
        Write-ColorMessage -Message ("{0} can shrink by {1} of {2} MB free" -f $Drive, $shrinkableMB, $freeMB) -Type "Info"
    }
}
#endregion
