// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Globalization;
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>Process priority class and CPU affinity by PID; CPU lists use "0,2,4-7" notation.</summary>
public static class ProcessTuning
{
    private const string LogTag = "[ProcessTuning]";
    public const string PriorityRealtime = "realtime";
    public const string PriorityHigh = "high";
    public const string PriorityAboveNormal = "above_normal";
    public const string PriorityNormal = "normal";
    public const string PriorityBelowNormal = "below_normal";
    public const string PriorityLow = "low";

    public static IReadOnlyList<string> PriorityNames { get; } = new[]
    {
        PriorityRealtime, PriorityHigh, PriorityAboveNormal, PriorityNormal, PriorityBelowNormal, PriorityLow
    };

    public static bool TryParsePriority(string? name, out ProcessPriorityClass priority)
    {
        priority = ProcessPriorityClass.Normal;
        switch (name)
        {
            case PriorityRealtime: priority = ProcessPriorityClass.RealTime; return true;
            case PriorityHigh: priority = ProcessPriorityClass.High; return true;
            case PriorityAboveNormal: priority = ProcessPriorityClass.AboveNormal; return true;
            case PriorityNormal: priority = ProcessPriorityClass.Normal; return true;
            case PriorityBelowNormal: priority = ProcessPriorityClass.BelowNormal; return true;
            case PriorityLow: priority = ProcessPriorityClass.Idle; return true;
            default: return false;
        }
    }

    /// <summary>Parse "0,2,4-7" into an affinity mask limited to the machine's logical CPUs; 0 when empty or invalid.</summary>
    public static long ParseCpuList(string? text)
    {
        long mask = 0;
        int cpuCount = Math.Min(Environment.ProcessorCount, 64);
        foreach (var raw in (text ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var parts = raw.Split('-', StringSplitOptions.TrimEntries);
            if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out int from)) continue;
            int to = from;
            if (parts.Length > 1 && !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out to)) continue;
            for (int cpu = Math.Max(0, from); cpu <= Math.Min(to, cpuCount - 1); cpu++)
                mask |= 1L << cpu;
        }
        return mask;
    }

    /// <summary>Apply priority (skipped when name is empty or unknown) and affinity (skipped when mask is 0) to pid. True when every requested change succeeded.</summary>
    public static bool Apply(int pid, string? priorityName, long affinityMask)
    {
        if (!OperatingSystem.IsWindows() && !OperatingSystem.IsLinux()) return false;
        try
        {
            using var process = Process.GetProcessById(pid);
            bool ok = true;
            if (TryParsePriority(priorityName, out var priority))
            {
                try
                {
                    process.PriorityClass = priority;
                    ColorPrinter.Gray($"{LogTag} pid={pid} priority={priorityName}");
                }
                catch (Exception ex)
                {
                    ok = false;
                    ColorPrinter.Yellow($"{LogTag} pid={pid} priority failed: {ex.Message}");
                }
            }
            if (affinityMask != 0)
            {
                try
                {
                    process.ProcessorAffinity = (IntPtr)affinityMask;
                    ColorPrinter.Gray($"{LogTag} pid={pid} affinity=0x{affinityMask:X}");
                }
                catch (Exception ex)
                {
                    ok = false;
                    ColorPrinter.Yellow($"{LogTag} pid={pid} affinity failed: {ex.Message}");
                }
            }
            return ok;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogTag} pid={pid} not available: {ex.Message}");
            return false;
        }
    }
}
