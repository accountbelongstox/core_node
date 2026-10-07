// PY-REF: none (DOT-only)
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using DotCore.Foundations;

namespace DotCore.YoloTrain;

/// <summary>
/// Windows: one process-wide job object with KILL_ON_JOB_CLOSE; children assigned to it (and their descendants) die when this
/// process exits for any reason, including a crash. Elsewhere a no-op: the Linux child watches its parent (YoloLauncher bootstrap)
/// and Cancel kills the process tree.
/// </summary>
public static class ChildProcessJob
{
    private const string LogTag = "[ChildProcessJob]";
    private const int JobObjectExtendedLimitInformation = 9;
    private const uint JobObjectLimitKillOnJobClose = 0x2000;

    private static readonly object Lock = new();
    private static IntPtr _job;
    private static bool _failed;

    /// <summary>Adds the started process to the kill-on-close job; false when unsupported or it failed (logged once).</summary>
    public static bool Assign(Process process)
    {
        if (!OperatingSystem.IsWindows()) return false;
        lock (Lock)
        {
            if (_failed) return false;
            try
            {
                if (_job == IntPtr.Zero) _job = CreateKillOnCloseJob();
                if (!AssignProcessToJobObject(_job, process.Handle)) throw new Win32Exception(Marshal.GetLastWin32Error());
                return true;
            }
            catch (Exception ex) when (ex is Win32Exception or InvalidOperationException)
            {
                _failed = true;
                ColorPrinter.Yellow($"{LogTag} job object unavailable: {ex.Message}");
                return false;
            }
        }
    }

    private static IntPtr CreateKillOnCloseJob()
    {
        var job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        var info = new JobObjectExtendedLimitInfo { BasicLimitInformation = new JobObjectBasicLimitInfo { LimitFlags = JobObjectLimitKillOnJobClose } };
        int size = Marshal.SizeOf<JobObjectExtendedLimitInfo>();
        var buffer = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(info, buffer, false);
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, buffer, (uint)size))
            {
                int error = Marshal.GetLastWin32Error();
                CloseHandle(job);
                throw new Win32Exception(error);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
        return job;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JobObjectBasicLimitInfo
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JobObjectExtendedLimitInfo
    {
        public JobObjectBasicLimitInfo BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr securityAttributes, string? name);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);
}
