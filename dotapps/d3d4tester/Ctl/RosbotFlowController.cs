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
/// ROSBOT controller helpers: Battle.net flow hook installation, stop ROSBOT, resolve the ROSBOT exe. The B/C/D/E flow runs only
/// in Core RosbotFlowRunner (monitoring) and BattlenetGuardRunner (Ensure Battle.net); LoginTryController runs B + D manually.
/// </summary>
public static class RosbotFlowController
{
    private static readonly object HooksLock = new();
    private static bool _hooksInstalled;

    static RosbotFlowController()
    {
        InstallHooks();
    }

    /// <summary>Set the presenter that shows the Battle.net tab accounts (MainWindow OnLoaded); also installs the Battle.net flow hooks.</summary>
    public static void SetCredentialsPromptPresenter(Action<string>? presenter)
    {
        AsiaCredentialsService.SetPromptPresenter(presenter);
        InstallHooks();
    }

    /// <summary>Wire Core Battle.net flow hooks to app services (config, credentials, accounts prompt). Idempotent.</summary>
    public static void InstallHooks()
    {
        lock (HooksLock)
        {
            if (_hooksInstalled) return;
            _hooksInstalled = true;
        }
        BattlenetFlowHooks.RegionCacheProvider = () => ConfigOptionsProvider.GetOptions<RosSettingsOptions>().BattlenetRegionCache;
        BattlenetFlowHooks.CredentialsPromptPending = () => AsiaCredentialsService.IsPromptPending;
        BattlenetFlowHooks.GetLoginCredentials = region => AsiaCredentialsService.GetCredentials(region) is { } c ? (c.email, c.password) : null;
        BattlenetFlowHooks.ScheduleLoginCredentialsPrompt = AsiaCredentialsService.ScheduleCredentialsPrompt;
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
