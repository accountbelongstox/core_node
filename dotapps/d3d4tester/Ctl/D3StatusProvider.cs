using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Window;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// D3 status provider: window detection, geometry and dynamic state (disconnected via the d3_disconnected template, one capture
/// for all states). skipDynamic = window + geometry only (no capture). Silent while F3-only refresh is active.
/// 1:1 Python d3utils/d3_status_provider.py.
/// </summary>
public static class D3StatusProvider
{
    private const string LogPrefix = "[D3StatusProvider]";
    private const string ProgressPrefix = "[D3]";

    private static readonly object Lock = new();
    private static (int Width, int Height) _fullscreenSize;
    private static (int X, int Y) _windowOffset;
    private static IntPtr _windowHwnd;
    private static string? _windowTitle;

    /// <summary>Geometry applied by the last refresh (Python game_data fullscreen_size / window_offset / _window_hwnd / _window_title).</summary>
    public static ((int Width, int Height) FullscreenSize, (int X, int Y) WindowOffset, IntPtr Hwnd, string? Title) Geometry
    {
        get { lock (Lock) return (_fullscreenSize, _windowOffset, _windowHwnd, _windowTitle); }
    }

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
            setRunning: found => SetD3Status(game, found),
            setDynamic: (onLogin, disconnected, inGame) => SetD3DynamicStatus(game, onLogin, disconnected, inGame),
            detectDynamic: skipDynamic ? NoopDetectDynamic : DetectD3Dynamic,
            applyGeometry: ApplyD3Geometry,
            logPrefix: LogPrefix,
            progressRefresh: silent ? _ => { } : step => ColorPrinter.GrayRefresh($"{ProgressPrefix} {winLabel} {step}"),
            skipFinalNewline: silent);
        return (window, changed);
    }

    /// <summary>(on_login_screen, disconnected, in_game): only disconnected is detected (one capture, all templates).</summary>
    private static (bool OnLogin, bool Disconnected, bool Third) DetectD3Dynamic(bool found, WindowFinder.WindowInfo? window)
    {
        if (!found || window == null) return (false, false, false);
        var (_, states) = D3StartGameAndTeleport.CaptureAndDetectAllD3States();
        return (false, states.Disconnected, false);
    }

    private static (bool OnLogin, bool Disconnected, bool Third) NoopDetectDynamic(bool found, WindowFinder.WindowInfo? window) =>
        (false, false, false);

    private static void ApplyD3Geometry(WindowFinder.WindowInfo? window)
    {
        lock (Lock)
        {
            if (window != null)
            {
                _fullscreenSize = WindowResizer.GetScreenSize();
                _windowOffset = (window.Left, window.Top);
                _windowHwnd = window.Hwnd;
                _windowTitle = window.Title;
            }
            else
            {
                _fullscreenSize = (0, 0);
                _windowOffset = (0, 0);
                _windowHwnd = IntPtr.Zero;
                _windowTitle = null;
            }
        }
    }

    private static bool SetD3Status(GameInterfaceData game, bool running)
    {
        bool before = game.GetStateSnapshot().D3Running;
        game.SetD3Status(running);
        return before != running;
    }

    private static bool SetD3DynamicStatus(GameInterfaceData game, bool onLogin, bool disconnected, bool inGame)
    {
        var s = game.GetStateSnapshot();
        bool changed = s.D3OnLoginScreen != onLogin || s.D3Disconnected != disconnected || s.D3InGame != inGame;
        game.SetD3DynamicStatus(onLogin, disconnected, inGame);
        return changed;
    }
}
