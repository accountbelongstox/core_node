// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core.Bridge;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Single arbiter for everything that drives D3 / ROSBOT by itself (flow steps, trigger actions, log handlers, town equip, follow town
/// portal, pause key). Gate: an automatic actor acts only while the user has not taken control (pause), and a monitoring-bound actor
/// only while monitoring runs. Lease: one game-input action at a time (keys, clicks, window focus, kills); reentrant on the holding
/// thread, so a leased step may call another leased step. An actor that cannot get the lease in its wait skips (or retries later).
/// </summary>
public static class GameControl
{
    private const string LogTag = "[GameControl]";
    private const int SkipLogIntervalSec = 30;

    private static readonly object LeaseLock = new();
    private static readonly Dictionary<string, DateTime> LastSkipLog = new(StringComparer.Ordinal);
    private static string? _holder;

    /// <summary>The user took control (pause): no automatic actor may touch the game or ROSBOT.</summary>
    public static bool UserHasControl => RosbotFlowState.Instance.Paused;

    /// <summary>Monitoring runs and the user has not taken control.</summary>
    public static bool MonitoringActive => RosbotFlowState.Instance.FlowMasterEnabled && !RosbotFlowState.Instance.Paused;

    /// <summary>The bridge plugin holds ROSBOT in town for the app's town work (equip): restarts and log watchdogs wait.</summary>
    public static bool TownHoldActive
    {
        get
        {
            var s = GameInterfaceData.Instance.GetStateSnapshot();
            return s.RosbotBridgeFresh && s.RosbotBridge is { TownHold: true };
        }
    }

    /// <summary>Current lease holder (for logs), null when free.</summary>
    public static string? Holder => _holder;

    /// <summary>Gate for an automatic actor; logs a skip at most every SkipLogIntervalSec per actor.</summary>
    public static bool Allowed(string actor, bool needsMonitoring)
    {
        string? reason = UserHasControl ? "control taken (paused)"
            : needsMonitoring && !RosbotFlowState.Instance.FlowMasterEnabled ? "monitoring off"
            : null;
        if (reason == null) return true;
        LogSkip(actor, reason);
        return false;
    }

    /// <summary>Exclusive game-input lease; null when another actor keeps it longer than waitMs. Dispose to release.</summary>
    public static IDisposable? TryAcquire(string actor, int waitMs = 0)
    {
        if (!System.Threading.Monitor.TryEnter(LeaseLock, waitMs))
        {
            LogSkip(actor, $"game input busy ({_holder})");
            return null;
        }
        string? previous = _holder;
        _holder = actor;
        return new Lease(previous);
    }

    private static void LogSkip(string actor, string reason)
    {
        var now = DateTime.UtcNow;
        lock (LastSkipLog)
        {
            if (LastSkipLog.TryGetValue(actor, out var last) && (now - last).TotalSeconds < SkipLogIntervalSec) return;
            LastSkipLog[actor] = now;
        }
        ColorPrinter.Gray($"{LogTag} {actor} skipped: {reason}");
    }

    private sealed class Lease : IDisposable
    {
        private readonly string? _previous;
        private bool _released;

        public Lease(string? previous) => _previous = previous;

        public void Dispose()
        {
            if (_released) return;
            _released = true;
            _holder = _previous;
            System.Threading.Monitor.Exit(LeaseLock);
        }
    }
}
