using System.IO;
using DotApps.d3check.Constants;

namespace DotApps.d3check.Services;

/// <summary>Lookback lines before sentinel (memory or file). 1:1 Python _get_lookback_lines / _read_lookback_before_sentinel_from_file.</summary>
public static class RosbotLogLookback
{
    public static List<string> GetLookbackLines(
        IReadOnlyList<string> memoryBeforeCurrent,
        string logFilePath,
        string sentinel,
        int lookback)
    {
        if (memoryBeforeCurrent.Count >= lookback)
        {
            var list = new List<string>(lookback);
            int start = memoryBeforeCurrent.Count - lookback;
            for (int i = start; i < memoryBeforeCurrent.Count; i++)
                list.Add(memoryBeforeCurrent[i]);
            return list;
        }
        return ReadLookbackBeforeSentinelFromFile(logFilePath, sentinel, lookback);
    }

    public static List<string> ReadLookbackBeforeSentinelFromFile(string logPath, string sentinel, int lookback)
    {
        if (string.IsNullOrEmpty(logPath) || !File.Exists(logPath))
            return new List<string>();
        string[] lines;
        try
        {
            lines = File.ReadAllLines(logPath);
        }
        catch
        {
            return new List<string>();
        }
        int lastIdx = -1;
        for (int i = lines.Length - 1; i >= 0; i--)
        {
            if (!string.IsNullOrEmpty(lines[i]) && lines[i].Contains(sentinel, StringComparison.Ordinal))
            {
                lastIdx = i;
                break;
            }
        }
        if (lastIdx <= 0)
            return new List<string>();
        int start = Math.Max(0, lastIdx - lookback);
        var slice = new List<string>();
        for (int i = start; i < lastIdx; i++)
            slice.Add((lines[i] ?? "").Trim());
        if (slice.Count < lookback)
            return new List<string>();
        return slice;
    }
}
