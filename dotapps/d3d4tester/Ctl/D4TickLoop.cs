using System.Threading;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// Background D4 tick: calls <see cref="D4Controller.Process"/> every <see cref="D4Constants.TickIntervalMs"/> while EXP farming
/// runs or the debug window is open; the thread ends when neither holds. 1:1 Python pyapps/d3-check/threads/d4_extension_thread.py.
/// </summary>
public sealed class D4TickLoop
{
    private const string LogPrefix = "[D4ExtensionThread]";
    private const int SleepStepMs = 100;
    private const int ErrorBackoffMs = 1000;

    private static readonly Lazy<D4TickLoop> LazyInstance = new(() => new D4TickLoop());

    private readonly object _lock = new();
    private Thread? _thread;
    private volatile bool _shutdown;

    private D4TickLoop()
    {
        ShutdownManager.RegisterShutdownHook(Stop);
    }

    public static D4TickLoop Instance => LazyInstance.Value;

    public bool IsRunning { get { lock (_lock) return _thread != null; } }

    /// <summary>Start the tick thread if it is not running (call after setting the farming or debug-window flag).</summary>
    public void EnsureRunning()
    {
        lock (_lock)
        {
            if (_thread != null) return;
            _shutdown = false;
            _thread = new Thread(Run) { IsBackground = true, Name = "D4TickLoop" };
            _thread.Start();
        }
    }

    /// <summary>Request the thread to end (app shutdown); the current tick finishes first.</summary>
    public void Stop() => _shutdown = true;

    private void Run()
    {
        var controller = D4Controller.Instance;
        ColorPrinter.Blue($"{LogPrefix} Started");
        while (!_shutdown)
        {
            lock (_lock)
            {
                if (!controller.ShouldProcess)
                {
                    _thread = null;
                    break;
                }
            }
            try
            {
                controller.Process();
                for (int waited = 0; waited < D4Constants.TickIntervalMs && !_shutdown && controller.ShouldProcess; waited += SleepStepMs)
                    Thread.Sleep(SleepStepMs);
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogPrefix} Error: {ex.Message}");
                Thread.Sleep(ErrorBackoffMs);
            }
        }
        lock (_lock)
        {
            if (ReferenceEquals(_thread, Thread.CurrentThread)) _thread = null;
        }
        ColorPrinter.Yellow($"{LogPrefix} Stopped");
    }
}
