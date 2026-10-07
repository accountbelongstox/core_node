// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_e_rosbot_run.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f2_rosbot_online.py
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// E block: ROSBOT run flow E1 kill -> E2 wait 1 s -> E3 optional zip update (E3a-E3f) + auto_start_rosbot check -> E4 start
/// (F3 baseline) -> E5 task init -> E5a wait window / server / poll UI / main profile + Start botting -> E6. Runs on the flow thread;
/// Stop monitoring (the flow context) aborts it between steps and inside the E5a waits.
/// 1:1 Python d3utils/rosbot_flow/flow_e_rosbot_run.py + rosbot_flow_f2_rosbot_online.py.
/// </summary>
public static class RosbotRunFlow
{
    private const double E2WaitSec = 1.0;
    private const int E5aWaitSec = 30;

    /// <summary>[F2] ROSBOT online? Refresh, then running|paused. 1:1 Python run_f2_rosbot_online.</summary>
    public static bool RunF2RosbotOnline()
    {
        RosbotStatusProvider.Refresh();
        return RosbotDetection.IsOnline(GameInterfaceData.Instance.GetStateSnapshot().RosbotExtendedStatus);
    }

    /// <summary>[E3] Start ROSBOT? (ros_settings.auto_start_rosbot, default true).</summary>
    private static bool RunE3ConfigCheck() => ConfigBinding.GetValue(ConfigKeys.RosSettingsAutoStartRosbot, true);

    /// <summary>[E3a-E3f] When auto_enable_latest_ros: find a newer zip and apply it (no confirm on the flow). Returns proceed to E4.</summary>
    private static bool RunE3UpdateFlow()
    {
        if (!ConfigBinding.GetValue(ConfigKeys.RosSettingsAutoEnableLatestRos, true))
            return RunE3ConfigCheck();
        var mgr = RosbotUpdateManager.Instance;
        var (zipPath, isNewer, versionStr, region) = mgr.CheckUpdate();
        if (!isNewer || string.IsNullOrEmpty(zipPath) || string.IsNullOrEmpty(region))
            return RunE3ConfigCheck();
        ColorPrinter.Blue("[E3] E3c-E3e apply update: extract, copy RoS-BoT.ini, update ros_directory");
        if (!mgr.ApplyUpdate(zipPath, region, versionStr))
        {
            ColorPrinter.Yellow("[E3] apply_rosbot_update failed, proceed to E4 with current path");
            return RunE3ConfigCheck();
        }
        RosbotManager.Instance.InvalidateLookupCache();
        ColorPrinter.Green("[E3] E3f update applied, ros_directory refreshed");
        return RunE3ConfigCheck();
    }

    /// <summary>[E4] Start the ROSBOT process; on success set the F3 baseline.</summary>
    private static bool RunE4Start()
    {
        if (GameInterfaceData.Instance.GetStateSnapshot().BattlenetWakingUp)
        {
            ColorPrinter.Yellow("[E4] Battle.net is waking up (sleep / fetching account), skip ROSBOT start this round");
            return false;
        }
        bool ok = RosbotManager.Instance.Start();
        if (ok)
            F3LogTimeout.SetRosbotStartedAt();
        return ok;
    }

    /// <summary>E1..E6 in order (E4/E5 only when E3 says proceed). startRosbotTask = [E5] task init. True when E4 started ROSBOT.</summary>
    public static bool RunEBlock(FlowContext ctx, Action startRosbotTask)
    {
        RosbotManager.Instance.KillIfRunning();
        ctx.Wait(E2WaitSec);
        if (!RunE3UpdateFlow())
        {
            ColorPrinter.Gray("[E3] auto_start_rosbot is off, ROSBOT not started");
            return false;
        }
        ctx.ThrowIfStopped();
        if (!RunE4Start()) return false;
        ctx.ThrowIfStopped();
        startRosbotTask();
        RosbotStatusProvider.GetRosbotOperation().RunAfterRosbotStart(waitSec: E5aWaitSec, doDebug: true, doTab: true, doStartBotting: true,
            shouldStop: () => ctx.IsStopped);
        return true;
    }
}
