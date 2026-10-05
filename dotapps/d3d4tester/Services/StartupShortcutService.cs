// PY-REF: none (DOT-only; Python bound rosbot.startup but never applied it)
using System.IO;
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

    public static event Action? Changed;

    public static string? GetShortcutPath() => StartupShortcut.GetPath(AppConstants.AppDataDirName) is { } p ? Path.GetFullPath(p) : null;

    public static bool ShortcutExists() => StartupShortcut.Exists(AppConstants.AppDataDirName);

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

    private static string? ResolveExecutablePath()
    {
        string? path = Environment.ProcessPath;
        if (!string.Equals(Path.GetFileNameWithoutExtension(path), "dotnet", StringComparison.OrdinalIgnoreCase)) return path;
        return Path.Combine(AppContext.BaseDirectory, AppConstants.AppDataDirName + ".exe");
    }

    private static void Apply()
    {
        bool netHoldOnBoot = ConfigBinding.GetValue(ConfigKeys.BattlenetNetHoldEnabled, false) && ConfigBinding.GetValue(ConfigKeys.BattlenetNetHoldOnBoot, false);
        bool enabled = ConfigBinding.GetValue(ConfigKeys.RosbotStartup, false) || netHoldOnBoot;
        if (!enabled && !ShortcutExists()) return;
        bool ok = StartupShortcut.Set(AppConstants.AppDataDirName, enabled, ResolveExecutablePath());
        ColorPrinter.Blue($"{LogTag} startup on boot = {enabled} (network hold at boot = {netHoldOnBoot}, {(ok ? "applied" : "failed")}) {GetShortcutPath()}");
        Changed?.Invoke();
    }
}
