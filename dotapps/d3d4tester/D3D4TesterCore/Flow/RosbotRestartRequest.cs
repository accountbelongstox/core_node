// PY-REF: none (DOT-only)
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Restarts outside the F3 timeout: a pending request (error popup, D3 memory limit, trigger action) is consumed by the flow master on
/// its next tick and runs the same F4 -> B2 restart as a log disconnect (restartBattlenet is passed to the handler). Every F4 -> B2
/// restart, including F3 timeouts and log disconnects, raises <see cref="Executed"/> synchronously before D3 is closed.
/// </summary>
public static class RosbotRestartRequest
{
    public const string ReasonLogTimeout = "log_timeout";
    public const string ReasonLogDisconnect = "log_disconnect";
    public const string ReasonLogSystemError = "log_system_error";

    private static readonly object Lock = new();
    private static string? _reasonId;
    private static string _detail = "";
    private static bool _restartBattlenet;

    /// <summary>(reasonId, detail, restartBattlenet requested) of a restart that is about to run (D3 still open). Handlers run on the tick thread.</summary>
    public static event Action<string, string, bool>? Executed;

    public static bool IsPending
    {
        get { lock (Lock) return _reasonId != null; }
    }

    /// <summary>Queue a restart (a newer request keeps the first reason and ORs the Battle.net flag).</summary>
    public static void Request(string reasonId, string detail, bool restartBattlenet)
    {
        lock (Lock)
        {
            if (_reasonId == null)
            {
                _reasonId = reasonId;
                _detail = detail;
            }
            _restartBattlenet |= restartBattlenet;
        }
    }

    public static bool TryConsume(out string reasonId, out string detail, out bool restartBattlenet)
    {
        lock (Lock)
        {
            reasonId = _reasonId ?? "";
            detail = _detail;
            restartBattlenet = _restartBattlenet;
            if (_reasonId == null) return false;
            _reasonId = null;
            _detail = "";
            _restartBattlenet = false;
            return true;
        }
    }

    public static void Clear()
    {
        lock (Lock)
        {
            _reasonId = null;
            _detail = "";
            _restartBattlenet = false;
        }
    }

    /// <summary>Called by the flow master right before F4.</summary>
    public static void NotifyExecuted(string reasonId, string detail, bool restartBattlenet)
    {
        try { Executed?.Invoke(reasonId, detail, restartBattlenet); }
        catch (Exception ex) { ColorPrinter.Red($"[RestartRequest] Executed handler: {ex.Message}"); }
    }
}
