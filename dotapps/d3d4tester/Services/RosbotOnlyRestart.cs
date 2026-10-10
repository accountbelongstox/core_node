// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// The one "restart ROSBOT only" path (license key switch, bridge plugin reload / update): the running flow (not paused) restarts it in
/// its E block; otherwise ROSBOT is closed (F7, leftovers killed) and started again under the GameControl lease. RosbotManager.Start runs
/// its before-start hooks (license key, plugin install). D3 is never touched; a missing D3 is the flow's [F1] job. While control is taken
/// the pause guard pauses the new ROSBOT once it bots.
/// </summary>
public static class RosbotOnlyRestart
{
    private const string LogTag = "[RosbotRestart]";
    private const string Lease = "restart ROSBOT only";
    private const int LeaseWaitMs = 20000;
    private static int _running;

    /// <summary>A restart is under way (started here and not finished).</summary>
    public static bool IsRunning => Volatile.Read(ref _running) == 1;

    /// <summary>Start a ROSBOT-only restart in the background; false when one already runs.</summary>
    public static bool Restart(string reason)
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return false;
        Task.Run(() =>
        {
            try
            {
                if (RosbotFlowRunner.IsRunning && !RosbotFlowRunner.IsPaused)
                {
                    ColorPrinter.Blue($"{LogTag} {reason} -> flow restarts ROSBOT only");
                    F3MonitorProcess.RequestRosbotRestart();
                    return;
                }
                ColorPrinter.Blue($"{LogTag} {reason} -> close ROSBOT and start it again (D3 kept)");
                using var lease = GameControl.TryAcquire(Lease, LeaseWaitMs);
                var rosbot = RosbotManager.Instance;
                rosbot.CloseGracefully();
                rosbot.InvalidateLookupCache();
                if (!rosbot.Start(autostart: true)) ColorPrinter.Yellow($"{LogTag} ROSBOT start failed ({reason})");
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} {reason}: {ex.Message}");
            }
            finally
            {
                Interlocked.Exchange(ref _running, 0);
            }
        });
        return true;
    }
}
