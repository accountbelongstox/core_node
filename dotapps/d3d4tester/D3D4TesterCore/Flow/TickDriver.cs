// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/tick_driver.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_task_processor.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/values/task_status.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/threads/task_thread_manager.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Unified 1 s clock for periodic services (the ROSBOT flow itself runs sequentially on RosbotFlowRunner); periods by modulo:
/// smart echo (tick % 3), inactive refresh (tick % 10). Each second: per-tick callbacks (log drain, monitor), then OnTick dispatch.
/// The SIGINT guard (tick % 1) is Python-only and not ported.
/// 1:1 Python d3utils/tick_driver.py (+ rosbot_task_processor.process_task ordering).
/// </summary>
public sealed class TickDriver : IFlowTick, IDisposable
{
    public const int TickIntervalMs = 1000;
    public const int TickSmartEcho = 3;
    public const int TickInactiveRefresh = 10;

    private readonly object _lock = new();
    private readonly List<Action<IFlowTick>> _everyTick = new();
    private readonly List<Action<IFlowTick>> _smartEcho = new();
    private Action? _inactiveRefresh;
    private Timer? _timer;
    private int _globalTick;
    private int _running;

    public static TickDriver Instance { get; } = new();

    private TickDriver()
    {
    }

    /// <summary>Current global tick count (+1 every 1 s).</summary>
    public int GlobalTick => Volatile.Read(ref _globalTick);


    /// <summary>Called every tick before OnTick (Python process_task head: log drain, test display, restart count).</summary>
    public void RegisterEveryTick(Action<IFlowTick> callback) => Add(_everyTick, callback);


    /// <summary>Called when tick % 3 == 0. 1:1 Python smart_echo.on_tick_from_driver.</summary>
    public void RegisterSmartEcho(Action<IFlowTick> callback) => Add(_smartEcho, callback);

    /// <summary>Single callback for tick % 10 (status refresh when flow off). 1:1 Python register_inactive_refresh.</summary>
    public void RegisterInactiveRefresh(Action callback)
    {
        lock (_lock) _inactiveRefresh = callback;
    }

    public void Unregister(Action<IFlowTick> callback)
    {
        lock (_lock)
        {
            _everyTick.Remove(callback);
            _smartEcho.Remove(callback);
        }
    }

    /// <summary>Start the 1 s clock (idempotent). Ticks never overlap: the next tick is scheduled after the current one finishes.</summary>
    public void Start()
    {
        lock (_lock)
        {
            if (_timer != null) return;
            _timer = new Timer(_ => OnTimer(), null, TickIntervalMs, Timeout.Infinite);
        }
    }

    private void OnTimer()
    {
        RunOnce();
        lock (_lock) _timer?.Change(TickIntervalMs, Timeout.Infinite);
    }

    public void Stop()
    {
        lock (_lock)
        {
            _timer?.Dispose();
            _timer = null;
        }
    }

    public void Dispose() => Stop();

    /// <summary>One 1 s step: every-tick callbacks, then OnTick.</summary>
    public void RunOnce()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return;
        try
        {
            Dispatch(Snapshot(_everyTick), "every_tick");
            OnTick();
        }
        finally
        {
            Volatile.Write(ref _running, 0);
        }
    }

    /// <summary>Increment the global tick and dispatch smart echo (% 3) and inactive refresh (% 10). 1:1 Python on_tick.</summary>
    public void OnTick()
    {
        int t = Interlocked.Increment(ref _globalTick);
        if (t % TickSmartEcho == 0)
            Dispatch(Snapshot(_smartEcho), "smart_echo");
        Action? inactive;
        lock (_lock) inactive = _inactiveRefresh;
        if (t % TickInactiveRefresh == 0 && inactive != null)
        {
            try { inactive(); }
            catch (Exception ex) { ColorPrinter.Red($"[TickDriver] inactive_refresh: {ex.Message}"); }
        }
    }

    private void Add(List<Action<IFlowTick>> list, Action<IFlowTick> callback)
    {
        lock (_lock)
        {
            if (!list.Contains(callback)) list.Add(callback);
        }
    }

    private Action<IFlowTick>[] Snapshot(List<Action<IFlowTick>> list)
    {
        lock (_lock) return list.ToArray();
    }

    private void Dispatch(Action<IFlowTick>[] callbacks, string name)
    {
        foreach (var cb in callbacks)
        {
            try { cb(this); }
            catch (Exception ex) { ColorPrinter.Red($"[TickDriver] {name}: {ex.Message}"); }
        }
    }
}
