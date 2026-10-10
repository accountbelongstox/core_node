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
$script:DISK_ROBOCOPY_EXE = Join-Path $script:DISK_SYSTEM32_DIR "Robocopy.exe"
$script:DISK_NTFS_PROVIDER = "Ntfs"
$script:DISK_NTFS_ERROR_EVENT_IDS = @(55, 98, 137, 140)
$script:DISK_NTFS_EVENT_DAYS = 30
$script:DISK_SHRINK_EVENT_ID = 259
$script:DISK_SHRINK_EVENT_MARKER = "The last unmovable file appears to be:"
$script:DISK_LOST_SPACE_WARN_RATIO = 0.05
$script:DISK_USN_MAX_SIZE = "0x2000000"
$script:DISK_USN_ALLOCATION_DELTA = "0x800000"
$script:DISK_SHRINK_DEFRAG_ARGUMENTS = @("/X", "/U", "/V")
$script:DISK_ROBOCOPY_LIST_ARGUMENTS = @("/L", "/S", "/XJ", "/BYTES", "/NJH", "/NDL", "/NFL", "/NC", "/NS", "/NP", "/R:0", "/W:0")
$script:DISK_ROBOCOPY_BYTES_LABEL = "Bytes :"
$script:DISK_HIBERFIL = Join-Path $env:SystemDrive "hiberfil.sys"
$script:DISK_STORAGE_NAMESPACE = "root/Microsoft/Windows/Storage"
$script:DISK_ENCRYPTION_NAMESPACE = "root/cimv2/Security/MicrosoftVolumeEncryption"
$script:DISK_INTERNAL_ENCRYPTABLE_TYPES = @(0, 1)
$script:DISK_FILE_SYSTEMS = @("NTFS", "FAT", "FAT32", "exFAT")
$script:DISK_FIXED_DRIVE_TYPE = 3
$script:DISK_HEALTHY_STATUS = 0
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
        ($null -ne $_.DriveLetter) -and ([int]$_.HealthStatus -ne $script:DISK_HEALTHY_STATUS)
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
function Get-NtfsVolumeFileBytes {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $sourceRoot = '{0}\' -f $Drive
    $listTarget = Join-Path $env:TEMP ("ntfs-scan-{0}" -f [guid]::NewGuid().ToString("N"))
    $bytesLine = $null

    Write-ColorMessage -Message ("Listing every file on {0} (read-only, can take several minutes)..." -f $Drive) -Type "Info"
    $output = & $script:DISK_ROBOCOPY_EXE $sourceRoot $listTarget @($script:DISK_ROBOCOPY_LIST_ARGUMENTS)
    $bytesLine = @($output | Where-Object { $_.Trim().StartsWith($script:DISK_ROBOCOPY_BYTES_LABEL) }) | Select-Object -Last 1
    if ($null -eq $bytesLine) {
        return $null
    }
    return [int64](($bytesLine.Trim().Substring($script:DISK_ROBOCOPY_BYTES_LABEL.Length).Trim() -split '\s+')[0])
}

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

function Test-NtfsDirty {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    return [bool](Get-CimInstance Win32_Volume | Where-Object { $_.DriveLetter -eq $Drive } | Select-Object -First 1).DirtyBitSet
}

function Get-NtfsErrorEvents {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $filter = @{ LogName = "System"; ProviderName = $script:DISK_NTFS_PROVIDER; Id = $script:DISK_NTFS_ERROR_EVENT_IDS; StartTime = (Get-Date).AddDays(-$script:DISK_NTFS_EVENT_DAYS) }

    @(Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue | Where-Object { $_.Message -like ('*{0}*' -f $Drive) })
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
    return [PSCustomObject]@{
        Time = $shrinkEvent.TimeCreated
        File = $markerLine.Substring($markerLine.IndexOf($script:DISK_SHRINK_EVENT_MARKER) + $script:DISK_SHRINK_EVENT_MARKER.Length).Trim()
    }
}

function Get-NtfsHealthReport {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive,
        [Parameter()] [switch]$CountFiles
    )
    $driveLetter = $Drive.TrimEnd(':')
    $volume = Get-Volume -DriveLetter $driveLetter
    $usedBytes = $volume.Size - $volume.SizeRemaining
    $supported = Get-PartitionSupportedSize -DriveLetter $driveLetter -ErrorAction SilentlyContinue
    $fileBytes = if ($CountFiles) { Get-NtfsVolumeFileBytes -Drive $Drive } else { $null }

    return [PSCustomObject]@{
        Drive            = $Drive
        SizeGB           = [math]::Round($volume.Size / 1GB, 1)
        UsedGB           = [math]::Round($usedBytes / 1GB, 1)
        FreeGB           = [math]::Round($volume.SizeRemaining / 1GB, 1)
        FileGB           = if ($null -ne $fileBytes) { [math]::Round($fileBytes / 1GB, 1) } else { $null }
        LostGB           = if ($null -ne $fileBytes) { [math]::Round(($usedBytes - $fileBytes) / 1GB, 1) } else { $null }
        LostSuspect      = ($null -ne $fileBytes) -and (($usedBytes - $fileBytes) -gt ($volume.Size * $script:DISK_LOST_SPACE_WARN_RATIO))
        Dirty            = Test-NtfsDirty -Drive $Drive
        TxfOk            = Test-NtfsTransactionManagerOk -Drive $Drive
        UsnActive        = Test-NtfsUsnJournalActive -Drive $Drive
        ErrorEvents      = @(Get-NtfsErrorEvents -Drive $Drive)
        ShrinkableGB     = if ($null -ne $supported) { [math]::Round(($supported.SizeMax - $supported.SizeMin) / 1GB, 1) } else { $null }
        LastUnmovable    = Get-LastUnmovableFile -Drive $Drive
        RepairScheduled  = Test-DriveRepairScheduled -Drive $Drive
    }
}

function Show-NtfsHealthReport {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$Report
    )

    Write-Host ""
    Write-ColorMessage -Message ("========== NTFS health: {0} ==========" -f $Report.Drive) -Type "Info"
    Write-Host ("  Size {0} GB, used {1} GB, free {2} GB" -f $Report.SizeGB, $Report.UsedGB, $Report.FreeGB)
    if ($null -ne $Report.FileGB) {
        Write-Host ("  Files total {0} GB, used space not owned by any listed file: {1} GB" -f $Report.FileGB, $Report.LostGB)
        if ($Report.LostSuspect) {
            Write-ColorMessage -Message "  Used space is far above the file total: clusters are marked used without an owner (lost clusters / bitmap). chkdsk /f frees them." -Type "Error"
        }
    }
    if ($Report.Dirty) { Write-ColorMessage -Message "  Dirty bit is set: Windows wants chkdsk." -Type "Error" }
    if (-not $Report.TxfOk) { Write-ColorMessage -Message "  NTFS transaction manager (TxF) failed to start: its metadata was damaged, typically by a Linux NTFS driver." -Type "Error" }
    if (-not $Report.UsnActive) { Write-ColorMessage -Message "  USN change journal is not active." -Type "Warning" }
    foreach ($ntfsEvent in $Report.ErrorEvents) {
        Write-ColorMessage -Message ("  NTFS event {0} at {1}" -f $ntfsEvent.Id, $ntfsEvent.TimeCreated) -Type "Warning"
    }
    if ($null -ne $Report.ShrinkableGB) {
        Write-Host ("  Shrinkable now: {0} GB" -f $Report.ShrinkableGB)
    }
    if ($null -ne $Report.LastUnmovable) {
        Write-Host ("  Last shrink blocker ({0}): {1}" -f $Report.LastUnmovable.Time, $Report.LastUnmovable.File)
    }
    if ($Report.RepairScheduled) {
        Write-ColorMessage -Message "  chkdsk is scheduled for the next Windows startup." -Type "Warning"
    }
    if ($Report.TxfOk -and (-not $Report.Dirty) -and (-not $Report.LostSuspect) -and ($Report.ErrorEvents.Count -eq 0)) {
        Write-ColorMessage -Message "  No NTFS damage signs found by this check (run chkdsk read-only scan for a full check)." -Type "Success"
    }
}

function Invoke-NtfsReadOnlyCheck {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    Write-ColorMessage -Message ("chkdsk {0} (read-only, no changes)" -f $Drive) -Type "Info"
    & $script:DISK_CHKDSK_EXE $Drive | Where-Object { $_ -notlike "*Progress:*" } | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Message ("{0}: no errors found" -f $Drive) -Type "Success"
    } else {
        Write-ColorMessage -Message ("{0}: errors found (orphan records, index or bitmap damage); run the repair item." -f $Drive) -Type "Error"
    }
}

function Reset-NtfsTransactionManager {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    if (Test-NtfsTransactionManagerOk -Drive $Drive) {
        Write-ColorMessage -Message ("{0} transaction manager is running" -f $Drive) -Type "Success"
        return
    }
    & $script:DISK_FSUTIL_EXE resource setautoreset true ('{0}\' -f $Drive) | Out-Host
    Write-ColorMessage -Message ("{0} transaction manager metadata resets at the next mount (restart or chkdsk dismount)" -f $Drive) -Type "Info"
}

function Enable-NtfsUsnJournal {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    if (Test-NtfsUsnJournalActive -Drive $Drive) {
        Write-ColorMessage -Message ("{0} USN journal is active" -f $Drive) -Type "Success"
        return
    }
    & $script:DISK_FSUTIL_EXE usn createjournal ("m={0}" -f $script:DISK_USN_MAX_SIZE) ("a={0}" -f $script:DISK_USN_ALLOCATION_DELTA) $Drive | Out-Host
}

function Invoke-NtfsLinuxRepair {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$DriveInfo
    )

    Reset-NtfsTransactionManager -Drive $DriveInfo.Drive
    Show-ChkdskPromptHints
    $result = Invoke-DriveRepair -DriveInfo $DriveInfo
    Show-RepairResults -Results @($result)
    if ($result.Pending) {
        Write-ColorMessage -Message "After the restart, open this menu again and run 'After repair' to finish." -Type "Warning"
        Request-RepairRestart -PendingDrives @($result.Drive)
        return
    }
    Enable-NtfsUsnJournal -Drive $DriveInfo.Drive
    Show-NtfsHealthReport -Report (Get-NtfsHealthReport -Drive $DriveInfo.Drive)
}

function Invoke-NtfsShrinkPrepare {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    Write-ColorMessage -Message ("defrag {0} {1} (consolidate free space toward the start)" -f $Drive, ($script:DISK_SHRINK_DEFRAG_ARGUMENTS -join " ")) -Type "Info"
    Start-Process -FilePath $script:DISK_DEFRAG_EXE -ArgumentList (@($Drive) + $script:DISK_SHRINK_DEFRAG_ARGUMENTS) -WorkingDirectory $env:SystemRoot -NoNewWindow -Wait | Out-Null
    Show-NtfsHealthReport -Report (Get-NtfsHealthReport -Drive $Drive)
    Write-ColorMessage -Message "If a page file, hibernation file or System Volume Information is the blocker, move or disable it, then run this item again." -Type "Info"
}
#endregion
