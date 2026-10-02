// PY-REF: pyapps/d3-check/main.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_manager.py
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// ROSBOT controller helpers: Battle.net flow hook installation, stop ROSBOT, resolve the ROSBOT exe. The B/D/E flow runs only
/// from RosbotTaskProcessor (TickDriver flow step: BN-only tick, flow master) and LoginTryController (D block).
/// </summary>
public static class RosbotFlowController
{
    private static readonly object HooksLock = new();
    private static bool _hooksInstalled;

    static RosbotFlowController()
    {
        InstallHooks();
    }

    /// <summary>Set the UI-thread presenter for the credentials dialog (MainWindow OnLoaded); also installs the Battle.net flow hooks.</summary>
    public static void SetShowCredentialsDialogAndWait(Func<string, bool>? showAndWait)
    {
        AsiaCredentialsService.SetDialogPresenter(showAndWait);
        InstallHooks();
    }

    /// <summary>Wire Core Battle.net flow hooks to app services (config, credentials dialog, OAuth bridge, event hub, status provider). Idempotent.</summary>
    public static void InstallHooks()
    {
        lock (HooksLock)
        {
            if (_hooksInstalled) return;
            _hooksInstalled = true;
        }
        BattlenetFlowHooks.RegionCacheProvider = () => ConfigOptionsProvider.GetOptions<RosSettingsOptions>().BattlenetRegionCache;
        BattlenetFlowHooks.GetAsiaCredentials = () => AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia) is { } c ? (c.email, c.password) : null;
        BattlenetFlowHooks.CredentialsDialogPending = () => AsiaCredentialsService.IsDialogPending;
        BattlenetFlowHooks.ScheduleCredentialsDialog = () => AsiaCredentialsService.ScheduleCredentialsDialog(AsiaCredentialsService.RegionAsia);
        BattlenetFlowHooks.GetLoginCredentials = region => AsiaCredentialsService.GetCredentials(region) is { } c ? (c.email, c.password) : null;
        BattlenetFlowHooks.ScheduleLoginCredentialsDialog = region => AsiaCredentialsService.ScheduleCredentialsDialog(region);
        BattlenetFlowHooks.ResetOauthDone = OAuthCallbackState.ResetOauthDone;
        BattlenetFlowHooks.NotifyOauthDone = OAuthCallbackState.NotifyOauthDone;
        BattlenetFlowHooks.TriggerExtensionRosbotStart = EventCenter.TriggerExtensionRosbotStart;
        BattlenetFlowHooks.RefreshBattlenetStatus = () => BattlenetStatusProvider.Refresh().Changed;
        BattlenetFlowHooks.NotifyStateSync = GameInterfaceData.Instance.NotifyCallbacks;
        ShutdownManager.RegisterShutdownHook(BattlenetReadyFlow.ResetFlowMasterBnBlock);
    }

    /// <summary>Kill ROSBOT main + same-dir exes by PID (renamed copies included), then invalidate the lookup cache. 1:1 Python get_rosbot_manager().kill_if_running.</summary>
    public static bool StopRosbot()
    {
        bool ok = RosbotManager.Instance.KillIfRunning();
        RosbotDetection.InvalidateCache();
        return ok;
    }

    /// <summary>Resolve ROSBOT exe path from directory (or return path if already exe): exact rosbot_exe_name, then ROSBOT exe patterns. 1:1 Python find_rosbot_exe.</summary>
    public static string? ResolveRosbotExe(string rosDirectory)
    {
        if (string.IsNullOrWhiteSpace(rosDirectory)) return null;
        if (File.Exists(rosDirectory) && rosDirectory.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return rosDirectory;
        return RosbotManager.Instance.FindRosbotExe();
    }
}
