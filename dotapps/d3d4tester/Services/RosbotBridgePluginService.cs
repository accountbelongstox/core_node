// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>Area visit in the plugin's history.</summary>
public sealed record RosbotBridgeAreaVisit([property: JsonPropertyName("sno")] int Sno, [property: JsonPropertyName("utc")] DateTime Utc);

/// <summary>state.json written by the CoreNodeBridge ROSBOT plugin (field names fixed by tools/rosbot-plugin/CoreNodeBridge).</summary>
public sealed record RosbotBridgeState(
    [property: JsonPropertyName("updated_utc")] DateTime UpdatedUtc,
    [property: JsonPropertyName("plugin_version")] string PluginVersion,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("valid")] bool Valid,
    [property: JsonPropertyName("in_game")] bool InGame,
    [property: JsonPropertyName("level_area_sno")] int LevelAreaSno,
    [property: JsonPropertyName("level_area_since_utc")] DateTime LevelAreaSinceUtc,
    [property: JsonPropertyName("scene_sno")] int SceneSno,
    [property: JsonPropertyName("global_world_id")] int GlobalWorldId,
    [property: JsonPropertyName("world_id")] int WorldId,
    [property: JsonPropertyName("in_town")] bool InTown,
    [property: JsonPropertyName("in_rift")] bool InRift,
    [property: JsonPropertyName("greater_rift")] bool GreaterRift,
    [property: JsonPropertyName("nephalem_rift")] bool NephalemRift,
    [property: JsonPropertyName("greater_rift_level")] int GreaterRiftLevel,
    [property: JsonPropertyName("rift_keys")] int RiftKeys,
    [property: JsonPropertyName("blood_shards")] int BloodShards,
    [property: JsonPropertyName("paragon")] int Paragon,
    [property: JsonPropertyName("actor_class")] int ActorClass,
    [property: JsonPropertyName("health_pct")] double HealthPct,
    [property: JsonPropertyName("dead")] bool Dead,
    [property: JsonPropertyName("in_combat")] bool InCombat,
    [property: JsonPropertyName("inventory_full")] bool InventoryFull,
    [property: JsonPropertyName("sequence")] string Sequence,
    [property: JsonPropertyName("last_event")] string LastEvent,
    [property: JsonPropertyName("level_area_history")] IReadOnlyList<RosbotBridgeAreaVisit>? LevelAreaHistory)
{
    public bool IsStale(DateTime nowUtc) => (nowUtc - UpdatedUtc).TotalSeconds > RosbotPluginConstants.BridgeStaleSec;
}

public enum RosbotBridgeInstallResult { Installed, UpToDate, NoRosbot, NoBundle, Locked, Failed }

/// <summary>Installed vs bundled plugin for the current ROSBOT.</summary>
public sealed record RosbotBridgePluginInfo(string? RosDirectory, string? InstalledPath, string? InstalledVersion, string? BundledVersion, bool UpToDate);

/// <summary>
/// This app's ROSBOT plugin (CoreNodeBridge): install / refresh it in &lt;ROSBOT&gt;\plugins\CoreNodeBridge (idempotent, by
/// content hash; also automatically on startup and whenever ros_settings.ros_directory changes, unless switched off), read the
/// state.json it writes, and keep user names for level-area SNO ids (rosbot_area_names.json in the user data dir).
/// ROSBOT loads plugins at its start, so a refreshed DLL is used after the next ROSBOT start; enable it once in ROSBOT's plugin list.
/// </summary>
public static class RosbotBridgePluginService
{
    private const string LogTag = "[RosbotBridge]";
    private static readonly JsonSerializerOptions ReadOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true };
    private static readonly object NamesLock = new();
    private static Dictionary<int, string>? _areaNames;
    private static int _initialized;

    public static string BundledDllPath => Path.Combine(AppContext.BaseDirectory, RosbotPluginConstants.BridgeBundledDir, RosbotPluginConstants.BridgeDllName);

    public static string? RosDirectory =>
        ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") is { Length: > 0 } d && Directory.Exists(d) ? d : null;

    public static string? InstalledDir => RosDirectory is { } d ? Path.Combine(d, RosbotPluginConstants.PluginsDirName, RosbotPluginConstants.BridgeDirName) : null;

    public static string? StatePath => InstalledDir is { } d ? Path.Combine(d, RosbotPluginConstants.BridgeStateFileName) : null;

    public static bool AutoInstall => ConfigBinding.GetValue(ConfigKeys.RosbotBridgePluginAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstallDefault);

    /// <summary>Auto-install now and on every ROSBOT path / switch change (call once at startup).</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        D3D4TesterConfigChangeHub.Notifier.Subscribe(key =>
        {
            if (key is ConfigKeys.RosSettingsRosDirectory or ConfigKeys.RosbotBridgePluginAutoInstall) _ = Task.Run(AutoInstallIfEnabled);
        });
        _ = Task.Run(AutoInstallIfEnabled);
    }

    private static void AutoInstallIfEnabled()
    {
        if (AutoInstall) Install();
    }

    public static RosbotBridgePluginInfo GetInfo()
    {
        string? dir = InstalledDir;
        string? installed = dir == null ? null : Path.Combine(dir, RosbotPluginConstants.BridgeDllName);
        if (installed != null && !File.Exists(installed)) installed = null;
        string? bundledVersion = File.Exists(BundledDllPath) ? FileVersionInfo.GetVersionInfo(BundledDllPath).FileVersion : null;
        string? installedVersion = installed != null ? FileVersionInfo.GetVersionInfo(installed).FileVersion : null;
        bool upToDate = installed != null && File.Exists(BundledDllPath) && SameContent(installed, BundledDllPath);
        return new RosbotBridgePluginInfo(RosDirectory, installed, installedVersion, bundledVersion, upToDate);
    }

    /// <summary>Copy the bundled DLL into the current ROSBOT when missing or different; Locked while ROSBOT holds the old one.</summary>
    public static RosbotBridgeInstallResult Install()
    {
        string? dir = InstalledDir;
        if (dir == null) return RosbotBridgeInstallResult.NoRosbot;
        if (!File.Exists(BundledDllPath))
        {
            ColorPrinter.Yellow($"{LogTag} bundled plugin missing: {BundledDllPath}");
            return RosbotBridgeInstallResult.NoBundle;
        }
        string target = Path.Combine(dir, RosbotPluginConstants.BridgeDllName);
        try
        {
            if (File.Exists(target) && SameContent(target, BundledDllPath)) return RosbotBridgeInstallResult.UpToDate;
            Directory.CreateDirectory(dir);
            File.Copy(BundledDllPath, target, true);
            ColorPrinter.Green($"{LogTag} plugin installed: {target}");
            return RosbotBridgeInstallResult.Installed;
        }
        catch (IOException ex) when (File.Exists(target))
        {
            ColorPrinter.Yellow($"{LogTag} plugin in use by ROSBOT, not replaced (stop ROSBOT and install again): {ex.Message}");
            return RosbotBridgeInstallResult.Locked;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Red($"{LogTag} plugin install failed: {ex.Message}");
            return RosbotBridgeInstallResult.Failed;
        }
    }

    /// <summary>Latest state written by the plugin, or null when there is none (or it cannot be read right now).</summary>
    public static RosbotBridgeState? ReadState()
    {
        string? path = StatePath;
        if (path == null || !File.Exists(path)) return null;
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            return JsonSerializer.Deserialize<RosbotBridgeState>(stream, ReadOptions);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return null;
        }
    }

    public static string? GetAreaName(int sno)
    {
        lock (NamesLock) return LoadNames().TryGetValue(sno, out var name) ? name : null;
    }

    /// <summary>Name a level-area SNO id (empty name removes it).</summary>
    public static void SetAreaName(int sno, string? name)
    {
        lock (NamesLock)
        {
            var names = LoadNames();
            if (string.IsNullOrWhiteSpace(name)) names.Remove(sno);
            else names[sno] = name.Trim();
            try
            {
                Directory.CreateDirectory(ConfigPaths.CurrentUserDataPath);
                File.WriteAllText(AreaNamesPath, JsonSerializer.Serialize(names.ToDictionary(kv => kv.Key.ToString(), kv => kv.Value), WriteOptions));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                ColorPrinter.Yellow($"{LogTag} area names not saved: {ex.Message}");
            }
        }
    }

    private static string AreaNamesPath => Path.Combine(ConfigPaths.CurrentUserDataPath, RosbotPluginConstants.BridgeAreaNamesFileName);

    private static Dictionary<int, string> LoadNames()
    {
        if (_areaNames != null) return _areaNames;
        _areaNames = new Dictionary<int, string>();
        try
        {
            if (File.Exists(AreaNamesPath)
                && JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(AreaNamesPath)) is { } raw)
                foreach (var (k, v) in raw)
                    if (int.TryParse(k, out int sno)) _areaNames[sno] = v;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            ColorPrinter.Yellow($"{LogTag} area names not loaded: {ex.Message}");
        }
        return _areaNames;
    }

    private static bool SameContent(string a, string b)
    {
        if (new FileInfo(a).Length != new FileInfo(b).Length) return false;
        using var sa = File.OpenRead(a);
        using var sb = File.OpenRead(b);
        return SHA256.HashData(sa).AsSpan().SequenceEqual(SHA256.HashData(sb));
    }
}
