// PY-REF: none (DOT-only)
using System;
using System.Diagnostics;
using System.Text;
using System.Threading;

namespace CoreNodeBridge;

/// <summary>
/// Pause ROSBOT from inside (app command "hold"), so the plugin keeps live data and commands while ROSBOT does nothing: ROSBOT's own
/// pause (F6) also stops its game reader, every plugin API call then blocks until ROSBOT resumes. Instead, the next OnPulse (ROSBOT's
/// bot thread) is kept inside the plugin: ROSBOT runs no task while the plugin's timer thread, its command worker and the state writer
/// keep calling the API. Safety: the hold watches the state writer; when an API read stalls longer than StallMs while holding, the
/// reader evidently needs the bot thread, so the hold is released at once and marked unsupported (the app then pauses with F6).
/// Ends on "hold off", plugin disabled / shut down, or after MaxHoldMs.
/// Research aid for ROSBOT's pause point: any API read stalled longer than DumpMs (held or paused with F6) logs the stack of the
/// stalled thread and of ROSBOT's bot thread once per stall (thread suspended for the snapshot only).
/// </summary>
internal sealed class PulseHold
{
    public const string StateOff = "off";
    public const string StateRequested = "requested";
    public const string StateHolding = "holding";
    public const string StateUnsupported = "unsupported";
    private const int SliceMs = 200;
    private const int StallMs = 5000;
    private const int DumpMs = 8000;
    private const int MaxHoldMs = 4 * 60 * 60 * 1000;
    private const int MaxFrames = 40;

    private readonly Action<string> _log;
    private readonly Func<DateTime> _readStartedUtc;
    private readonly Func<Thread> _readThread;
    private volatile bool _requested;
    private volatile Thread _botThread;
    private DateTime _dumpedFor = DateTime.MinValue;

    /// <param name="readStartedUtc">Start of the API read in progress (state write), MinValue when none.</param>
    /// <param name="readThread">Thread of that read.</param>
    public PulseHold(Action<string> log, Func<DateTime> readStartedUtc, Func<Thread> readThread)
    {
        _log = log;
        _readStartedUtc = readStartedUtc;
        _readThread = readThread;
    }

    public string State { get; private set; } = StateOff;
    public DateTime SinceUtc { get; private set; } = DateTime.MinValue;
    public DateTime LastPulseUtc { get; private set; } = DateTime.MinValue;
    public bool Requested => _requested;

    /// <summary>Request (on) or end (off) the hold; an unsupported mark stays until the plugin restarts.</summary>
    public void Set(bool on)
    {
        if (on && State == StateUnsupported)
        {
            _log("hold not started: unsupported (API reads stalled while holding)");
            return;
        }
        _requested = on;
        if (on && State == StateOff) State = StateRequested;
        if (!on && State == StateRequested) State = StateOff;
        _log("hold " + (on ? "requested (next ROSBOT pulse)" : "released"));
    }

    /// <summary>ROSBOT's pulse (bot thread): remember the thread; while a hold is requested keep it here (blocks ROSBOT's task).</summary>
    public void OnPulse(Func<bool> enabled)
    {
        _botThread = Thread.CurrentThread;
        LastPulseUtc = DateTime.UtcNow;
        if (!_requested) return;
        State = StateHolding;
        SinceUtc = DateTime.UtcNow;
        _log("hold: ROSBOT's bot thread held (no task runs), plugin keeps reading");
        var held = Stopwatch.StartNew();
        string end = "released";
        while (_requested)
        {
            if (!enabled()) { end = "plugin disabled"; break; }
            if (held.ElapsedMilliseconds > MaxHoldMs) { end = $"max {MaxHoldMs / 60000} min"; break; }
            var started = _readStartedUtc();
            if (started != DateTime.MinValue && (DateTime.UtcNow - started).TotalMilliseconds > StallMs)
            {
                end = $"API read stalled {StallMs / 1000}s while holding -> unsupported";
                _requested = false;
                State = StateUnsupported;
                break;
            }
            Thread.Sleep(SliceMs);
            LastPulseUtc = DateTime.UtcNow;
        }
        if (State == StateHolding) State = StateOff;
        SinceUtc = DateTime.MinValue;
        _log($"hold ended after {held.ElapsedMilliseconds / 1000}s: {end}");
    }

    /// <summary>End any hold now (plugin disabled / shut down).</summary>
    public void Release() => _requested = false;

    /// <summary>Watchdog (own timer): one stack dump per stalled API read longer than DumpMs.</summary>
    public void CheckStall()
    {
        var started = _readStartedUtc();
        if (started == DateTime.MinValue || started == _dumpedFor || (DateTime.UtcNow - started).TotalMilliseconds < DumpMs) return;
        _dumpedFor = started;
        var reader = _readThread();
        var sb = new StringBuilder($"API read stalled {(DateTime.UtcNow - started).TotalSeconds:0}s (hold {State}, last pulse {LastPulseUtc:HH:mm:ss}); stacks:");
        sb.Append("\n-- reader thread --\n").Append(Stack(reader));
        var bot = _botThread;
        if (bot != null && bot != reader) sb.Append("\n-- ROSBOT bot thread (last pulse) --\n").Append(Stack(bot));
        _log(sb.ToString());
    }

    private static string Stack(Thread thread)
    {
        if (thread == null || !thread.IsAlive) return "(gone)";
        if (thread == Thread.CurrentThread) return new StackTrace(false).ToString();
#pragma warning disable 618
        bool suspended = false;
        try
        {
            thread.Suspend();
            suspended = true;
            var trace = new StackTrace(thread, false);
            var sb = new StringBuilder();
            for (int i = 0; i < Math.Min(trace.FrameCount, MaxFrames); i++)
            {
                var m = trace.GetFrame(i)?.GetMethod();
                sb.Append("   at ").Append(m?.DeclaringType?.FullName ?? "?").Append('.').Append(m?.Name ?? "?").Append('\n');
            }
            return sb.ToString();
        }
        catch (Exception ex)
        {
            return "(stack unavailable: " + ex.GetType().Name + ": " + ex.Message + ")";
        }
        finally
        {
            if (suspended)
            {
                try { thread.Resume(); }
                catch (ThreadStateException) { }
            }
        }
#pragma warning restore 618
    }
}
