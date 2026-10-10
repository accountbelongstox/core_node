// PY-REF: none (DOT-only)
using System.Drawing;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bridge;
using DotApps.d3d4tester.Core.Flow;
using DotCore.ScreenCapture;
using DotCore.Utils;
using DotCore.Utils.Input;
using DotCore.Utils.Window;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// D3 / ROSBOT window actions used by the monitor and trigger actions: shrink D3 to the top-right (RBAssist MIND3WINDOWS), stop keys
/// to the foreground D3 (F7 / F9), town portal (RBAssist POSTTP, through the shared BridgeTownPortal key), the stuck-escape mouse routine (RBAssist
/// PRESSKEYANDCLICKWINDOWPOS + DRAGCIRCLE) and client-area captures for the pixel probes.
/// </summary>
public static class GameWindowActions
{
    private const string LeaseTownPortal = "trigger town portal";
    private const int StepWaitMs = 50;
    private const int KeyWaitMs = 100;
    private const int CirclePoints = 12;
    private const int CircleStepMs = 15;
    private const int CircleRadiusInset = 40;
    private static readonly object UnstuckLock = new();
    private static DateTime _lastUnstuckUtc = DateTime.MinValue;

    /// <summary>Resize the D3 client to the configured size (min 1070x600) and move it to the top-right of the primary screen.</summary>
    public static bool ShrinkD3()
    {
        IntPtr hwnd = D3Manager.Instance.FindFirstHwnd();
        if (hwnd == IntPtr.Zero)
        {
            MonitorLog.Warn("Shrink D3 skipped: D3 window not found");
            return false;
        }
        int w = Math.Max(MonitorSettings.D3ShrinkMinWidth, MonitorSettings.GetInt(ConfigKeys.MonitorD3ShrinkWidth, MonitorSettings.D3ShrinkWidthDefault));
        int h = Math.Max(MonitorSettings.D3ShrinkMinHeight, MonitorSettings.GetInt(ConfigKeys.MonitorD3ShrinkHeight, MonitorSettings.D3ShrinkHeightDefault));
        bool ok = WindowResizer.PlaceAtTopRight(hwnd, w, h);
        MonitorLog.Info($"Shrink D3 to {w}x{h} at top-right: {(ok ? "ok" : "failed")}");
        return ok;
    }

    /// <summary>Activate D3 and send ROSBOT's F7 stop through RosbotManager (records the F7 so the ROSBOT exit counts as a stop).</summary>
    public static bool StopRosbotF7()
    {
        D3Manager.Instance.ActivateWindow();
        return RosbotManager.SendF7ToSystem();
    }

    /// <summary>Activate D3 and send a system-wide key (ROSBOT F9 pause hotkey).</summary>
    public static bool SendKeyToD3(ushort vk)
    {
        D3Manager.Instance.ActivateWindow();
        return WindowInputHelper.SendSystemKey(vk);
    }

    /// <summary>Press the configured town portal key in D3 (the one key path shared with follow mode and town standby).</summary>
    public static bool PostTownPortal()
    {
        bool sent = BridgeTownPortal.Press(LeaseTownPortal);
        MonitorLog.Info($"Town portal key '{BridgeTownPortal.Key}' {(sent ? "sent" : "not sent")} to D3");
        return sent;
    }

    /// <summary>
    /// Stuck escape: at most once per cooldownMs; F6 (ROSBOT pause), cursor to one of four points around the center, movement skill key,
    /// a counter-clockwise then clockwise drag circle with the left button, F6 again.
    /// </summary>
    public static bool UnstuckMove(string skillKey, int cooldownMs)
    {
        lock (UnstuckLock)
        {
            if ((DateTime.UtcNow - _lastUnstuckUtc).TotalMilliseconds < cooldownMs) return false;
            _lastUnstuckUtc = DateTime.UtcNow;
        }
        IntPtr hwnd = D3Manager.Instance.FindFirstHwnd();
        if (hwnd == IntPtr.Zero || !D3Manager.Instance.ActivateWindow()) return false;
        var rect = WindowInputHelper.GetWindowClientRectScreen(hwnd);
        if (rect is not { } r) return false;
        int w = r.Right - r.Left, h = r.Bottom - r.Top;
        var points = new[] { (r.Left + w / 4, r.Top + h / 2), (r.Left + w / 2, r.Top + h * 3 / 4), (r.Left + w / 2, r.Top + h / 4), (r.Left + w * 3 / 4, r.Top + h / 2) };
        var (px, py) = points[Random.Shared.Next(points.Length)];
        if (!RosbotInterruptGuard.WaitSafe("unstuck move", 0)) return false;
        MonitorLog.Info("Unstuck move");
        if (!RosbotManager.SendPauseToggleToSystem()) return false;
        try
        {
            Thread.Sleep(StepWaitMs);
            ClickHandler.MoveCursor(px, py);
            Thread.Sleep(StepWaitMs);
            AutoItKeySequence.Send(skillKey);
            Thread.Sleep(KeyWaitMs);
            int cx = r.Left + w / 2, cy = r.Top + h / 2, radius = Math.Max(10, h / 2 - CircleRadiusInset);
            DragCircle(cx, cy, radius, counterClockwise: true);
            DragCircle(cx, cy, radius, counterClockwise: false);
        }
        finally
        {
            RosbotManager.SendPauseToggleToSystem();
        }
        return true;
    }

    private static void DragCircle(int x, int y, int radius, bool counterClockwise)
    {
        ClickHandler.MoveCursor(x, y);
        Thread.Sleep(StepWaitMs);
        ClickHandler.MouseButtonDown(MouseButton.Left);
        try
        {
            Thread.Sleep(StepWaitMs);
            for (int i = 0; i <= CirclePoints; i++)
            {
                double angle = (counterClockwise ? 360 - i * 360.0 / CirclePoints : i * 360.0 / CirclePoints) * Math.PI / 180;
                ClickHandler.MoveCursor(x + (int)(Math.Cos(angle) * radius), y + (int)(Math.Sin(angle) * radius));
                Thread.Sleep(CircleStepMs);
            }
        }
        finally
        {
            ClickHandler.MouseButtonUp(MouseButton.Left);
        }
        Thread.Sleep(StepWaitMs);
    }

    /// <summary>Client-area capture of hwnd (visible pixels). Caller disposes.</summary>
    public static Bitmap? CaptureClient(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return null;
        var rect = WindowInputHelper.GetWindowClientRectScreen(hwnd);
        if (rect is not { } r || r.Right <= r.Left || r.Bottom <= r.Top) return null;
        return ScreenCaptureService.GetScreenshotProvider().CaptureRegionBitBlt(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
    }

    /// <summary>ROSBOT overlay window (shows the combat cursor), or zero.</summary>
    public static IntPtr FindRosbotOverlayHwnd() => RosbotManager.Instance.GetOverlayWindow()?.Hwnd ?? IntPtr.Zero;
}
