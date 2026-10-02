// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace DotCore.Utils;

/// <summary>CPU %, memory bytes, dedicated GPU memory bytes and GPU % of a process group (null GPU values when unavailable).</summary>
public sealed record ResourceUsage(double CpuPercent, long MemoryBytes, long? GpuMemoryBytes, double? GpuPercent, int ProcessCount);

/// <summary>System-wide usage: CPU %, physical memory, dedicated GPU memory and GPU % (busiest engine, like Task Manager).</summary>
public sealed record SystemUsage(double CpuPercent, long MemoryUsedBytes, long MemoryTotalBytes, long? GpuMemoryUsedBytes, long? GpuMemoryTotalBytes, double? GpuPercent);

/// <summary>One sample: system usage plus usage per named process group.</summary>
public sealed record ResourceSnapshot(SystemUsage System, IReadOnlyDictionary<string, ResourceUsage> Groups);

/// <summary>
/// Windows resource sampler for dashboards. CPU from GetSystemTimes / Process.TotalProcessorTime deltas between calls, memory
/// from GlobalMemoryStatusEx / working sets, GPU from PDH counters (GPU Process Memory, GPU Adapter Memory, GPU Engine) and the
/// adapter VRAM size from the display class registry key. Call <see cref="Sample"/> periodically (e.g. 1 s) from one thread.
/// </summary>
public sealed class SystemResourceSampler : IDisposable
{
    private const string GpuProcessMemoryCounter = @"\GPU Process Memory(*)\Dedicated Usage";
    private const string GpuAdapterMemoryCounter = @"\GPU Adapter Memory(*)\Dedicated Usage";
    private const string GpuEngineCounter = @"\GPU Engine(*)\Utilization Percentage";
    private const string DisplayClassKey = @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
    private const string AdapterMemoryValue = "HardwareInformation.qwMemorySize";
    private const uint PdhFmtDouble = 0x00000200;
    private const uint PdhFmtNoCap100 = 0x00008000;
    private const int PdhMoreData = unchecked((int)0x800007D2);
    private static readonly Regex PidPrefix = new(@"^pid_(\d+)_", RegexOptions.Compiled);
    private static readonly Regex EngineSuffix = new(@"_(luid_.+_eng_\d+)_engtype_", RegexOptions.Compiled);

    private readonly object _lock = new();
    private readonly Dictionary<int, TimeSpan> _lastProcessCpu = new();
    private IntPtr _query;
    private IntPtr _gpuProcessMemory;
    private IntPtr _gpuAdapterMemory;
    private IntPtr _gpuEngine;
    private bool _pdhReady;
    private long _lastIdle;
    private long _lastTotal;
    private DateTime _lastSampleUtc;
    private readonly long? _gpuTotalBytes;

    public SystemResourceSampler()
    {
        if (!OperatingSystem.IsWindows()) return;
        _gpuTotalBytes = ReadAdapterMemorySize();
        _pdhReady = PdhOpenQueryW(null, IntPtr.Zero, out _query) == 0
                    && PdhAddEnglishCounterW(_query, GpuProcessMemoryCounter, IntPtr.Zero, out _gpuProcessMemory) == 0
                    && PdhAddEnglishCounterW(_query, GpuAdapterMemoryCounter, IntPtr.Zero, out _gpuAdapterMemory) == 0
                    && PdhAddEnglishCounterW(_query, GpuEngineCounter, IntPtr.Zero, out _gpuEngine) == 0;
        if (_pdhReady) PdhCollectQueryData(_query);
        ReadSystemCpu(out _lastIdle, out _lastTotal);
        _lastSampleUtc = DateTime.UtcNow;
    }

    /// <summary>Sample the system and every group (group name -> process ids). Rates cover the time since the previous call.</summary>
    public ResourceSnapshot Sample(IReadOnlyDictionary<string, IReadOnlyCollection<int>> groups)
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            double elapsedSec = Math.Max(0.001, (now - _lastSampleUtc).TotalSeconds);
            _lastSampleUtc = now;
            double cpu = SampleSystemCpu();
            var (memUsed, memTotal) = ReadMemory();
            Dictionary<int, double>? gpuMemByPid = null;
            Dictionary<int, double>? gpuPctByPid = null;
            long? gpuUsed = null;
            double? gpuPct = null;
            if (_pdhReady && PdhCollectQueryData(_query) == 0)
            {
                gpuMemByPid = SumByPid(ReadArray(_gpuProcessMemory));
                gpuUsed = (long)ReadArray(_gpuAdapterMemory).Sum(kv => kv.Value);
                var engines = ReadArray(_gpuEngine);
                gpuPctByPid = MaxEngineByPid(engines);
                gpuPct = Math.Min(100.0, BusiestEngine(engines));
            }
            var system = new SystemUsage(cpu, memUsed, memTotal, gpuUsed, _gpuTotalBytes, gpuPct);
            var result = new Dictionary<string, ResourceUsage>(StringComparer.Ordinal);
            var seen = new HashSet<int>();
            foreach (var (name, pids) in groups)
                result[name] = SampleGroup(pids, elapsedSec, gpuMemByPid, gpuPctByPid, seen);
            foreach (var stale in _lastProcessCpu.Keys.Where(pid => !seen.Contains(pid)).ToList())
                _lastProcessCpu.Remove(stale);
            return new ResourceSnapshot(system, result);
        }
    }

    private ResourceUsage SampleGroup(IReadOnlyCollection<int> pids, double elapsedSec, Dictionary<int, double>? gpuMem, Dictionary<int, double>? gpuPct, HashSet<int> seen)
    {
        double cpu = 0;
        long mem = 0;
        double gMem = 0;
        double gPct = 0;
        int count = 0;
        foreach (int pid in pids.Distinct())
        {
            try
            {
                using var p = Process.GetProcessById(pid);
                var total = p.TotalProcessorTime;
                if (_lastProcessCpu.TryGetValue(pid, out var last))
                    cpu += (total - last).TotalSeconds / elapsedSec / Environment.ProcessorCount * 100.0;
                _lastProcessCpu[pid] = total;
                mem += p.WorkingSet64;
                seen.Add(pid);
                count++;
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception)
            {
                continue;
            }
            if (gpuMem != null && gpuMem.TryGetValue(pid, out var m)) gMem += m;
            if (gpuPct != null && gpuPct.TryGetValue(pid, out var g)) gPct = Math.Max(gPct, g);
        }
        return new ResourceUsage(Math.Clamp(cpu, 0, 100), mem, gpuMem == null ? null : (long)gMem, gpuPct == null ? null : Math.Min(100.0, gPct), count);
    }

    private double SampleSystemCpu()
    {
        if (!ReadSystemCpu(out long idle, out long total)) return 0;
        long dIdle = idle - _lastIdle, dTotal = total - _lastTotal;
        _lastIdle = idle;
        _lastTotal = total;
        return dTotal <= 0 ? 0 : Math.Clamp((1.0 - (double)dIdle / dTotal) * 100.0, 0, 100);
    }

    private static bool ReadSystemCpu(out long idle, out long total)
    {
        idle = total = 0;
        if (!OperatingSystem.IsWindows() || !GetSystemTimes(out long i, out long k, out long u)) return false;
        idle = i;
        total = k + u;
        return true;
    }

    private static (long Used, long Total) ReadMemory()
    {
        if (!OperatingSystem.IsWindows()) return (0, 0);
        var status = new MemoryStatusEx { Length = (uint)Marshal.SizeOf<MemoryStatusEx>() };
        if (!GlobalMemoryStatusEx(ref status)) return (0, 0);
        return ((long)(status.TotalPhys - status.AvailPhys), (long)status.TotalPhys);
    }

    private static long? ReadAdapterMemorySize()
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            using var cls = Registry.LocalMachine.OpenSubKey(DisplayClassKey);
            if (cls == null) return null;
            long best = 0;
            foreach (var sub in cls.GetSubKeyNames())
            {
                try
                {
                    using var key = cls.OpenSubKey(sub);
                    if (key?.GetValue(AdapterMemoryValue) is long size && size > best) best = size;
                }
                catch (Exception ex) when (ex is System.Security.SecurityException or UnauthorizedAccessException)
                {
                    continue;
                }
            }
            return best > 0 ? best : null;
        }
        catch (Exception ex) when (ex is System.Security.SecurityException or UnauthorizedAccessException or IOException)
        {
            return null;
        }
    }

    private static Dictionary<int, double> SumByPid(List<KeyValuePair<string, double>> items)
    {
        var byPid = new Dictionary<int, double>();
        foreach (var (name, value) in items)
        {
            var m = PidPrefix.Match(name);
            if (!m.Success || !int.TryParse(m.Groups[1].Value, out int pid)) continue;
            byPid[pid] = byPid.GetValueOrDefault(pid) + value;
        }
        return byPid;
    }

    /// <summary>Per pid: busiest engine (sum of the pid's instances on that engine).</summary>
    private static Dictionary<int, double> MaxEngineByPid(List<KeyValuePair<string, double>> items)
    {
        var perPidEngine = new Dictionary<(int Pid, string Engine), double>();
        foreach (var (name, value) in items)
        {
            var pidMatch = PidPrefix.Match(name);
            var engMatch = EngineSuffix.Match(name);
            if (!pidMatch.Success || !engMatch.Success || !int.TryParse(pidMatch.Groups[1].Value, out int pid)) continue;
            var key = (pid, engMatch.Groups[1].Value);
            perPidEngine[key] = perPidEngine.GetValueOrDefault(key) + value;
        }
        var byPid = new Dictionary<int, double>();
        foreach (var ((pid, _), value) in perPidEngine)
            byPid[pid] = Math.Max(byPid.GetValueOrDefault(pid), value);
        return byPid;
    }

    /// <summary>System GPU %: busiest engine summed over all processes (Task Manager rule).</summary>
    private static double BusiestEngine(List<KeyValuePair<string, double>> items)
    {
        var perEngine = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var (name, value) in items)
        {
            var m = EngineSuffix.Match(name);
            if (!m.Success) continue;
            perEngine[m.Groups[1].Value] = perEngine.GetValueOrDefault(m.Groups[1].Value) + value;
        }
        return perEngine.Count == 0 ? 0 : perEngine.Values.Max();
    }

    private static List<KeyValuePair<string, double>> ReadArray(IntPtr counter)
    {
        var items = new List<KeyValuePair<string, double>>();
        uint size = 0, count = 0;
        int status = PdhGetFormattedCounterArrayW(counter, PdhFmtDouble | PdhFmtNoCap100, ref size, ref count, IntPtr.Zero);
        if (status != PdhMoreData || size == 0) return items;
        IntPtr buffer = Marshal.AllocHGlobal((int)size);
        try
        {
            if (PdhGetFormattedCounterArrayW(counter, PdhFmtDouble | PdhFmtNoCap100, ref size, ref count, buffer) != 0) return items;
            int itemSize = Marshal.SizeOf<PdhFmtCounterValueItem>();
            for (int i = 0; i < count; i++)
            {
                var item = Marshal.PtrToStructure<PdhFmtCounterValueItem>(buffer + i * itemSize);
                if (item.CStatus != 0) continue;
                items.Add(new KeyValuePair<string, double>(Marshal.PtrToStringUni(item.Name) ?? "", item.Value));
            }
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
        return items;
    }

    public void Dispose()
    {
        if (_query != IntPtr.Zero) PdhCloseQuery(_query);
        _query = IntPtr.Zero;
        _pdhReady = false;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatusEx
    {
        public uint Length;
        public uint MemoryLoad;
        public ulong TotalPhys;
        public ulong AvailPhys;
        public ulong TotalPageFile;
        public ulong AvailPageFile;
        public ulong TotalVirtual;
        public ulong AvailVirtual;
        public ulong AvailExtendedVirtual;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PdhFmtCounterValueItem
    {
        public IntPtr Name;
        public uint CStatus;
        public double Value;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(out long idleTime, out long kernelTime, out long userTime);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx buffer);

    [DllImport("pdh.dll", CharSet = CharSet.Unicode)]
    private static extern int PdhOpenQueryW(string? dataSource, IntPtr userData, out IntPtr query);

    [DllImport("pdh.dll", CharSet = CharSet.Unicode)]
    private static extern int PdhAddEnglishCounterW(IntPtr query, string counterPath, IntPtr userData, out IntPtr counter);

    [DllImport("pdh.dll")]
    private static extern int PdhCollectQueryData(IntPtr query);

    [DllImport("pdh.dll", CharSet = CharSet.Unicode)]
    private static extern int PdhGetFormattedCounterArrayW(IntPtr counter, uint format, ref uint bufferSize, ref uint itemCount, IntPtr itemBuffer);

    [DllImport("pdh.dll")]
    private static extern int PdhCloseQuery(IntPtr query);
}
