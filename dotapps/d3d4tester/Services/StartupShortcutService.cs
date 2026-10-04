// PY-REF: none (DOT-only; Python bound rosbot.startup but never applied it)
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>"Startup on Boot" (rosbot.startup): keep a shortcut to this executable in the user's Startup folder in sync with the setting.</summary>
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
        if (keyPath == ConfigKeys.RosbotStartup) Apply();
    }

    private static void Apply()
    {
        bool enabled = ConfigBinding.GetValue(ConfigKeys.RosbotStartup, false);
        if (!enabled && !StartupShortcut.Exists(AppConstants.AppDataDirName)) return;
        bool ok = StartupShortcut.Set(AppConstants.AppDataDirName, enabled, Environment.ProcessPath);
        ColorPrinter.Blue($"{LogTag} startup on boot = {enabled} ({(ok ? "applied" : "failed")})");
    }
}
