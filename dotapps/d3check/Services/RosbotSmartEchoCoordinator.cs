using System.Linq;
using System.Threading;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Ctl;
using DotCore.Foundations;

namespace DotApps.d3check.Services;

/// <summary>
/// Smart Echo: F7 pause + periodic tick + 60s timeout resume. 1:1 Python d3utils.smart_echo.do_smart_echo_pause_after_complete + on_tick_from_driver (OCR stub until Tesseract).
/// </summary>
public static class RosbotSmartEchoCoordinator
{
    private static readonly object Sync = new();
    private static Timer? _timer;
    private static bool _pending;
    private static DateTime _endUtc;

    public static void Shutdown()
    {
        lock (Sync)
        {
            _timer?.Dispose();
            _timer = null;
            _pending = false;
        }
    }

    /// <summary>Picking end + lookback contains Echoing Fury: F7 and start OCR/timer loop.</summary>
    public static void TryPickingEndEchoRule(string line, IReadOnlyList<string> recentLinesBeforeCurrent)
    {
        if (!ConfigOptionsProvider.GetOptions<RosbotOptions>().SmartEcho)
            return;
        if (!line.Contains(RosbotLogConstants.PickingEndSentinel, StringComparison.Ordinal))
            return;
        var lookback = RosbotLogLookback.GetLookbackLines(
            recentLinesBeforeCurrent,
            RosbotLogPaths.GetLogsFilePath(),
            RosbotLogConstants.PickingEndSentinel,
            RosbotLogConstants.PickingEndLookback);
        if (lookback.Count < RosbotLogConstants.PickingEndLookback)
            return;
        if (!lookback.Any(l => l.Contains(RosbotLogConstants.EchoingFuryExplorationMarker, StringComparison.Ordinal)))
            return;
        ColorPrinter.Green("[SmartEcho] Echo map returning to town.");
        BeginPauseAfterComplete();
    }

    private static void BeginPauseAfterComplete()
    {
        lock (Sync)
        {
            if (_pending)
                return;
            if (!SystemKeySend.TrySendF7())
            {
                ColorPrinter.Red("[SmartEcho] F7 send failed");
                return;
            }
            _pending = true;
            _endUtc = DateTime.UtcNow.AddSeconds(RosbotLogConstants.SmartEchoOcrMaxSeconds);
            ColorPrinter.Green("[SmartEcho] Smart pause ROSBOT to prevent game exit.");
            _timer?.Dispose();
            _timer = new Timer(OnTimerTick, null, 0, RosbotLogConstants.SmartEchoTimerIntervalMs);
        }
    }

    private static void OnTimerTick(object? state)
    {
        if (!_pending)
            return;
        if (DateTime.UtcNow >= _endUtc)
        {
            ColorPrinter.Yellow("[SmartEcho] OCR tick timeout (60s), resume now.");
            TryResumeAfterPause();
            return;
        }
        // OCR: Dot has no ocr_helper tick yet; keep pending until timeout (Python checks Chinese/digits each 3s).
        ColorPrinter.Gray("[SmartEcho] OCR tick (stub: extend with middle30 OCR to match Python resume rules)");
    }

    private static void TryResumeAfterPause()
    {
        lock (Sync)
        {
            _timer?.Dispose();
            _timer = null;
            _pending = false;
        }
        Task.Run(() =>
        {
            try
            {
                var op = RosbotStatusProvider.GetRosbotOperation();
                if (op.ResumeRosbot(doTab: true, doStartBotting: true))
                    ColorPrinter.Green("[SmartEcho] ROSBOT resumed after pause.");
                else
                    ColorPrinter.Yellow("[SmartEcho] ROSBOT resume (UI) failed.");
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow("[SmartEcho] Resume: " + ex.Message);
            }
        });
    }
}
