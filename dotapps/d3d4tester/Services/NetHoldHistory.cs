// PY-REF: none (DOT-only)
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>One network-hold check as recorded and shown: phase, download amounts, rates and the remaining-time estimate.</summary>
public sealed record NetHoldRecord(
    [property: JsonPropertyName("time")] DateTime Time,
    [property: JsonPropertyName("phase")] NetHoldPhase Phase,
    [property: JsonPropertyName("done_bytes")] double? DoneBytes,
    [property: JsonPropertyName("total_bytes")] double? TotalBytes,
    [property: JsonPropertyName("rate_bytes_per_sec")] double? RateBytesPerSec,
    [property: JsonPropertyName("avg_rate_bytes_per_sec")] double? AvgRateBytesPerSec,
    [property: JsonPropertyName("eta_sec")] double? EtaSec,
    [property: JsonPropertyName("detail")] string? Detail)
{
    [JsonIgnore]
    public double? Percent => DoneBytes is { } d && TotalBytes is { } t && t > 0 ? Math.Clamp(d * 100.0 / t, 0, 100) : null;
}

/// <summary>
/// Network-hold history: every check appended to net_hold_history.jsonl in the user data dir, the newest kept in memory for
/// the UI. The remaining time uses the average speed over the last AverageWindow of increasing samples (Battle.net's own
/// rate when there are not enough samples yet).
/// </summary>
public static class NetHoldHistory
{
    public const string FileName = "net_hold_history.jsonl";
    public const int MemoryCount = 200;
    private const int MaxFileLines = 5000;
    private const int KeepLinesOnTrim = 2000;
    private static readonly TimeSpan AverageWindow = TimeSpan.FromMinutes(10);
    private static readonly JsonSerializerOptions JsonOptions = new() { Converters = { new JsonStringEnumConverter() } };

    private static readonly object Lock = new();
    private static readonly List<NetHoldRecord> Records = new();
    private static bool _loaded;

    public static string FilePath => Path.Combine(ConfigPaths.CurrentUserDataPath, FileName);

    /// <summary>Newest first.</summary>
    public static IReadOnlyList<NetHoldRecord> Recent()
    {
        lock (Lock)
        {
            EnsureLoaded();
            return Records.AsEnumerable().Reverse().ToList();
        }
    }

    public static NetHoldRecord Add(NetHoldResult result, DateTime now)
    {
        var progress = result.Progress;
        NetHoldRecord record;
        lock (Lock)
        {
            EnsureLoaded();
            double? avg = progress == null ? null : AverageRate(progress.DoneBytes, progress.TotalBytes, now);
            double? rate = avg is > 0 ? avg : progress?.RateBytesPerSec;
            double? eta = progress != null && rate is > 0 ? progress.RemainingBytes / rate.Value : null;
            record = new NetHoldRecord(now, result.Phase, progress?.DoneBytes, progress?.TotalBytes, progress?.RateBytesPerSec, avg, eta, result.Detail);
            Records.Add(record);
            if (Records.Count > MemoryCount) Records.RemoveRange(0, Records.Count - MemoryCount);
        }
        Append(record);
        return record;
    }

    /// <summary>Bytes per second between the oldest and newest sample of the same download inside the window, or null.</summary>
    private static double? AverageRate(double doneBytes, double totalBytes, DateTime now)
    {
        var first = Records.Where(r => r.DoneBytes != null && r.TotalBytes == totalBytes && now - r.Time <= AverageWindow && r.DoneBytes <= doneBytes)
            .OrderBy(r => r.Time).FirstOrDefault();
        if (first == null) return null;
        double seconds = (now - first.Time).TotalSeconds;
        double bytes = doneBytes - first.DoneBytes!.Value;
        return seconds > 0 && bytes > 0 ? bytes / seconds : null;
    }

    private static void EnsureLoaded()
    {
        if (_loaded) return;
        _loaded = true;
        try
        {
            if (!File.Exists(FilePath)) return;
            var lines = File.ReadAllLines(FilePath);
            if (lines.Length > MaxFileLines)
            {
                lines = lines[^KeepLinesOnTrim..];
                File.WriteAllLines(FilePath, lines);
            }
            foreach (var line in lines.TakeLast(MemoryCount))
            {
                try
                {
                    if (JsonSerializer.Deserialize<NetHoldRecord>(line, JsonOptions) is { } r) Records.Add(r);
                }
                catch (JsonException) { }
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"[NetHold] history load failed: {ex.Message}");
        }
    }

    private static void Append(NetHoldRecord record)
    {
        try
        {
            Directory.CreateDirectory(ConfigPaths.CurrentUserDataPath);
            lock (Lock) File.AppendAllText(FilePath, JsonSerializer.Serialize(record, JsonOptions) + Environment.NewLine);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"[NetHold] history write failed: {ex.Message}");
        }
    }
}
