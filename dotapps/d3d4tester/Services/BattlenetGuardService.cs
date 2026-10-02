// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Global Battle.net guard: applies the persisted switch battlenet.ensure_normal (default on) to the BN-only flow from startup,
/// so Battle.net is started, logged in and kept running (B block, web login automation, connecting watchdog), and applies the
/// global region battlenet.region. Re-applies on every change of either key (automation checkbox, Battle.net tab, Rosbot button).
/// </summary>
public static class BattlenetGuardService
{
    private const string LogTag = "[BNGuard]";
    private static int _initialized;

    public static bool IsEnabled => ConfigBinding.GetValue(ConfigKeys.BattlenetEnsureNormal, ConfigKeys.BattlenetEnsureNormalDefault);

    /// <summary>Apply now and follow config changes. Call once after the flow hooks are installed.</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        D3D4TesterConfigChangeHub.Notifier.Subscribe(OnConfigChanged);
        ApplyRegion();
        ApplyEnabled();
    }

    private static void OnConfigChanged(string? keyPath)
    {
        if (keyPath == ConfigKeys.BattlenetEnsureNormal) ApplyEnabled();
        else if (keyPath == ConfigKeys.BattlenetRegion) ApplyRegion();
    }

    private static void ApplyEnabled()
    {
        bool enabled = IsEnabled;
        ColorPrinter.Blue($"{LogTag} ensure Battle.net normal = {enabled}");
        RosbotTaskProcessor.Instance.SetEnsureBattlenetOnly(enabled);
        GameInterfaceData.Instance.NotifyCallbacks();
    }

    private static void ApplyRegion()
    {
        BattlenetStatusProvider.EnsureBattlenetRegionFromConfig();
        GameInterfaceData.Instance.NotifyCallbacks();
    }
}
