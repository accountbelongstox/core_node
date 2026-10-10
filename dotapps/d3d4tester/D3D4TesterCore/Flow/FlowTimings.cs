// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Timings of the sequential ROSBOT flow (runner, F3 monitor, Battle.net guard). B / C / D timings live with their constants.</summary>
public static class FlowTimings
{
    /// <summary>battlenet.battlenet_path missing: check again after this.</summary>
    public const double NoBattlenetPathRetrySec = 30.0;

    /// <summary>[D] launch failed: next attempt after this (Battle.net is never restarted for it).</summary>
    public const double D3LaunchRetrySec = 20.0;

    /// <summary>[F1] D3 process running without a visible window yet: wait this long for its window before treating D3 as missing.</summary>
    public const double D3WindowWaitSec = 60.0;

    /// <summary>[F1] status refresh interval while waiting for the D3 window.</summary>
    public const double D3WindowPollSec = 2.0;

    /// <summary>[E] ROSBOT start failed: next attempt after this.</summary>
    public const double RosbotStartRetrySec = 20.0;

    /// <summary>[F3] poll interval (log timeout, restart requests, log disconnect).</summary>
    public const double MonitorPollSec = 2.0;

    /// <summary>[F3] D3 + ROSBOT status refresh interval inside the monitor loop.</summary>
    public const double MonitorRefreshSec = 10.0;

    /// <summary>[F3] ROSBOT offline this long (D3 still running) -> leave F3, the next cycle runs C + E with D3 reused.</summary>
    public const double RosbotGoneGraceSec = 30.0;

    /// <summary>Battle.net guard: check interval while the guard is on.</summary>
    public const double GuardPollSec = 10.0;
}
