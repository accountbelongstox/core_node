// PY-REF: pyapps/d3-check/timers/window_monitor_timer.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Window monitor: D3 window size and OAuth script health for the status bar, plus the one-time full status refresh when
/// the flow is inactive (TickDriver tick % 10). The full refresh (BN + D3 + ROSBOT providers) is pluggable so the
/// status-provider owners can install run_full_status_refresh; without it only the D3 window geometry is refreshed.
/// 1:1 Python timers/window_monitor_timer.py + one_shot_tasks.do_window_monitor_initial_check + bottom_bar.on_window_status_update.
/// Fixes Python bug: bottom bar read state["oauth_script_connected"] which was never written; here the ping state is
/// pushed into GameInterfaceData every tick.
/// </summary>
public sealed class WindowMonitorService
{
    private readonly object _lock = new();
    private readonly List<Action<WindowFinder.WindowInfo?>> _callbacks = new();
    private Func<WindowFinder.WindowInfo?>? _fullStatusRefresh;
    private bool _inactiveRefreshDone;
    private bool _registered;

    public static WindowMonitorService Instance { get; } = new();

    private WindowMonitorService() { }

    /// <summary>
    /// Install the full status refresh (refresh BN + D3 light + ROSBOT, notify, return the D3 window or null).
    /// 1:1 Python rosbot_task_processor.run_full_status_refresh.
    /// </summary>
    public void SetFullStatusRefresh(Func<WindowFinder.WindowInfo?>? refresh)
    {
        lock (_lock) _fullStatusRefresh = refresh;
    }

    /// <summary>Add a D3 window callback (null = no window). 1:1 Python add_callback.</summary>
    public void AddCallback(Action<WindowFinder.WindowInfo?> callback)
    {
        lock (_lock)
        {
            if (!_callbacks.Contains(callback)) _callbacks.Add(callback);
        }
    }

    public void RemoveCallback(Action<WindowFinder.WindowInfo?> callback)
    {
        lock (_lock) _callbacks.Remove(callback);
    }

    /// <summary>Register the inactive-refresh callback (tick % 10) and the per-tick OAuth health update on the TickDriver.</summary>
    public void Register()
    {
        lock (_lock)
        {
            if (_registered) return;
            _registered = true;
        }
        TickDriver.Instance.RegisterInactiveRefresh(OnInactiveRefreshTick);
        TickDriver.Instance.RegisterEveryTick(OnEveryTick);
    }

    public void Unregister()
    {
        lock (_lock)
        {
            if (!_registered) return;
            _registered = false;
        }
        TickDriver.Instance.Unregister(OnEveryTick);
    }

    /// <summary>Startup / manual refresh: full status refresh, notify window callbacks, mark inactive refresh done. 1:1 do_window_monitor_initial_check.</summary>
    public void RunInitialCheck()
    {
        var d3 = RunFullRefresh();
        NotifyWindowCallbacks(d3);
        MarkInactiveRefreshDone();
        ColorPrinter.Blue("[Refresh] Done (Battle.net + D3 + ROSBOT)");
    }

    /// <summary>Notify callbacks and update the status bar window size. 1:1 Python notify_window_callbacks.</summary>
    public void NotifyWindowCallbacks(WindowFinder.WindowInfo? d3)
    {
        ApplyWindowSize(d3);
        Action<WindowFinder.WindowInfo?>[] copy;
        lock (_lock) copy = _callbacks.ToArray();
        foreach (var cb in copy)
        {
            try { cb(d3); }
            catch (Exception ex) { ColorPrinter.Gray($"[DEBUG][WindowMonitor] callback error: {ex.Message}"); }
        }
    }

    public void MarkInactiveRefreshDone()
    {
        lock (_lock) _inactiveRefreshDone = true;
    }

    /// <summary>Immediate D3 window lookup (first match) or null. 1:1 Python get_current_window_info.</summary>
    public static WindowFinder.WindowInfo? GetCurrentWindowInfo()
    {
        try
        {
            var windows = D3WindowFinder.FindWindows();
            return windows.Count > 0 ? windows[0] : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Tick % 10: run the full refresh once (Python _inactive_refresh_done); afterwards probe the Battle.net client screen state
    /// (passive, no activation; skipped while BN-only already refreshes it every flow step) and, when no flow runs, the cheap
    /// D3 geometry lookup so the status bar size follows window moves and closes.
    /// </summary>
    private void OnInactiveRefreshTick()
    {
        bool done;
        lock (_lock) done = _inactiveRefreshDone;
        if (!done)
        {
            var d3 = RunFullRefresh();
            NotifyWindowCallbacks(d3);
            MarkInactiveRefreshDone();
            return;
        }
        ProbeBattlenetClient();
        if (RosbotFlowState.Instance.FlowMasterEnabled || RosbotFlowState.Instance.BnOnlyEnabled) return;
        ApplyWindowSize(GetCurrentWindowInfo());
    }

    private static void ProbeBattlenetClient()
    {
        if (ShutdownManager.IsShutdownRequested || BattlenetReadyProcess.IsRunning) return;
        try
        {
            bool changed = BattlenetStatusProvider.Refresh().Changed;
            if (GameInterfaceData.Instance.GetStateSnapshot().BattlenetClientState == BattlenetClientState.Popup
                && BattlenetPopupDismiss.TryCloseModal())
                changed |= BattlenetStatusProvider.Refresh().Changed;
            if (changed)
                GameInterfaceData.Instance.NotifyCallbacks();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[WindowMonitor] Battle.net probe failed: {ex.Message}");
        }
    }

    private void OnEveryTick(IFlowTick _)
    {
        if (ShutdownManager.IsShutdownRequested) return;
        bool connected = OAuthCallbackState.IsScriptConnected(AppConstants.OauthScriptPingTimeoutSec);
        var game = GameInterfaceData.Instance;
        if (game.GetStateSnapshot().OauthScriptConnected == connected) return;
        game.SetOauthScriptConnected(connected);
        game.NotifyCallbacks();
    }

    private WindowFinder.WindowInfo? RunFullRefresh()
    {
        Func<WindowFinder.WindowInfo?>? refresh;
        lock (_lock) refresh = _fullStatusRefresh;
        if (refresh != null)
        {
            try { return refresh(); }
            catch (Exception ex) { ColorPrinter.Red($"[WindowMonitor] Full status refresh failed: {ex.Message}"); }
        }
        return GetCurrentWindowInfo();
    }

    private static void ApplyWindowSize(WindowFinder.WindowInfo? d3)
    {
        if (ShutdownManager.IsShutdownRequested) return;
        int w = d3?.Width ?? 0;
        int h = d3?.Height ?? 0;
        var game = GameInterfaceData.Instance;
        var s = game.GetStateSnapshot();
        if (s.WindowWidth == w && s.WindowHeight == h) return;
        game.SetStatusWindowSize(w, h);
        game.NotifyCallbacks();
    }
}
