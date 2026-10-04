// PY-REF: none (DOT-only; Python bound rosbot.pickup_blood_shards / rosbot.blue_portal_priority but never applied them)
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Writes the ROSBOT page options into the ROSBOT plugin configs (plugins read them when ROSBOT starts):
/// rosbot.pickup_blood_shards -> ExtPickup extpick.cfg (pick up the shard items after the boss / gem upgrade when only primals are picked);
/// rosbot.blue_portal_priority on -> BlackWhiteGay rsttcp.cfg enableBlue=False (no connection reset at the end of a blue rift, so materials are picked first).
/// Missing plugin folders are skipped; other keys in rsttcp.cfg are kept.
/// </summary>
public static class RosbotPluginConfigSync
{
    private const string LogTag = "[RosbotPlugins]";
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
        if (keyPath is ConfigKeys.RosbotPickupBloodShards or ConfigKeys.RosbotBluePortalPriority or ConfigKeys.RosSettingsRosDirectory)
            Apply();
    }

    private static void Apply()
    {
        var rosDir = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        if (string.IsNullOrWhiteSpace(rosDir) || !Directory.Exists(rosDir)) return;
        string pluginsDir = Path.Combine(rosDir, RosbotPluginConstants.PluginsDirName);
        try
        {
            ApplyExtPickup(pluginsDir, ConfigBinding.GetValue(ConfigKeys.RosbotPickupBloodShards, false));
            if (ConfigBinding.GetValue(ConfigKeys.RosbotBluePortalPriority, false))
                ApplyBlueFastExitOff(pluginsDir);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogTag} {ex.Message}");
        }
    }

    private static void ApplyExtPickup(string pluginsDir, bool enabled)
    {
        string dir = Path.Combine(pluginsDir, RosbotPluginConstants.ExtPickupDirName);
        if (!Directory.Exists(dir)) return;
        string path = Path.Combine(dir, RosbotPluginConstants.ExtPickupConfigFileName);
        string line = RosbotPluginConstants.ExtPickupKey + "=" + (enabled ? string.Join(",", RosbotPluginConstants.ExtPickupItems) : "");
        if (File.Exists(path) && File.ReadAllLines(path).SequenceEqual(new[] { line })) return;
        File.WriteAllLines(path, new[] { line });
        ColorPrinter.Blue($"{LogTag} {RosbotPluginConstants.ExtPickupConfigFileName}: pickup {(enabled ? "on" : "off")} (applies on next ROSBOT start)");
    }

    private static void ApplyBlueFastExitOff(string pluginsDir)
    {
        string dir = Path.Combine(pluginsDir, RosbotPluginConstants.FastExitDirName);
        if (!Directory.Exists(dir)) return;
        string path = Path.Combine(dir, RosbotPluginConstants.FastExitConfigFileName);
        string wanted = RosbotPluginConstants.FastExitEnableBlueKey + "=" + bool.FalseString;
        var lines = File.Exists(path) ? File.ReadAllLines(path).ToList() : new List<string>();
        int idx = lines.FindIndex(l => l.Split('=', 2)[0].Trim().Equals(RosbotPluginConstants.FastExitEnableBlueKey, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0 && lines[idx].Trim() == wanted) return;
        if (idx >= 0) lines[idx] = wanted;
        else lines.Add(wanted);
        File.WriteAllLines(path, lines);
        ColorPrinter.Blue($"{LogTag} {RosbotPluginConstants.FastExitConfigFileName}: blue rift fast exit off (applies on next ROSBOT start)");
    }
}
