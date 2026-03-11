using System.Diagnostics;
using System.IO;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotCore.Foundations;

namespace DotApps.d3check.Ctl;

/// <summary>
/// E block: ROSBOT run flow (E1→E2→E3→E4→E5a→E6). 1:1 Python flow_e_rosbot_run + run_after_rosbot_start.
/// Called once from RosbotFlowController after B/D; event-driven, no tick. Class library detail for "启动 ROSBOT".
/// </summary>
public static class RosbotRunFlow
{
    /// <summary>Run E block: E1 kill → E2 sleep 1s → E3 optional zip update → E4 start process → E5a wait window + tab + Start botting → E6. Returns true if E4 started (or skipped by config).</summary>
    public static async Task<bool> RunEBlockAsync(string region)
    {
        ColorPrinter.Gray("[DEBUG][E] RunEBlockAsync entered, region=" + (region ?? "null") + ".");
        string? rosDir = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
        if (string.IsNullOrWhiteSpace(rosDir))
        {
            ColorPrinter.Gray("[DEBUG][E] ros_directory not set, returning false.");
            ColorPrinter.Yellow("[E] ros_directory not set.");
            return false;
        }
        ColorPrinter.Gray("[DEBUG][E] E1: StopRosbot.");
        // E1: kill existing ROSBOT. 1:1 Python run_e1_kill.
        RosbotFlowController.StopRosbot();

        // E2: sleep 1s. 1:1 Python run_e2_sleep(1.0).
        ColorPrinter.Gray("[DEBUG][E] E2: Delay 1000ms.");
        await Task.Delay(1000).ConfigureAwait(false);

        // E3: optional zip update when auto_enable_latest_ros. 1:1 Python run_e3_update_flow (E3a–E3f).
        bool autoEnableLatest = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().AutoEnableLatestRos;
        ColorPrinter.Gray($"[DEBUG][E] E3: auto_enable_latest_ros={autoEnableLatest}.");
        if (autoEnableLatest)
        {
            var (zipPath, isNewer, versionStr) = RosbotUpdateManager.Instance.GetBestNewerZip(region!);
            if (isNewer && !string.IsNullOrEmpty(zipPath))
            {
                ColorPrinter.Gray($"[DEBUG][E] E3: applying newer zip zipPath={(zipPath != null ? "set" : "null")} versionStr={versionStr ?? "null"}.");
                ColorPrinter.Blue("[E] E3: applying newer zip: " + zipPath);
                if (RosbotUpdateManager.Instance.ApplyUpdate(zipPath!, region!, versionStr))
                {
                    rosDir = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
                    if (string.IsNullOrWhiteSpace(rosDir)) rosDir = null;
                }
            }
        }

        string? rosExe = RosbotFlowController.ResolveRosbotExe(rosDir ?? "");
        ColorPrinter.Gray($"[DEBUG][E] E4: ResolveRosbotExe rosDir={rosDir} -> rosExe={(rosExe != null ? "set" : "null")}.");
        if (string.IsNullOrEmpty(rosExe))
        {
            ColorPrinter.Gray("[DEBUG][E] E4: ROSBOT exe not found, return false.");
            ColorPrinter.Yellow("[E] E4: ROSBOT exe not found in " + (rosDir ?? ""));
            return false;
        }

        // E4: start ROSBOT process. 1:1 Python run_e4_start.
        ColorPrinter.Gray("[DEBUG][E] E4: Process.Start " + rosExe);
        try
        {
            var si = new ProcessStartInfo
            {
                FileName = rosExe,
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(rosExe) ?? rosDir ?? ""
            };
            Process.Start(si);
            ColorPrinter.Gray("[DEBUG][E] E4: Process started successfully.");
            ColorPrinter.Green("[E] E4: ROSBOT started (region=" + region + ").");
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray("[DEBUG][E] E4: Process.Start exception " + ex.Message);
            ColorPrinter.Red("[E] E4: failed to start: " + ex.Message);
            return false;
        }

        // E5a: wait window, activate, server wait, poll main profile tab, then tab + Start botting. 1:1 Python run_e5a_wait_win_srv_poll_click(run_after_rosbot_start, wait_sec=30, do_tab=True, do_start_botting=True).
        ColorPrinter.Gray("[DEBUG][E] E5a: RunAfterRosbotStart(waitSec=30, doTab=true, doStartBotting=true).");
        bool e5aOk = RosbotStatusProvider.GetRosbotOperation().RunAfterRosbotStart(waitSec: 30, doDebug: true, doTab: true, doStartBotting: true);
        ColorPrinter.Gray($"[DEBUG][E] E5a: RunAfterRosbotStart returned e5aOk={e5aOk}.");
        if (!e5aOk)
            ColorPrinter.Yellow("[E] E5a: RunAfterRosbotStart did not complete (window/tab/Start botting).");

        // E6: no-op. 1:1 Python run_e6_done.
        ColorPrinter.Gray("[DEBUG][E] E6 done, returning true.");
        return true;
    }
}
