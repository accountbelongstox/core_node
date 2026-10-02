// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_e_rosbot_run.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f2_rosbot_online.py
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// E block: ROSBOT run flow E1 kill -> E2 sleep 1 s -> E3 optional zip update (E3a-E3f) + auto_start_rosbot check -> E4 start
/// (F3 baseline) -> E5 task init -> E5a wait window / server / poll UI / main profile + Start botting -> E6. Runs on the
/// extension worker (blocking). 1:1 Python d3utils/rosbot_flow/flow_e_rosbot_run.py + rosbot_flow_f2_rosbot_online.py.
/// </summary>
public static class RosbotRunFlow
{
    private const int E2SleepMs = 1000;
    private const int E5aWaitSec = 30;

    /// <summary>[F2] ROSBOT online? Refresh, then running|paused -> F3 (true); else C1 -> E1..E6 (false). 1:1 Python run_f2_rosbot_online.</summary>
    public static bool RunF2RosbotOnline()
    {
        RosbotStatusProvider.Refresh();
        return RosbotDetection.IsOnline(GameInterfaceData.Instance.GetStateSnapshot().RosbotExtendedStatus);
    }

    /// <summary>[E1] Kill existing ROSBOT (main + same-dir exes by PID).</summary>
    public static void RunE1Kill() => RosbotManager.Instance.KillIfRunning();

    /// <summary>[E2] Short sleep for process/UI stability (extension worker only).</summary>
    public static void RunE2Sleep(int milliseconds = E2SleepMs) => Thread.Sleep(milliseconds);

    /// <summary>[E3] Start ROSBOT? (ros_settings.auto_start_rosbot, default true).</summary>
    public static bool RunE3ConfigCheck() => ConfigBinding.GetValue(ConfigKeys.RosSettingsAutoStartRosbot, true);

    /// <summary>
    /// [E3a-E3f] When auto_enable_latest_ros: find newer zip, optional confirm, apply. Returns (proceed to E4, did update).
    /// askConfirm(zipPath, versionStr, region) false skips the update; null applies without confirm (extension worker).
    /// </summary>
    public static (bool Proceed, bool DidUpdate) RunE3UpdateFlow(Func<string, string, string, bool>? askConfirm = null)
    {
        if (!ConfigBinding.GetValue(ConfigKeys.RosSettingsAutoEnableLatestRos, true))
            return (RunE3ConfigCheck(), false);
        var mgr = RosbotUpdateManager.Instance;
        var (zipPath, isNewer, versionStr, region) = mgr.CheckUpdate();
        if (!isNewer || string.IsNullOrEmpty(zipPath) || string.IsNullOrEmpty(region))
            return (RunE3ConfigCheck(), false);
        if (askConfirm != null && !askConfirm(zipPath, versionStr ?? "", region))
        {
            ColorPrinter.Gray("[E3] User skipped update, proceed to E4 with current path");
            return (RunE3ConfigCheck(), false);
        }
        ColorPrinter.Blue("[E3] E3c-E3e apply update: extract, copy RoS-BoT.ini, update ros_directory");
        if (!mgr.ApplyUpdate(zipPath, region, versionStr))
        {
            ColorPrinter.Yellow("[E3] apply_rosbot_update failed, proceed to E4 with current path");
            return (RunE3ConfigCheck(), false);
        }
        RosbotManager.Instance.InvalidateLookupCache();
        ColorPrinter.Green("[E3] E3f update applied, ros_directory refreshed");
        return (RunE3ConfigCheck(), true);
    }

    /// <summary>[E4] Start the ROSBOT process; on success set the F3 baseline.</summary>
    public static bool RunE4Start()
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

    /// <summary>[E5a1-E5a5] Wait window, wait server, poll UI, click main profile, click Start botting.</summary>
    public static bool RunE5aWaitWinSrvPollClick() =>
        RosbotStatusProvider.GetRosbotOperation().RunAfterRosbotStart(waitSec: E5aWaitSec, doDebug: true, doTab: true, doStartBotting: true);

    /// <summary>E1..E6 in order (E4/E5 only when E3 says proceed). startRosbotTask = [E5] task init.</summary>
    public static void RunEBlock(Action? startRosbotTask, Func<string, string, string, bool>? askConfirm = null)
    {
        RunE1Kill();
        RunE2Sleep();
        var (proceed, _) = RunE3UpdateFlow(askConfirm);
        if (proceed && RunE4Start())
        {
            startRosbotTask?.Invoke();
            RunE5aWaitWinSrvPollClick();
        }
    }
}
