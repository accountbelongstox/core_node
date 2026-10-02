using DotApps.d3d4tester.Core;

namespace DotApps.d3d4tester.Services;

/// <summary>Kill D3 (by PID of its windows) and ROSBOT (main + same-dir exes by PID). 1:1 Python get_d3_manager().kill_if_running + get_rosbot_manager().kill_if_running (log analyzer system error).</summary>
public static class D3AndRosbotKillHelper
{
    public static void KillD3IfRunning() => D3Manager.Instance.KillIfRunning();

    public static void KillD3AndRosbotIfRunning()
    {
        KillD3IfRunning();
        RosbotManager.Instance.KillIfRunning();
        RosbotManager.Instance.InvalidateLookupCache();
    }
}
