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
$script:DISK_SHRINK_FREE_TOLERANCE_MB = 1024
$script:DISK_DISKPART_EXE = Join-Path $script:DISK_SYSTEM32_DIR "diskpart.exe"
$script:DISK_DISKPART_QUERY_FILE = "core_node_shrink_querymax.txt"
$script:DISK_DISKPART_RECLAIMABLE_PATTERN = '\((\d+)\s*MB\)'
$script:DISK_SHRINK_RESOLVED = "resolved"
$script:DISK_SHRINK_RESTART = "restart"
$script:DISK_SHRINK_UNRESOLVED = "unresolved"
$script:DISK_EXTEND_DIR = '$Extend'
$script:DISK_PAGE_FILE_NAMES = @("pagefile.sys", "swapfile.sys")
$script:DISK_DISKMGMT_MSC = Join-Path $script:DISK_SYSTEM32_DIR "diskmgmt.msc"
$script:DISK_LINUX_CACHE_DIRS = @(".pnpm-store", ".pnpm-store.shrink-rewrite", ".cache", ".npm", "~\.cache", "~\.npm", "~\.pnpm-store")
$script:DISK_VSSADMIN_EXE = Join-Path $script:DISK_SYSTEM32_DIR "vssadmin.exe"
$script:DISK_SHRINK_REWRITE_SUFFIX = ".shrink-rewrite"
$script:DISK_NTFS_SECURITY_TYPE = "CoreNode.NtfsLegacySecurity"
$script:DISK_NTFS_SECURITY_SOURCE = @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace CoreNode
{
    public static class NtfsLegacySecurity
    {
        const uint GenericRead = 0x80000000;
        const uint ShareAll = 7;
        const uint OpenExisting = 3;
        const uint BackupSemantics = 0x02000000;
        const uint OpenReparsePoint = 0x00200000;
        const uint ReadAttributes = 0x00000080;
        const uint ReadControl = 0x00020000;
        const uint WriteDac = 0x00040000;
        const uint WriteOwner = 0x00080000;
        const uint AccessSystemSecurity = 0x01000000;
        const uint FullSecurityInfo = 0xF;
        const uint BaseSecurityInfo = 0x7;
        const uint FsctlGetNtfsVolumeData = 0x00090064;
        const uint FsctlGetRetrievalPointers = 0x00090073;
        const int ErrorMoreData = 234;
        const int ReadChunk = 4 * 1024 * 1024;
        const uint AttributeSecurityDescriptor = 0x50;
        const uint AttributeEnd = 0xFFFFFFFF;
        const ushort RecordInUse = 0x0001;
        const int SectorSize = 512;

        [StructLayout(LayoutKind.Sequential)]
        struct FileIdDescriptor { public int Size; public int Type; public long FileId; public long Padding; }

        [StructLayout(LayoutKind.Sequential)]
        struct LuidAndAttributes { public long Luid; public uint Attributes; }

        [StructLayout(LayoutKind.Sequential)]
        struct TokenPrivileges { public uint Count; public LuidAndAttributes Privilege; }

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern SafeFileHandle OpenFileById(SafeFileHandle hint, ref FileIdDescriptor id, uint access, uint share, IntPtr security, uint flags);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool DeviceIoControl(SafeFileHandle device, uint code, byte[] input, int inputSize, byte[] output, int outputSize, out int returned, IntPtr overlapped);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetFilePointerEx(SafeFileHandle file, long distance, out long newPosition, uint method);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool ReadFile(SafeFileHandle file, byte[] buffer, int size, out int read, IntPtr overlapped);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool GetKernelObjectSecurity(SafeFileHandle handle, uint info, byte[] descriptor, int length, out int needed);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool SetKernelObjectSecurity(SafeFileHandle handle, uint info, byte[] descriptor);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool LookupPrivilegeValue(string system, string name, out long luid);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TokenPrivileges state, int length, IntPtr previous, IntPtr returned);

        [DllImport("kernel32.dll")]
        static extern IntPtr GetCurrentProcess();

        public static void EnablePrivileges(string[] names)
        {
            IntPtr token;
            if (!OpenProcessToken(GetCurrentProcess(), 0x0028, out token)) throw new Win32Exception();
            foreach (string name in names)
            {
                TokenPrivileges state = new TokenPrivileges();
                state.Count = 1;
                state.Privilege.Attributes = 2;
                if (LookupPrivilegeValue(null, name, out state.Privilege.Luid))
                {
                    AdjustTokenPrivileges(token, false, ref state, 0, IntPtr.Zero, IntPtr.Zero);
                }
            }
        }

        static SafeFileHandle OpenVolume(string drive)
        {
            SafeFileHandle volume = CreateFile(@"\\.\" + drive, GenericRead, ShareAll, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
            if (volume.IsInvalid) throw new Win32Exception();
            return volume;
        }

        static void ApplyFixups(byte[] record, int offset, int length)
        {
            int usaOffset = BitConverter.ToUInt16(record, offset + 4);
            int usaCount = BitConverter.ToUInt16(record, offset + 6);
            for (int sector = 1; sector < usaCount && sector * SectorSize <= length; sector++)
            {
                int tail = offset + sector * SectorSize - 2;
                if (record[tail] == record[offset + usaOffset] && record[tail + 1] == record[offset + usaOffset + 1])
                {
                    record[tail] = record[offset + usaOffset + sector * 2];
                    record[tail + 1] = record[offset + usaOffset + sector * 2 + 1];
                }
            }
        }

        static bool HasNonResidentSecurity(byte[] record, int offset, int length)
        {
            int position = offset + BitConverter.ToUInt16(record, offset + 0x14);
            int end = offset + length;
            while (position + 16 <= end)
            {
                uint type = BitConverter.ToUInt32(record, position);
                int attributeLength = BitConverter.ToInt32(record, position + 4);
                if (type == AttributeEnd || attributeLength <= 0) return false;
                if (type == AttributeSecurityDescriptor) return record[position + 8] != 0;
                position += attributeLength;
            }
            return false;
        }

        static void CheckRecord(byte[] buffer, int offset, int recordSize, long number, HashSet<long> found)
        {
            if (buffer[offset] != (byte)'F' || buffer[offset + 1] != (byte)'I' || buffer[offset + 2] != (byte)'L' || buffer[offset + 3] != (byte)'E') return;
            if ((BitConverter.ToUInt16(buffer, offset + 0x16) & RecordInUse) == 0) return;
            ApplyFixups(buffer, offset, recordSize);
            if (!HasNonResidentSecurity(buffer, offset, recordSize)) return;
            long baseReference = BitConverter.ToInt64(buffer, offset + 0x20);
            long sequence = BitConverter.ToUInt16(buffer, offset + 0x10);
            found.Add(baseReference != 0 ? baseReference : ((sequence << 48) | number));
        }

        static List<long[]> GetMftExtents(SafeFileHandle volume, string drive, long clusterSize)
        {
            List<long[]> extents = new List<long[]>();
            using (SafeFileHandle mft = CreateFile(drive + @"\$MFT", ReadAttributes, ShareAll, IntPtr.Zero, OpenExisting, BackupSemantics, IntPtr.Zero))
            {
                if (mft.IsInvalid) throw new Win32Exception();
                byte[] input = new byte[8];
                byte[] output = new byte[64 * 1024];
                long vcn = 0;
                while (true)
                {
                    BitConverter.GetBytes(vcn).CopyTo(input, 0);
                    int returned;
                    bool ok = DeviceIoControl(mft, FsctlGetRetrievalPointers, input, 8, output, output.Length, out returned, IntPtr.Zero);
                    int error = Marshal.GetLastWin32Error();
                    if (!ok && error != ErrorMoreData) throw new Win32Exception(error);
                    int count = BitConverter.ToInt32(output, 0);
                    long previousVcn = BitConverter.ToInt64(output, 8);
                    for (int index = 0; index < count; index++)
                    {
                        long nextVcn = BitConverter.ToInt64(output, 16 + index * 16);
                        long lcn = BitConverter.ToInt64(output, 24 + index * 16);
                        extents.Add(new long[] { previousVcn * clusterSize, lcn * clusterSize, (nextVcn - previousVcn) * clusterSize });
                        previousVcn = nextVcn;
                    }
                    if (ok) break;
                    vcn = previousVcn;
                }
            }
            return extents;
        }

        public static long[] FindNonResidentSecurity(string drive)
        {
            HashSet<long> found = new HashSet<long>();
            using (SafeFileHandle volume = OpenVolume(drive))
            {
                byte[] volumeData = new byte[128];
                int returned;
                if (!DeviceIoControl(volume, FsctlGetNtfsVolumeData, null, 0, volumeData, volumeData.Length, out returned, IntPtr.Zero)) throw new Win32Exception();
                long clusterSize = BitConverter.ToInt32(volumeData, 44);
                int recordSize = BitConverter.ToInt32(volumeData, 48);
                long mftLength = BitConverter.ToInt64(volumeData, 56);
                byte[] buffer = new byte[ReadChunk];
                foreach (long[] extent in GetMftExtents(volume, drive, clusterSize))
                {
                    if (extent[0] >= mftLength) break;
                    long length = Math.Min(extent[2], mftLength - extent[0]);
                    for (long done = 0; done < length; done += ReadChunk)
                    {
                        int size = (int)Math.Min(ReadChunk, length - done);
                        long ignored;
                        if (!SetFilePointerEx(volume, extent[1] + done, out ignored, 0)) throw new Win32Exception();
                        if (!ReadFile(volume, buffer, size, out returned, IntPtr.Zero)) throw new Win32Exception();
                        for (int offset = 0; offset + recordSize <= returned; offset += recordSize)
                        {
                            CheckRecord(buffer, offset, recordSize, (extent[0] + done + offset) / recordSize, found);
                        }
                    }
                }
            }
            long[] result = new long[found.Count];
            found.CopyTo(result);
            return result;
        }

        static bool RewriteHandle(SafeFileHandle handle, uint info)
        {
            int needed;
            GetKernelObjectSecurity(handle, info, null, 0, out needed);
            if (needed <= 0) return false;
            byte[] descriptor = new byte[needed];
            if (!GetKernelObjectSecurity(handle, info, descriptor, needed, out needed)) return false;
            return SetKernelObjectSecurity(handle, info, descriptor);
        }

        static bool RewriteById(SafeFileHandle hint, long fileId)
        {
            FileIdDescriptor descriptor = new FileIdDescriptor();
            descriptor.Size = Marshal.SizeOf(typeof(FileIdDescriptor));
            descriptor.FileId = fileId;
            uint flags = BackupSemantics | OpenReparsePoint;
            using (SafeFileHandle handle = OpenFileById(hint, ref descriptor, ReadControl | WriteDac | WriteOwner | AccessSystemSecurity, ShareAll, IntPtr.Zero, flags))
            {
                if (!handle.IsInvalid) return RewriteHandle(handle, FullSecurityInfo);
            }
            using (SafeFileHandle handle = OpenFileById(hint, ref descriptor, ReadControl | WriteDac | WriteOwner, ShareAll, IntPtr.Zero, flags))
            {
                return !handle.IsInvalid && RewriteHandle(handle, BaseSecurityInfo);
            }
        }

        public static int[] RewriteSecurity(string drive, long[] fileIds)
        {
            int converted = 0;
            int failed = 0;
            using (SafeFileHandle hint = CreateFile(drive + @"\", 0, ShareAll, IntPtr.Zero, OpenExisting, BackupSemantics, IntPtr.Zero))
            {
                if (hint.IsInvalid) throw new Win32Exception();
                foreach (long fileId in fileIds)
                {
                    if (RewriteById(hint, fileId)) converted++; else failed++;
                }
            }
            return new int[] { converted, failed };
        }
    }
}
'@
$script:DISK_SECURITY_PRIVILEGES = @("SeBackupPrivilege", "SeRestorePrivilege", "SeSecurityPrivilege", "SeTakeOwnershipPrivilege")
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

    Write-ColorMessage -Message "[1/5] NTFS transaction manager (TxF)" -Type "Info"
    if (Test-NtfsTransactionManagerOk -Drive $drive) {
        Write-ColorMessage -Message "TxF is running" -Type "Success"
    } else {
        & $script:DISK_FSUTIL_EXE resource setautoreset true ('{0}\' -f $drive) | Out-Host
        Write-ColorMessage -Message "TxF metadata resets at the next mount" -Type "Info"
    }

    Write-ColorMessage -Message "[2/5] File system check" -Type "Info"
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

    Write-ColorMessage -Message "[3/5] USN change journal" -Type "Info"
    Enable-NtfsUsnJournal -Drive $drive

    Write-ColorMessage -Message "[4/5] Linux cache folders" -Type "Info"
    Remove-LinuxCacheDirs -Drive $drive

    Write-ColorMessage -Message "[5/5] Clear shrink blockers (Linux-written security descriptors, then defrag)" -Type "Info"
    Restore-ShrinkRewriteLeftovers -Drive $drive
    Convert-NtfsLegacySecurity -Drive $drive | Out-Null
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
    $scriptPath = Join-Path $env:TEMP $script:DISK_DISKPART_QUERY_FILE
    $output = $null
    $match = $null

    Set-Content -LiteralPath $scriptPath -Value @(("select volume {0}" -f $Drive.TrimEnd(':')), "shrink querymax") -Encoding Ascii
    $output = (& $script:DISK_DISKPART_EXE /s $scriptPath) -join "`n"
    Remove-Item -LiteralPath $scriptPath -Force
    $match = [regex]::Match($output, $script:DISK_DISKPART_RECLAIMABLE_PATTERN)
    if (-not $match.Success) {
        Write-ColorMessage -Message $output -Type "Error"
        return 0
    }
    return [long]$match.Groups[1].Value
}

function Get-ProgramDriveCreateSizeMB {
    param(
        [Parameter(Mandatory = $true)] [long]$ShrinkableMB
    )

    if ($ShrinkableMB -lt $Global:CN_PROGRAM_DRIVE_CREATE_MIN_MB) {
        return [long][math]::Floor($ShrinkableMB * $Global:CN_PROGRAM_DRIVE_CREATE_SMALL_RATIO)
    }
    return [math]::Min($ShrinkableMB, $Global:CN_PROGRAM_DRIVE_CREATE_MAX_MB)
}

function New-ProgramDrivePartition {
    param(
        [Parameter(Mandatory = $true)] [string]$SourceDrive,
        [Parameter(Mandatory = $true)] [string]$TargetDrive
    )
    $sourceLetter = $SourceDrive.TrimEnd(':', '\')
    $targetLetter = $TargetDrive.TrimEnd(':', '\')
    $scriptPath = Join-Path $env:TEMP $script:DISK_DISKPART_QUERY_FILE
    $shrinkableMB = 0
    $sizeMB = 0
    $diskNumber = $null
    $partition = $null

    if (Get-PSDrive -Name $targetLetter -PSProvider FileSystem -ErrorAction SilentlyContinue) {
        return $false
    }
    Write-ColorMessage -Message ("Creating program drive {0}: from the free space of {1}: (can take minutes)..." -f $targetLetter, $sourceLetter) -Type "Info"
    $shrinkableMB = Get-ShrinkableMB -Drive ('{0}:' -f $sourceLetter)
    $sizeMB = Get-ProgramDriveCreateSizeMB -ShrinkableMB $shrinkableMB
    if ($sizeMB -le 0) {
        Write-ColorMessage -Message ("{0}: has no shrinkable space for {1}:" -f $sourceLetter, $targetLetter) -Type "Warning"
        return $false
    }
    Write-ColorMessage -Message ("{0}: can shrink by {1} MB; giving {2} MB to {3}:" -f $sourceLetter, $shrinkableMB, $sizeMB, $targetLetter) -Type "Info"
    $diskNumber = (Get-Partition -DriveLetter $sourceLetter).DiskNumber
    Set-Content -LiteralPath $scriptPath -Value @(("select volume {0}" -f $sourceLetter), ("shrink desired={0}" -f $sizeMB)) -Encoding Ascii
    & $script:DISK_DISKPART_EXE /s $scriptPath | Out-Host
    Remove-Item -LiteralPath $scriptPath -Force
    Update-HostStorageCache
    $partition = New-Partition -DiskNumber $diskNumber -UseMaximumSize -DriveLetter $targetLetter -ErrorAction Stop
    Format-Volume -Partition $partition -FileSystem NTFS -NewFileSystemLabel $Global:CN_PROGRAM_DRIVE_CREATE_LABEL -Confirm:$false -ErrorAction Stop | Out-Null
    Write-ColorMessage -Message ("Program drive {0}: created ({1} GB)" -f $targetLetter, [math]::Round($partition.Size / 1GB, 1)) -Type "Success"
    return $true
}

function Get-DrivePageFileSettings {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )

    @(Get-CimInstance Win32_PageFileSetting -ErrorAction SilentlyContinue | Where-Object { (Split-Path $_.Name -Qualifier) -eq $Drive })
}

function Remove-LinuxCacheDirs {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $driveRoot = '{0}\' -f $Drive
    $cachePaths = @($script:DISK_LINUX_CACHE_DIRS | ForEach-Object { Join-Path $driveRoot $_ } | Where-Object { Test-Path -LiteralPath $_ -PathType Container })

    if ($cachePaths.Count -eq 0) {
        Write-ColorMessage -Message "No Linux cache folder found" -Type "Success"
        return
    }
    $cachePaths | ForEach-Object { Write-ColorMessage -Message ("  {0}" -f $_) -Type "Info" }
    Write-ColorMessage -Message "These caches are rebuilt on demand; installed node_modules keep their files." -Type "Info"
    if (-not (Read-YesNoDefaultYes -Message "Delete these Linux cache folders?")) {
        return
    }
    foreach ($cachePath in $cachePaths) {
        Write-ColorMessage -Message ("Deleting {0}..." -f $cachePath) -Type "Info"
        & $env:ComSpec /c rd /s /q $cachePath | Out-Host
        if (Test-Path -LiteralPath $cachePath) {
            Write-ColorMessage -Message ("{0} is partly in use and was not fully deleted" -f $cachePath) -Type "Warning"
        }
    }
}

function Import-NtfsLegacySecurity {
    if ($null -eq ($script:DISK_NTFS_SECURITY_TYPE -as [type])) {
        Add-Type -TypeDefinition $script:DISK_NTFS_SECURITY_SOURCE
    }
    [CoreNode.NtfsLegacySecurity]::EnablePrivileges($script:DISK_SECURITY_PRIVILEGES)
}

function Convert-NtfsLegacySecurity {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $fileIds = @()
    $result = $null

    Import-NtfsLegacySecurity
    Write-ColorMessage -Message ("Scanning the MFT of {0} for Linux-written security descriptors (can take minutes)..." -f $Drive) -Type "Info"
    $fileIds = [CoreNode.NtfsLegacySecurity]::FindNonResidentSecurity($Drive)
    if ($fileIds.Count -eq 0) {
        Write-ColorMessage -Message "No Linux-written security descriptor found" -Type "Success"
        return 0
    }
    Write-ColorMessage -Message ("{0} files and folders keep their own security descriptor, which Windows cannot move; storing the same permissions the Windows way..." -f $fileIds.Count) -Type "Warning"
    $result = [CoreNode.NtfsLegacySecurity]::RewriteSecurity($Drive, $fileIds)
    Write-ColorMessage -Message ("Converted {0}, failed {1}" -f $result[0], $result[1]) -Type $(if ($result[1] -eq 0) { "Success" } else { "Warning" })
    return $result[0]
}

function Restore-ShrinkRewriteLeftovers {
    param(
        [Parameter(Mandatory = $true)] [string]$Drive
    )
    $driveRoot = '{0}\' -f $Drive
    $rewriteDirs = @(Get-ChildItem -LiteralPath $driveRoot -Force -Directory -Filter ('*{0}' -f $script:DISK_SHRINK_REWRITE_SUFFIX) -ErrorAction SilentlyContinue)
    $originalPath = $null
    $targetPath = $null
    $relativePath = $null
    $restored = 0
    $kept = 0

    foreach ($rewriteDir in $rewriteDirs) {
        $originalPath = $rewriteDir.FullName.Substring(0, $rewriteDir.FullName.Length - $script:DISK_SHRINK_REWRITE_SUFFIX.Length)
        $restored = 0
        $kept = 0
        foreach ($file in @(Get-ChildItem -LiteralPath $rewriteDir.FullName -Recurse -Force -File -ErrorAction SilentlyContinue)) {
            $relativePath = $file.FullName.Substring($rewriteDir.FullName.Length).TrimStart('\')
            $targetPath = Join-Path $originalPath $relativePath
            if (Test-Path -LiteralPath $targetPath) {
                $kept++
                continue
            }
            New-Item -ItemType Directory -Path (Split-Path $targetPath -Parent) -Force | Out-Null
            Move-Item -LiteralPath $file.FullName -Destination $targetPath
            $restored++
        }
        Write-ColorMessage -Message ("Interrupted rewrite {0}: restored {1} files to {2}; {3} already exist there and stay in {0}" -f $rewriteDir.FullName, $restored, $originalPath, $kept) -Type "Warning"
    }
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
    if ((Convert-NtfsLegacySecurity -Drive $Drive) -gt 0) {
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
    while ((-not $stalled) -and ($pass -lt $script:DISK_SHRINK_MAX_PASSES) -and (($freeMB - $shrinkableMB) -gt $script:DISK_SHRINK_FREE_TOLERANCE_MB)) {
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
    if (($freeMB - $shrinkableMB) -le $script:DISK_SHRINK_FREE_TOLERANCE_MB) {
        Write-ColorMessage -Message ("All free space of {0} can be shrunk" -f $Drive) -Type "Success"
    }
}
#endregion
