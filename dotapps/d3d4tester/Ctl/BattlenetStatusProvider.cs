// PY-REF: pyapps/d3-check/d3utils/battlenet_status_provider.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation.py
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>Battle.net main window found by the status provider.</summary>
public sealed record BattlenetWindowInfo(IntPtr Hwnd, string Title);

/// <summary>
/// Battle.net status provider: window detection and the probed client screen state (BattlenetClientStateDetector; the
/// on_login_screen / disconnected / normal_available triple derives from it) via the shared refresh flow; region resolved from
/// Battle.net.config, then ros_settings.battlenet_region_cache.
/// 1:1 Python d3utils/battlenet_status_provider.py.
/// </summary>
public static class BattlenetStatusProvider
{
    private const string LogPrefix = "[BattlenetStatusProvider]";
    private const string ProgressPrefix = "[BN]";
    private const int ConfigDumpMaxChars = 2000;

    /// <summary>
    /// Resolve the region (no UI): the user's global choice battlenet.region wins (Battle.net management tab); otherwise, when
    /// GameInterfaceData has none, Battle.net.config (CN -> cn, else asia) written to ros_settings.battlenet_region_cache, else
    /// the cache. 1:1 Python ensure_battlenet_region_from_config (+ DOT global choice).
    /// </summary>
    public static void EnsureBattlenetRegionFromConfig()
    {
        var game = GameInterfaceData.Instance;
        var chosen = ConfigBinding.GetValue(ConfigKeys.BattlenetRegion, "");
        if (chosen is AppConstants.RegionAsia or AppConstants.RegionCn)
        {
            if (game.GetStateSnapshot().BattlenetRegion != chosen) game.SetBattlenetRegion(chosen);
            return;
        }
        if (game.GetStateSnapshot().BattlenetRegion != null) return;
        var configRegion = ReadRegionFromBattlenetConfig();
        if (configRegion is AppConstants.RegionAsia or AppConstants.RegionCn)
        {
            game.SetBattlenetRegion(configRegion);
            D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, configRegion);
            D3D4TesterConfigService.Instance.QueueSave();
            return;
        }
        var cached = ConfigBinding.GetValue<string>(ConfigKeys.RosSettingsBattlenetRegionCache, "");
        if (cached is AppConstants.RegionAsia or AppConstants.RegionCn)
            game.SetBattlenetRegion(cached);
    }

    /// <summary>Resolved region (after EnsureBattlenetRegionFromConfig); null when unknown.</summary>
    public static string? GetRegion()
    {
        EnsureBattlenetRegionFromConfig();
        return GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;
    }

    /// <summary>Operation bound to the resolved region. 1:1 Python get_battlenet_operation().</summary>
    public static IBattlenetOperation GetOperation() => BattlenetOperationFactory.GetOperation(GetRegion());

    /// <summary>Immediate check: current Battle.net main window or null. 1:1 Python get_current_battlenet_window.</summary>
    public static BattlenetWindowInfo? GetCurrentWindow()
    {
        try
        {
            var w = BattlenetManager.Instance.FindBattlenetWindow();
            return w == null ? null : new BattlenetWindowInfo(w.Hwnd, w.Title ?? "");
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Detect window + dynamic state and update GameInterfaceData; returns the window or null. 1:1 Python refresh_battlenet_status.</summary>
    public static BattlenetWindowInfo? RefreshBattlenetStatus() => Refresh().Window;

    /// <summary>Returns (window or null, state_changed). 1:1 Python _refresh_battlenet_status_internal.</summary>
    public static (BattlenetWindowInfo? Window, bool Changed) Refresh()
    {
        var game = GameInterfaceData.Instance;
        var window = GetCurrentWindow();
        string winLabel = window != null ? "ok" : "no";
        var status = BattlenetClientStatus.None;
        bool changed = StatusProviderCommon.RefreshWindowState(
            window,
            setRunning: game.SetBattlenetWindowFound,
            setDynamic: (_, _, _) => game.SetBattlenetClientStatus(status),
            detectDynamic: (_, _) =>
            {
                status = BattlenetClientStateDetector.Detect();
                return status.DynamicTriple;
            },
            applyGeometry: null,
            logPrefix: LogPrefix,
            progressRefresh: step => ColorPrinter.GrayRefresh($"{ProgressPrefix} {winLabel} {step}"));
        return (window, changed);
    }

    /// <summary>Region from Battle.net.config; dumps the raw file as debug when LastLoginRegion is missing or invalid. 1:1 Python _read_region_from_battlenet_config.</summary>
    private static string? ReadRegionFromBattlenetConfig()
    {
        var path = BattlenetRegionDetection.GetDefaultConfigPath();
        if (!File.Exists(path))
        {
            ColorPrinter.Gray($"{LogPrefix} _read_region_from_battlenet_config: config missing path={path}");
            return null;
        }
        var region = BattlenetRegionDetection.DetectRegion(path);
        ColorPrinter.Gray($"{LogPrefix} _read_region_from_battlenet_config: LastLoginRegion -> {region ?? "None"}");
        if (region != null) return region;
        try
        {
            var raw = File.ReadAllText(path);
            ColorPrinter.Gray($"{LogPrefix} config file raw text (first {ConfigDumpMaxChars} chars):\n{(raw.Length > ConfigDumpMaxChars ? raw[..ConfigDumpMaxChars] : raw)}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogPrefix} _read_region_from_battlenet_config: read file error {ex.Message}");
        }
        return null;
    }
}
