// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f3_log_timeout.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f3_baseline.py
using System.Globalization;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>F3 step result. 1:1 Python Literal["f3_stay", "f4"].</summary>
public enum F3Step
{
    Stay,
    F4
}

/// <summary>Test-mode status values for the UI line (formatted with i18n by the app). 1:1 Python get_test_mode_display_string parts.</summary>
public sealed record F3TestModeDisplay(double ElapsedSec, int TimeoutMinutes, int RecordCount, double? RecordedSec, double? WaitRemainSec);

/// <summary>
/// [F3] ROSBOT log timeout (flow timeout, not log tailing). Baseline: log mtime when the log is from the current run, else the
/// in-memory started_at (set at E4 / after teleport), else F4. Test mode: count=1 and 50 % -> F4; count>=2 and elapsed>=recorded
/// -> F7 then wait 50 % -> E2 1 s. Timeout with the process gone marks the exit (with duration in test mode).
/// 1:1 Python d3utils/rosbot_flow_f3_log_timeout.py + rosbot_flow_f3_baseline.py.
/// </summary>
public static class F3LogTimeout
{
    private const double TestHalfRatio = 0.5;
    private const int E2SleepMs = 1000;
    private const string TimestampFormat = "yyyy-MM-dd HH:mm:ss";
    private const string NoTimestamp = "-";

    private static readonly object Lock = new();
    private static DateTime? _rosbotStartedAtUtc;
    private static string _lastShortStatus = "";

    /// <summary>One-line status for the same-line refresh (e.g. "F3: 30min elapsed=164s ok"). 1:1 Python get_last_f3_short_status.</summary>
    public static string LastShortStatus
    {
        get { lock (Lock) return _lastShortStatus; }
    }

    /// <summary>F3 baseline start time (null = not set). 1:1 Python get_f3_rosbot_started_at.</summary>
    public static DateTime? RosbotStartedAtUtc
    {
        get { lock (Lock) return _rosbotStartedAtUtc; }
    }

    /// <summary>Call when ROSBOT was just started (E4) or after teleport success. 1:1 Python set_f3_rosbot_started_at.</summary>
    public static void SetRosbotStartedAt()
    {
        DateTime now = DateTime.UtcNow;
        lock (Lock) _rosbotStartedAtUtc = now;
        ColorPrinter.Gray($"[F3] set_f3_rosbot_started_at: started_at={FormatTs(now)}");
    }

    /// <summary>(enabled, timeout seconds): battlenet.timeout_restart; rosbot.test_timeout_minutes in test mode else rosbot.timeout_minutes. 1:1 Python get_rosbot_log_timeout_config.</summary>
    public static (bool Enabled, int TimeoutSec) GetTimeoutConfig()
    {
        bool enabled = RosbotFlowHost.GetConfig(RosbotConstants.ConfigKeyTimeoutRestart, true);
        int minutes = IsTestMode()
            ? RosbotFlowHost.GetConfig(RosbotConstants.ConfigKeyTestTimeoutMinutes, RosbotConstants.RosbotTestTimeoutMinutesDefault)
            : RosbotFlowHost.GetConfig(RosbotConstants.ConfigKeyTimeoutMinutes, RosbotConstants.RosbotLogTimeoutMinutesDefault);
        return (enabled, Math.Max(1, minutes) * 60);
    }

    public static bool IsTestMode() => RosbotFlowHost.GetConfig(RosbotConstants.ConfigKeyTestMode, false);

    private static DateTime? LastLogUtc() => RosbotFlowHost.Current?.GetLastLogModifiedUtc();

    private static string FormatTs(DateTime? utc) =>
        utc == null ? NoTimestamp : utc.Value.ToLocalTime().ToString(TimestampFormat, CultureInfo.InvariantCulture);

    /// <summary>Test-mode values for the UI, or null when test mode is off. 1:1 Python get_test_mode_display_string.</summary>
    public static F3TestModeDisplay? GetTestModeDisplay()
    {
        if (!IsTestMode()) return null;
        DateTime now = DateTime.UtcNow;
        DateTime? lastLog = LastLogUtc();
        DateTime? startedAt = RosbotStartedAtUtc;
        bool logIsCurrentRun = lastLog != null && startedAt != null && lastLog >= startedAt;
        DateTime baseline = logIsCurrentRun ? lastLog!.Value : startedAt ?? now;
        double elapsed = (now - baseline).TotalSeconds;
        var (_, timeoutSec) = GetTimeoutConfig();
        double? recorded = RosbotExitState.GetRecordedDebugDurationSec();
        int recordCount = RosbotExitState.GetDebugExitRecordCount();
        DateTime? waitUntil = RosbotExitState.GetTestWait50PercentUntil();
        double? recordedShown = recorded is > 0 && recordCount >= 1 ? recorded : null;
        double? remain = waitUntil != null ? Math.Max(0, (waitUntil.Value - now).TotalSeconds) : null;
        return new F3TestModeDisplay(elapsed, timeoutSec / 60, recordCount, recordedShown, remain);
    }

    /// <summary>
    /// [F3] ROSBOT log timeout? Returns Stay or F4. verbose=false only updates <see cref="LastShortStatus"/>.
    /// 1:1 Python run_f3_log_timeout.
    /// </summary>
    public static F3Step Run(bool verbose = true)
    {
        SetShort("");
        var (enabled, timeoutSec) = GetTimeoutConfig();
        int timeoutMinutes = timeoutSec / 60;
        DateTime now = DateTime.UtcNow;
        DateTime? lastLog = LastLogUtc();
        DateTime? startedAt = RosbotStartedAtUtc;
        bool testMode = IsTestMode();

        DateTime? waitUntil = RosbotExitState.GetTestWait50PercentUntil();
        if (testMode && waitUntil != null && now >= waitUntil.Value)
        {
            RosbotExitState.ClearTestWait50Percent();
            ColorPrinter.Gray("[F3] Test mode: 50% simulated duration reached, run [E2] wait 1s, continue test");
            Thread.Sleep(E2SleepMs);
            SetRosbotStartedAt();
            return F3Step.Stay;
        }

        if (!enabled)
        {
            SetShort("F3: disabled");
            if (verbose)
                ColorPrinter.Gray($"[F3] log-timeout disabled by UI: battlenet.timeout_restart={enabled} -> f3_stay");
            return F3Step.Stay;
        }

        bool logIsCurrentRun = lastLog != null && startedAt != null && lastLog >= startedAt;
        DateTime baseline;
        string baselineSrc;
        if (logIsCurrentRun)
        {
            baseline = lastLog!.Value;
            baselineSrc = "log_mtime";
        }
        else if (startedAt != null)
        {
            baseline = startedAt.Value;
            baselineSrc = "started_at(no_log_yet)";
        }
        else if (lastLog != null)
        {
            SetShort("F3: stale log -> f4");
            if (verbose)
                ColorPrinter.Gray($"[F3] timeout check: last_log_ts from previous run ({FormatTs(lastLog)}), no started_at -> f4");
            return F3Step.F4;
        }
        else
        {
            SetShort("F3: no log mtime -> f4");
            if (verbose)
                ColorPrinter.Gray($"[F3] timeout check: enabled={enabled} timeout={timeoutMinutes}min({timeoutSec}s) now={FormatTs(now)} started_at={FormatTs(startedAt)} last_log_ts={FormatTs(lastLog)} -> no log mtime, f4");
            return F3Step.F4;
        }

        double elapsed = (now - baseline).TotalSeconds;
        bool timedOut = elapsed >= timeoutSec;
        SetShort($"F3: {timeoutMinutes}min elapsed={elapsed:F0}s {(timedOut ? "timeout" : "ok")}");
        if (verbose)
            ColorPrinter.Gray($"[F3] timeout check: enabled={enabled} timeout={timeoutMinutes}min({timeoutSec}s) now={FormatTs(now)} started_at={FormatTs(startedAt)} last_log_ts={FormatTs(lastLog)} baseline={FormatTs(baseline)} baseline_src={baselineSrc} elapsed={elapsed:F1}s timed_out={timedOut}");

        if (testMode && !timedOut)
        {
            double? recorded = RosbotExitState.GetRecordedDebugDurationSec();
            int recordCount = RosbotExitState.GetDebugExitRecordCount();
            if (recordCount == 1 && recorded is > 0 && elapsed >= TestHalfRatio * recorded.Value)
            {
                ColorPrinter.Gray($"[F3] Test mode: first record, 50%({TestHalfRatio * recorded.Value:F1}s) reached -> [F4a] close D3");
                return F3Step.F4;
            }
            if (recordCount >= 2 && recorded is > 0 && RosbotExitState.GetTestWait50PercentUntil() == null && elapsed >= recorded.Value)
            {
                if (RosbotManager.SendF7ToSystem())
                {
                    RosbotExitState.SetF7SentForRosbot();
                    RosbotExitState.SetTestWait50PercentUntil(now.AddSeconds(TestHalfRatio * recorded.Value));
                    ColorPrinter.Gray($"[F3] Test mode: has recorded DEBUG duration {recorded.Value:F1}s, F7 sent; will simulate 50% then [E2] continue test");
                }
                return F3Step.Stay;
            }
        }

        if (timedOut)
        {
            if (!RosbotManager.Instance.IsRunning())
            {
                RosbotExitState.MarkExitReasonWhenProcessGone(testMode ? elapsed : null);
                if (testMode)
                {
                    string reasonDesc = RosbotExitState.GetExitReason() == RosbotExitState.ExitNormalPause
                        ? RosbotExitState.ExitNormalPause
                        : RosbotExitState.ExitTestDebug;
                    ColorPrinter.Gray($"[F3] Session {elapsed / 60.0:F1} min long (from F3 baseline, ROSBOT process gone, {reasonDesc})");
                }
            }
            return F3Step.F4;
        }
        return F3Step.Stay;
    }

    private static void SetShort(string value)
    {
        lock (Lock) _lastShortStatus = value;
    }
}
