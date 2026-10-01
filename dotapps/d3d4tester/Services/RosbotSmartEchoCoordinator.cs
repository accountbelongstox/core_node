using System.Linq;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.Utils.Ocr;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Smart Echo: one trigger (log "Picking end" + lookback contains Echoing Fury) -> one F7 pause; OCR tick on TickDriver (tick % 3):
/// activate D3, capture, crop middle 30 % / upper half, OCR; no CJK and no digit -> resume. 60 s timeout -> resume.
/// Resume closes the D3-must-be-launched dialog and the No items popup (then rift switch) first; resume failure -> extension ROSBOT start.
/// 1:1 Python d3utils/smart_echo.py.
/// </summary>
public static class RosbotSmartEchoCoordinator
{
    private const string LogPrefix = "[SmartEcho]";
    private const char CjkFirst = '一';
    private const char CjkLast = '鿿';

    private static readonly object Sync = new();
    private static readonly Action<IFlowTick> SmartEchoTick = _ => OnTickFromDriver();
    private static bool _resumePending;
    private static bool _ocrResumeScheduled;
    private static DateTime _endUtc;

    public static void Shutdown()
    {
        TickDriver.Instance.Unregister(SmartEchoTick);
        lock (Sync)
        {
            _resumePending = false;
            _ocrResumeScheduled = false;
        }
    }

    /// <summary>Picking end + lookback contains Echoing Fury: F7 and start the OCR resume loop.</summary>
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
        ColorPrinter.Green($"{LogPrefix} Echo map returning to town.");
        DoSmartEchoPauseAfterComplete();
    }

    /// <summary>Send F7 once, message once; resume is driven by the TickDriver smart-echo tick. 1:1 Python do_smart_echo_pause_after_complete.</summary>
    public static void DoSmartEchoPauseAfterComplete()
    {
        lock (Sync)
        {
            if (_resumePending)
                return;
            _resumePending = true;
            _ocrResumeScheduled = false;
        }
        if (!SystemKeySend.TrySendF7())
        {
            lock (Sync) _resumePending = false;
            ColorPrinter.Red($"{LogPrefix} F7 send failed");
            return;
        }
        ColorPrinter.Green($"{LogPrefix} Smart pause ROSBOT to prevent game exit.");
        DateTime end = DateTime.UtcNow.AddSeconds(RosbotLogConstants.SmartEchoOcrMaxSeconds);
        lock (Sync) _endUtc = end;
        TickDriver.Instance.RegisterSmartEcho(SmartEchoTick);
        Task.Run(() => CaptureTick(end));
    }

    /// <summary>TickDriver tick % 3: one OCR step only while a resume is pending. 1:1 Python on_tick_from_driver.</summary>
    public static void OnTickFromDriver()
    {
        DateTime end;
        lock (Sync)
        {
            if (!_resumePending) return;
            end = _endUtc;
        }
        CaptureTick(end);
    }

    /// <summary>OCR the game region; no CJK and no digit -> resume; timeout -> resume. 1:1 Python _smart_echo_capture_tick.</summary>
    private static void CaptureTick(DateTime endUtc)
    {
        if (DateTime.UtcNow >= endUtc)
        {
            if (TryMarkResumeScheduled())
            {
                ColorPrinter.Yellow($"{LogPrefix} OCR tick timeout (60s), resume now.");
                ScheduleResume();
            }
            return;
        }
        string text = "";
        var sd = D3Manager.Instance.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} D3 window not found, skip OCR tick");
        }
        else
        {
            using var region = D3GameWindowRegion.CropGameWindowMiddle30UpperHalf(sd.GameWindowImage);
            if (region == null)
            {
                ColorPrinter.Yellow($"{LogPrefix} Crop middle30 upper half failed, skip OCR tick");
            }
            else
            {
                ColorPrinter.Blue($"{LogPrefix} OCR region size: {region.Width}x{region.Height} (middle 30%, upper half)");
                text = OcrHelper.GetResult(region)?.Text ?? "";
                ColorPrinter.Blue($"{LogPrefix} OCR: " + (string.IsNullOrWhiteSpace(text) ? "(no text)" : text.Trim()));
            }
        }
        lock (Sync)
        {
            if (_ocrResumeScheduled) return;
        }
        if (HasChinese(text) || HasDigit(text))
            return;
        if (!TryMarkResumeScheduled()) return;
        ColorPrinter.Green($"{LogPrefix} No Chinese text and no digits, resume now.");
        ScheduleResume();
    }

    private static bool TryMarkResumeScheduled()
    {
        lock (Sync)
        {
            if (_ocrResumeScheduled) return false;
            _ocrResumeScheduled = true;
            return true;
        }
    }

    /// <summary>True if text contains at least one CJK character (U+4E00..U+9FFF).</summary>
    private static bool HasChinese(string text) => text.Any(c => c >= CjkFirst && c <= CjkLast);

    private static bool HasDigit(string text) => text.Any(char.IsDigit);

    private static void ScheduleResume() => Task.Run(DoResumeAfterSmartEcho);

    /// <summary>Resume ROSBOT after the pause; No items popup closed -> rift switch + start instead. 1:1 Python _do_resume_rosbot_after_smart_echo.</summary>
    private static void DoResumeAfterSmartEcho()
    {
        lock (Sync)
        {
            _resumePending = false;
            _ocrResumeScheduled = false;
        }
        TickDriver.Instance.Unregister(SmartEchoTick);
        try
        {
            RosbotUiAutomation.TryCloseD3MustBeLaunchedDialog();
            if (RosbotUiAutomation.TryCloseNoItemsPopup())
            {
                RosbotUiAutomation.DoAfterNoItemsCloseSwitchRiftAndStart();
                return;
            }
            if (RosbotStatusProvider.GetRosbotOperation().ResumeRosbot(doTab: true, doStartBotting: true))
            {
                ColorPrinter.Green($"{LogPrefix} ROSBOT resumed after pause.");
                return;
            }
            ColorPrinter.Yellow($"{LogPrefix} ROSBOT resume (UI) failed.");
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogPrefix} Resume: " + ex.Message);
        }
        RosbotFlowHost.Current?.TriggerExtensionRosbotStart();
    }
}
