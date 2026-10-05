// PY-REF: none (DOT-only)
using System.Globalization;
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Infrastructure.Http;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Reports the network hold (Battle.net client, D4 download, D3 tab) to the pycore Task Log: one row per phase change,
/// per ProgressStepPercent of download progress, per retry streak start and per new pass error. One task id per hold run.
/// </summary>
public static class NetHoldTaskLog
{
    public const string TaskType = "battlenet_download";
    public const string Worker = "d3d4tester";
    private const string TaskIdPrefix = "nethold-d4-";
    private const string TaskIdTimeFormat = "yyyyMMdd-HHmmss";
    private const double ProgressStepPercent = 5;

    private static readonly object Lock = new();
    private static string _taskId = NewTaskId();
    private static NetHoldPhase? _lastPhase;
    private static int _lastProgressStep = -1;
    private static string? _lastError;

    /// <summary>Start a new task id (hold switched on).</summary>
    public static void BeginRun()
    {
        lock (Lock)
        {
            _taskId = NewTaskId();
            _lastPhase = null;
            _lastProgressStep = -1;
            _lastError = null;
        }
    }

    public static void Report(NetHoldRecord record, int retry)
    {
        string? reason = null;
        lock (Lock)
        {
            if (record.Phase != _lastPhase) reason = "phase";
            else if (record.Percent is { } p && (int)(p / ProgressStepPercent) != _lastProgressStep) reason = "progress";
            else if (retry == 1) reason = "retry";
            _lastPhase = record.Phase;
            if (record.Percent is { } percent) _lastProgressStep = (int)(percent / ProgressStepPercent);
            _lastError = null;
        }
        if (reason != null) Send(record, retry, reason, error: null);
    }

    public static void ReportError(NetHoldRecord last, int retry, string error)
    {
        lock (Lock)
        {
            if (error == _lastError) return;
            _lastError = error;
        }
        Send(last, retry, "error", error);
    }

    public static string Describe(NetHoldRecord record, int retry)
    {
        var parts = new List<string> { $"D4 {record.Phase}" };
        if (record.Percent is { } percent) parts.Add(percent.ToString("0.0", CultureInfo.InvariantCulture) + "%");
        if (record.DoneBytes is { } done && record.TotalBytes is { } total)
            parts.Add($"{BattlenetDownloadProgress.FormatBytes(done)} / {BattlenetDownloadProgress.FormatBytes(total)}");
        if (record.RateBytesPerSec is { } rate) parts.Add($"{BattlenetDownloadProgress.FormatBytes(rate)}/s");
        if (record.EtaSec is { } eta) parts.Add($"eta {TimeSpan.FromSeconds(eta):d\\.hh\\:mm}");
        if (retry > 0) parts.Add($"retry #{retry}");
        if (!string.IsNullOrWhiteSpace(record.Detail)) parts.Add($"({record.Detail})");
        return string.Join(" ", parts);
    }

    private static void Send(NetHoldRecord record, int retry, string reason, string? error)
    {
        var processIds = BattlenetManager.Instance.GetProcessIds();
        PycoreTaskLogClient.Append(new PycoreTaskLogRecord(
            Title: Describe(record, retry),
            TaskType: TaskType,
            Worker: Worker,
            Success: error == null && record.Phase is not (NetHoldPhase.InstallPathFailed or NetHoldPhase.D4TabMissing or NetHoldPhase.Unknown),
            TaskId: _taskId,
            Content: reason,
            Error: error,
            Detail: new Dictionary<string, object?>
            {
                ["kind"] = TaskType,
                ["game"] = "D4",
                ["reason"] = reason,
                ["phase"] = record.Phase.ToString(),
                ["percent"] = record.Percent,
                ["done_bytes"] = record.DoneBytes,
                ["total_bytes"] = record.TotalBytes,
                ["rate_bytes_per_sec"] = record.RateBytesPerSec,
                ["avg_rate_bytes_per_sec"] = record.AvgRateBytesPerSec,
                ["eta_sec"] = record.EtaSec,
                ["retry"] = retry,
                ["battlenet_pids"] = processIds.ToArray(),
                ["detail"] = record.Detail,
            }));
    }

    private static string NewTaskId() => TaskIdPrefix + DateTime.Now.ToString(TaskIdTimeFormat, CultureInfo.InvariantCulture);
}
