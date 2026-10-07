// PY-REF: none (DOT-only)
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// One background thread running a sequential flow until stopped: Start creates the thread with a fresh <see cref="FlowContext"/>,
/// Stop cancels it. An unexpected exception is logged and the body runs again after <see cref="ErrorRetrySec"/>.
/// Shared by the ROSBOT flow runner and the Battle.net guard.
/// </summary>
public sealed class FlowThread
{
    private const double ErrorRetrySec = 5.0;

    private readonly object _lock = new();
    private readonly string _name;
    private readonly Action<FlowContext> _body;
    private readonly Func<bool>? _yieldWhen;
    private CancellationTokenSource? _cts;
    private Thread? _thread;

    public FlowThread(string name, Action<FlowContext> body, Func<bool>? yieldWhen = null)
    {
        _name = name;
        _body = body;
        _yieldWhen = yieldWhen;
    }

    public bool IsRunning
    {
        get { lock (_lock) return _thread is { IsAlive: true } && _cts is { IsCancellationRequested: false }; }
    }

    /// <summary>Start the thread (idempotent while it runs).</summary>
    public void Start()
    {
        lock (_lock)
        {
            if (_thread is { IsAlive: true } && _cts is { IsCancellationRequested: false }) return;
            _cts = new CancellationTokenSource();
            var ctx = new FlowContext(_cts.Token, _yieldWhen);
            _thread = new Thread(() => Run(ctx)) { IsBackground = true, Name = _name };
            _thread.Start();
        }
    }

    /// <summary>Cancel the run; the thread ends at its next wait.</summary>
    public void Stop()
    {
        lock (_lock) _cts?.Cancel();
    }

    private void Run(FlowContext ctx)
    {
        ColorPrinter.Blue($"[{_name}] started");
        while (!ctx.IsStopped)
        {
            try
            {
                _body(ctx);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"[{_name}] {ex.GetType().Name}: {ex.Message}");
                try { ctx.Wait(ErrorRetrySec); }
                catch (OperationCanceledException) { break; }
            }
        }
        ColorPrinter.Yellow($"[{_name}] stopped");
    }
}
