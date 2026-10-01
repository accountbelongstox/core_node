using System.Globalization;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// F3_ProcessGone exit state: F7-sent flag, exit reason (normal_pause / test_debug_exit), test-mode recorded duration and
/// count, total restart count (all persisted in config, lazy-loaded once), and the test "wait 50 % then E2" deadline.
/// 1:1 Python d3utils/rosbot_flow_rosbot_exit_state.py.
/// Fixes Python bug: recording a test duration before the lazy config load reset the persisted record count to 1.
/// </summary>
public static class RosbotExitState
{
    public const string ExitNormalPause = "normal_pause";
    public const string ExitTestDebug = "test_debug_exit";

    private static readonly object Lock = new();
    private static bool _f7SentForRosbot;
    private static string? _exitReason;
    private static double? _recordedDebugDurationSec;
    private static int _debugExitRecordCount;
    private static DateTime? _testWait50PercentUntilUtc;
    private static bool _testRecordLoaded;
    private static int _totalRestartCount;
    private static bool _totalRestartCountLoaded;

    private static void LoadTestRecordFromConfig()
    {
        if (_testRecordLoaded) return;
        _testRecordLoaded = true;
        try
        {
            double v = RosbotFlowHost.GetConfig(RosbotConstants.ConfigKeyTestRecordedDurationSec, 0.0);
            if (v > 0) _recordedDebugDurationSec = v;
            _debugExitRecordCount = Math.Max(0, ReadIntConfig(RosbotConstants.ConfigKeyTestRecordCount));
        }
        catch { /* keep defaults */ }
    }

    private static void LoadTotalRestartCountFromConfig()
    {
        if (_totalRestartCountLoaded) return;
        _totalRestartCountLoaded = true;
        try
        {
            _totalRestartCount = Math.Max(0, ReadIntConfig(RosbotConstants.ConfigKeyTotalRestartCount));
        }
        catch { /* keep default */ }
    }

    /// <summary>int, float or numeric string (Python accepted all three).</summary>
    private static int ReadIntConfig(string key)
    {
        double d = RosbotFlowHost.GetConfig(key, double.NaN);
        if (!double.IsNaN(d)) return (int)d;
        string? s = RosbotFlowHost.GetConfig<string>(key, null);
        return int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out int v) ? v : 0;
    }

    private static void Persist(string key, object value)
    {
        RosbotFlowHost.Current?.SetConfig(key, value);
    }

    /// <summary>Call when F7 is sent to close/pause ROSBOT; the next process-gone is marked normal_pause. 1:1 Python set_f7_sent_for_rosbot.</summary>
    public static void SetF7SentForRosbot()
    {
        lock (Lock) _f7SentForRosbot = true;
    }

    /// <summary>
    /// Process detected gone: F7 sent -> normal_pause, else test_debug_exit (records debugDurationSec when given).
    /// Increments the total restart count for every exit. 1:1 Python mark_rosbot_exit_reason_when_process_gone.
    /// </summary>
    public static string MarkExitReasonWhenProcessGone(double? debugDurationSec = null)
    {
        lock (Lock)
        {
            LoadTotalRestartCountFromConfig();
            if (_f7SentForRosbot)
            {
                _exitReason = ExitNormalPause;
                ColorPrinter.Gray("[ROSBOT_EXIT] normal_pause (F7 sent to system, ROSBOT exited)");
            }
            else
            {
                _exitReason = ExitTestDebug;
                ColorPrinter.Gray("[ROSBOT_EXIT] test_debug_exit (process gone without F7)");
                if (debugDurationSec is > 0)
                {
                    LoadTestRecordFromConfig();
                    _recordedDebugDurationSec = debugDurationSec.Value;
                    _debugExitRecordCount++;
                    Persist(RosbotConstants.ConfigKeyTestRecordedDurationSec, _recordedDebugDurationSec.Value);
                    Persist(RosbotConstants.ConfigKeyTestRecordCount, _debugExitRecordCount);
                    ColorPrinter.Gray($"[ROSBOT_EXIT] Record DEBUG duration: {debugDurationSec.Value:F1}s, record_count={_debugExitRecordCount}");
                }
            }
            _totalRestartCount++;
            Persist(RosbotConstants.ConfigKeyTotalRestartCount, _totalRestartCount);
            ColorPrinter.Gray($"[ROSBOT_EXIT] Total restart count: {_totalRestartCount}");
            _f7SentForRosbot = false;
            return _exitReason;
        }
    }

    public static string? GetExitReason()
    {
        lock (Lock) return _exitReason;
    }

    public static void ClearExitReason()
    {
        lock (Lock) _exitReason = null;
    }

    public static double? GetRecordedDebugDurationSec()
    {
        lock (Lock)
        {
            LoadTestRecordFromConfig();
            return _recordedDebugDurationSec;
        }
    }

    public static int GetDebugExitRecordCount()
    {
        lock (Lock)
        {
            LoadTestRecordFromConfig();
            return _debugExitRecordCount;
        }
    }

    /// <summary>Test mode: wait until this time, then run E2 and continue. 1:1 Python set_test_wait_50_percent_until.</summary>
    public static void SetTestWait50PercentUntil(DateTime untilUtc)
    {
        lock (Lock) _testWait50PercentUntilUtc = untilUtc;
    }

    /// <summary>Null = not in the wait state. 1:1 Python get_test_wait_50_percent_until (0 = none).</summary>
    public static DateTime? GetTestWait50PercentUntil()
    {
        lock (Lock) return _testWait50PercentUntilUtc;
    }

    public static void ClearTestWait50Percent()
    {
        lock (Lock) _testWait50PercentUntilUtc = null;
    }

    /// <summary>Restart triggered without a process-gone mark (e.g. log disconnect). 1:1 Python increment_total_restart_count.</summary>
    public static void IncrementTotalRestartCount()
    {
        lock (Lock)
        {
            LoadTotalRestartCountFromConfig();
            _totalRestartCount++;
            Persist(RosbotConstants.ConfigKeyTotalRestartCount, _totalRestartCount);
            ColorPrinter.Gray($"[ROSBOT_RESTART] Total restart count: {_totalRestartCount}");
        }
    }

    public static int GetTotalRestartCount()
    {
        lock (Lock)
        {
            LoadTotalRestartCountFromConfig();
            return _totalRestartCount;
        }
    }
}
