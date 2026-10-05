// PY-REF: none (DOT-only)
using System.Drawing;
using System.Runtime.InteropServices;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotCore.ScreenCapture;
using DotCore.Utils;
using DotCore.Utils.Input;
using DotCore.Utils.Window;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// D3 / ROSBOT window actions used by the monitor and trigger actions: shrink D3 to the top-right (RBAssist MIND3WINDOWS), stop keys
/// to the foreground D3 (F7 / F9), town portal by PostMessage (RBAssist POSTTP), the stuck-escape mouse routine (RBAssist
/// PRESSKEYANDCLICKWINDOWPOS + DRAGCIRCLE) and client-area captures for the pixel probes.
/// </summary>
public static class GameWindowActions
{
    private const ushort VkF6 = 0x75;
    private const uint WmKeyDown = 0x0100;
    private const uint WmKeyUp = 0x0101;
    private const int VkTownPortal = 0x54;
    private const int TownPortalDownLParam = 0x001E0001;
    private const uint TownPortalUpLParam = 0xC01E0001;
    private const int ActivateWaitMs = 200;
    private const int StepWaitMs = 50;
    private const int KeyWaitMs = 100;
    private const int CirclePoints = 12;
    private const int CircleStepMs = 15;
    private const int CircleRadiusInset = 40;
    private static readonly object UnstuckLock = new();
    private static DateTime _lastUnstuckUtc = DateTime.MinValue;

    public static IntPtr FindD3Hwnd() => D3Manager.Instance.FindFirstWindow()?.Hwnd ?? IntPtr.Zero;

    /// <summary>Resize the D3 client to the configured size (min 1070x600) and move it to the top-right of the primary screen.</summary>
    public static bool ShrinkD3()
    {
        IntPtr hwnd = FindD3Hwnd();
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

    /// <summary>Activate D3 and send a system-wide key (ROSBOT F7 stop / F9 pause hotkeys).</summary>
    public static bool SendKeyToD3(ushort vk)
    {
        D3Manager.Instance.ActivateWindow();
        Thread.Sleep(ActivateWaitMs);
        return WindowInputHelper.SendSystemKey(vk);
    }

    /// <summary>Post the town portal key to the D3 window without focusing it.</summary>
    public static bool PostTownPortal()
    {
        IntPtr hwnd = FindD3Hwnd();
        if (hwnd == IntPtr.Zero) return false;
        bool down = PostMessage(hwnd, WmKeyDown, (IntPtr)VkTownPortal, (IntPtr)TownPortalDownLParam);
        bool up = PostMessage(hwnd, WmKeyUp, (IntPtr)VkTownPortal, unchecked((IntPtr)(int)TownPortalUpLParam));
        MonitorLog.Info("Town portal key posted to D3");
        return down && up;
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
        IntPtr hwnd = FindD3Hwnd();
        if (hwnd == IntPtr.Zero || !D3Manager.Instance.ActivateWindow()) return false;
        Thread.Sleep(ActivateWaitMs);
        var rect = WindowInputHelper.GetWindowClientRectScreen(hwnd);
        if (rect is not { } r) return false;
        int w = r.Right - r.Left, h = r.Bottom - r.Top;
        var points = new[] { (r.Left + w / 4, r.Top + h / 2), (r.Left + w / 2, r.Top + h * 3 / 4), (r.Left + w / 2, r.Top + h / 4), (r.Left + w * 3 / 4, r.Top + h / 2) };
        var (px, py) = points[Random.Shared.Next(points.Length)];
        MonitorLog.Info("Unstuck move");
        WindowInputHelper.SendSystemKey(VkF6);
        Thread.Sleep(StepWaitMs);
        ClickHandler.MoveCursor(px, py);
        Thread.Sleep(StepWaitMs);
        AutoItKeySequence.Send(skillKey);
        Thread.Sleep(KeyWaitMs);
        int cx = r.Left + w / 2, cy = r.Top + h / 2, radius = Math.Max(10, h / 2 - CircleRadiusInset);
        DragCircle(cx, cy, radius, counterClockwise: true);
        DragCircle(cx, cy, radius, counterClockwise: false);
        WindowInputHelper.SendSystemKey(VkF6);
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

    /// <summary>First titled window of the ROSBOT process (its overlay, which shows the combat cursor), or zero.</summary>
    public static IntPtr FindRosbotOverlayHwnd()
    {
        var mgr = RosbotManager.Instance;
        foreach (int pid in mgr.GetDetection().Pids)
        {
            var w = mgr.FindWindowsByPid(pid, visibleOnly: true).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Title));
            if (w != null) return w.Hwnd;
        }
        return IntPtr.Zero;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
