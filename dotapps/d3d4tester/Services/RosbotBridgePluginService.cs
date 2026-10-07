// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bridge;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

public enum RosbotBridgeInstallResult { Installed, UpToDate, NoRosbot, NoBundle, Locked, Failed }

/// <summary>Installed vs bundled plugin for the current ROSBOT.</summary>
public sealed record RosbotBridgePluginInfo(string? RosDirectory, string? InstalledPath, string? InstalledVersion, string? BundledVersion, bool UpToDate);

/// <summary>
/// This app's ROSBOT plugin (CoreNodeBridge): install / refresh it in &lt;ROSBOT&gt;\plugins\CoreNodeBridge (idempotent, by
/// content hash; also automatically on startup and whenever ros_settings.ros_directory changes, unless switched off), publish the
/// state.json it writes into GameInterfaceData once per second (TickDriver; the single source for the bottom bar, the bridge panel
/// and the planner), and keep user names for level-area SNO ids (rosbot_area_names.json in the user data dir).
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

    public static bool IsInstalled => InstalledDir is { } d && File.Exists(Path.Combine(d, RosbotPluginConstants.BridgeDllName));

    /// <summary>True while a ROSBOT process runs (it loads plugins at its start).</summary>
    public static bool IsRosbotRunning
    {
        get
        {
            var processes = Process.GetProcessesByName(RosbotPluginConstants.RosbotProcessName);
            foreach (var process in processes) process.Dispose();
            return processes.Length > 0;
        }
    }

    public static bool AutoInstall => ConfigBinding.GetValue(ConfigKeys.RosbotBridgePluginAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstallDefault);

    /// <summary>Auto-install now and on every ROSBOT path / switch change, and publish the plugin state every tick (call once at startup).</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(_ => PublishState());
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

    /// <summary>Read state.json into GameInterfaceData; notify the UI when the state or its freshness changed.</summary>
    private static void PublishState()
    {
        var game = GameInterfaceData.Instance;
        if (game.SetRosbotBridgeState(ReadState(), DateTime.UtcNow))
            game.NotifyCallbacks();
    }

    /// <summary>Latest state written by the plugin, or null when there is none (or it cannot be read right now).</summary>
    private static RosbotBridgeState? ReadState()
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

    /// <summary>
    /// Queue a command for the plugin (command.txt, consumed on ROSBOT's next pulse; the result appears as last_command in
    /// state.json). Returns the command id, or null when ROSBOT's plugin folder is missing. Logged in the app log.
    /// </summary>
    public static long? SendCommand(string action, string? target = null, bool? mode = null, bool? click = null, string? uiId = null, string? value = null)
    {
        if (InstalledDir is not { } dir || !Directory.Exists(dir)) return null;
        long id = DateTime.UtcNow.Ticks;
        var lines = new List<string> { $"{CommandKeyId}={id}", $"{CommandKeyAction}={action}" };
        if (!string.IsNullOrWhiteSpace(target)) lines.Add($"{CommandKeyTarget}={target.Trim()}");
        if (mode != null) lines.Add($"{CommandKeyMode}={mode.Value}");
        if (click != null) lines.Add($"{CommandKeyClick}={click.Value}");
        if (!string.IsNullOrWhiteSpace(uiId)) lines.Add($"{CommandKeyUiId}={uiId.Trim()}");
        if (!string.IsNullOrWhiteSpace(value)) lines.Add($"{CommandKeyValue}={value.Trim()}");
        if (!WriteAtomic(Path.Combine(dir, RosbotPluginConstants.BridgeCommandFileName), lines)) return null;
        ColorPrinter.Blue($"{LogTag} command {id} {action} target='{target}' mode={mode} click={click} ui={uiId}");
        return id;
    }

    /// <summary>Write the pickup filter for the plugin (pickup_filter.txt: auto line + one name fragment per line).</summary>
    public static bool SavePickupFilter(bool autoAtRiftEnd, IEnumerable<string> patterns)
    {
        if (InstalledDir is not { } dir || !Directory.Exists(dir)) return false;
        var lines = new List<string> { $"{FilterKeyAuto}={autoAtRiftEnd}" };
        lines.AddRange(patterns.Select(p => p.Trim()).Where(p => p.Length > 0 && !p.Contains('=')));
        bool ok = WriteAtomic(Path.Combine(dir, RosbotPluginConstants.BridgeFilterFileName), lines);
        ColorPrinter.Blue($"{LogTag} pickup filter saved: auto={autoAtRiftEnd} patterns={string.Join(", ", lines.Skip(1))}");
        return ok;
    }

    /// <summary>Write the plugin's item watch (lines "g|gbid", "n|name", "a|key|attribute|parameter|f or i"); false without the plugin folder.</summary>
    public static bool SaveItemWatch(IEnumerable<string> lines)
    {
        if (InstalledDir is not { } dir || !Directory.Exists(dir)) return false;
        return WriteAtomic(Path.Combine(dir, RosbotPluginConstants.BridgeItemWatchFileName), lines);
    }

    /// <summary>Pickup filter currently stored in ROSBOT's plugin folder: (auto, patterns).</summary>
    public static (bool Auto, IReadOnlyList<string> Patterns) LoadPickupFilter()
    {
        string? path = InstalledDir is { } d ? Path.Combine(d, RosbotPluginConstants.BridgeFilterFileName) : null;
        if (path == null || !File.Exists(path)) return (false, Array.Empty<string>());
        try
        {
            var lines = File.ReadAllLines(path);
            bool auto = lines.Any(l => l.Trim().Equals($"{FilterKeyAuto}={true}", StringComparison.OrdinalIgnoreCase));
            return (auto, lines.Where(l => !l.Contains('=') && l.Trim().Length > 0).Select(l => l.Trim()).ToList());
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return (false, Array.Empty<string>());
        }
    }

    private const string CommandKeyId = "id";
    private const string CommandKeyAction = "action";
    private const string CommandKeyTarget = "target";
    private const string CommandKeyMode = "mode";
    private const string CommandKeyClick = "click";
    private const string CommandKeyUiId = "ui_id";
    private const string CommandKeyValue = "value";
    private const string FilterKeyAuto = "auto";
    private const string TempSuffix = ".tmp";

    private static bool WriteAtomic(string path, IEnumerable<string> lines)
    {
        try
        {
            string tmp = path + TempSuffix;
            File.WriteAllLines(tmp, lines);
            File.Move(tmp, path, true);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag} write failed {path}: {ex.Message}");
            return false;
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
