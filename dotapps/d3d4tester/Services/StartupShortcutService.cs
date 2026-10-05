// PY-REF: none (DOT-only; Python bound rosbot.startup but never applied it)
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Start on logon: one shortcut to this executable in the user's Startup folder, kept in sync (idempotent) with
/// "Startup on Boot" (rosbot.startup) or the network hold started at boot (battlenet.net_hold_enabled + net_hold_on_boot).
/// </summary>
public static class StartupShortcutService
{
    private const string LogTag = "[Startup]";
    private static int _initialized;

    /// <summary>Apply now and follow config changes (call once at startup).</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        D3D4TesterConfigChangeHub.Notifier.Subscribe(OnConfigChanged);
        Apply();
    }

    private static void OnConfigChanged(string? keyPath)
    {
        if (keyPath is ConfigKeys.RosbotStartup or ConfigKeys.BattlenetNetHoldEnabled or ConfigKeys.BattlenetNetHoldOnBoot) Apply();
    }

    private static void Apply()
    {
        bool netHoldOnBoot = ConfigBinding.GetValue(ConfigKeys.BattlenetNetHoldEnabled, false) && ConfigBinding.GetValue(ConfigKeys.BattlenetNetHoldOnBoot, false);
        bool enabled = ConfigBinding.GetValue(ConfigKeys.RosbotStartup, false) || netHoldOnBoot;
        if (!enabled && !StartupShortcut.Exists(AppConstants.AppDataDirName)) return;
        bool ok = StartupShortcut.Set(AppConstants.AppDataDirName, enabled, Environment.ProcessPath);
        ColorPrinter.Blue($"{LogTag} startup on boot = {enabled} (network hold at boot = {netHoldOnBoot}, {(ok ? "applied" : "failed")})");
    }
}
