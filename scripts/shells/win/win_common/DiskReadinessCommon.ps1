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
