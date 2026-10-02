// PY-REF: pyapps/d3-check/d3utils/d3_status_provider.py
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Window;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// D3 status provider: window detection, geometry and dynamic state from one capture of all D3 templates
/// (disconnected; start-game button or connecting = pre-game menu; game tool = in game). All state goes to GameInterfaceData.
/// skipDynamic = window + geometry only (no capture). Silent while F3-only refresh is active.
/// 1:1 Python d3utils/d3_status_provider.py (Python fills only disconnected; menu/in-game are DOT additions).
/// </summary>
public static class D3StatusProvider
{
    private const string LogPrefix = "[D3StatusProvider]";
    private const string ProgressPrefix = "[D3]";

    /// <summary>Immediate check: current D3 window or null. 1:1 Python get_current_d3_window.</summary>
    public static WindowFinder.WindowInfo? GetCurrentWindow() => D3Manager.Instance.FindFirstWindow();

    /// <summary>Detect window (+ dynamic unless skipDynamic) and update GameInterfaceData; returns the window. 1:1 Python refresh_d3_status.</summary>
    public static WindowFinder.WindowInfo? RefreshD3Status(bool skipDynamic = false) => Refresh(skipDynamic).Window;

    /// <summary>Returns (window or null, state_changed). 1:1 Python _refresh_d3_status_internal.</summary>
    public static (WindowFinder.WindowInfo? Window, bool Changed) Refresh(bool skipDynamic = false)
    {
        var game = GameInterfaceData.Instance;
        var window = GetCurrentWindow();
        string winLabel = window != null ? "ok" : "no";
        if (window != null && !skipDynamic)
            D3Manager.Instance.PrimeWindowCacheForCapture();
        bool silent = F3RefreshLine.IsSilent;
        bool changed = StatusProviderCommon.RefreshWindowState(
            window,
            setRunning: game.SetD3Status,
            setDynamic: game.SetD3DynamicStatus,
            detectDynamic: skipDynamic ? NoopDetectDynamic : DetectD3Dynamic,
            applyGeometry: ApplyD3Geometry,
            logPrefix: LogPrefix,
            progressRefresh: silent ? _ => { } : step => ColorPrinter.GrayRefresh($"{ProgressPrefix} {winLabel} {step}"),
            skipFinalNewline: silent);
        return (window, changed);
    }

    /// <summary>(on_login_screen, disconnected, in_game) from one capture of all templates; exclusive, disconnected first.</summary>
    private static (bool OnLogin, bool Disconnected, bool Third) DetectD3Dynamic(bool found, WindowFinder.WindowInfo? window)
    {
        if (!found || window == null) return (false, false, false);
        var (_, states) = D3StartGameAndTeleport.CaptureAndDetectAllD3States();
        if (states.Disconnected) return (false, true, false);
        if (states.GameTool) return (false, false, true);
        return (states.StartGameButton || states.Connecting, false, false);
    }

    private static (bool OnLogin, bool Disconnected, bool Third) NoopDetectDynamic(bool found, WindowFinder.WindowInfo? window) =>
        (false, false, false);

    private static void ApplyD3Geometry(WindowFinder.WindowInfo? window)
    {
        var game = GameInterfaceData.Instance;
        if (window != null)
            game.ApplyD3WindowGeometry(window.Hwnd, window.Title, (window.Left, window.Top), WindowResizer.GetScreenSize());
        else
            game.ApplyD3WindowGeometry(IntPtr.Zero, null, (0, 0), (0, 0));
    }
}
