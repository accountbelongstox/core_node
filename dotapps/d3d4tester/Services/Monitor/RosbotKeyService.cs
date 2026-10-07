// PY-REF: none (DOT-only)
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// ROSBOT license keys added on the Monitor tab (stored encrypted, one active). Before every ROSBOT start (RosbotManager before-start
/// hook) the active key is written to RoS-BoT.ini next to the exe as the ROSBOT settings field "Key": an existing Key line is
/// replaced in place; otherwise it is added to the section holding ROSBOT's other global fields. When RoS-BoT.ini is missing or has
/// no such section yet (ROSBOT never ran there), ROSBOT is started once so it creates the file, closed gracefully (it saves its
/// settings on exit), the key is written, and the normal start follows; once per ini per app session, so an unknown format never loops.
/// </summary>
public static class RosbotKeyService
{
    private const string LogTag = "[RosbotKey]";
    private const string IniKeyName = "Key";
    private const char KeySeparator = '\n';
    private const int MaskVisibleChars = 4;
    private const string MaskFill = "****";
    private const int FirstRunIniWaitMs = 60000;
    private const int FirstRunPollMs = 2000;
    private const int FirstRunSettleMs = 3000;
    private const int FirstRunCloseTimeoutMs = 15000;
    /// <summary>ROSBOT [SettingsField] names without a Category, declared next to "Key" (same ini section).</summary>
    private static readonly string[] IniAnchorKeys = { "KeyEx", "TosAccepted", "LastScriptUsed", "LastLaunchWasLocal", "SceneVersion", "Seasons", "Exts", "LocalPickit", "LocalSkill", "DontPickit", "SeasonItems" };

    private static int _installed;
    private static readonly HashSet<string> FirstRunDone = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Result and time of the last write (before-start or Apply now); null before the first one.</summary>
    public static (IniSetResult Result, DateTime At)? LastApply { get; private set; }

    public static event Action? Applied;

    public static void Install()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        RosbotManager.Instance.SetBeforeStartHook(OnBeforeStart);
    }

    public static bool WriteBeforeStart => MonitorSettings.GetBool(ConfigKeys.MonitorRosbotKeyWriteBeforeStart, true);

    public static IReadOnlyList<string> Keys =>
        MonitorSettings.GetSecret(ConfigKeys.MonitorRosbotKeys).Split(KeySeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static int ActiveIndex
    {
        get
        {
            int count = Keys.Count;
            return count == 0 ? -1 : Math.Clamp(MonitorSettings.GetInt(ConfigKeys.MonitorRosbotKeyActiveIndex, 0), 0, count - 1);
        }
        set => ConfigBinding.SetValue(ConfigKeys.MonitorRosbotKeyActiveIndex, Math.Max(0, value));
    }

    public static string? ActiveKey => ActiveIndex is var i and >= 0 ? Keys[i] : null;

    /// <summary>Add a key (trimmed, no duplicates); the first key added becomes active. False when empty or already listed.</summary>
    public static bool Add(string key)
    {
        key = key.Trim();
        var keys = Keys.ToList();
        if (key.Length == 0 || key.Contains(KeySeparator) || keys.Contains(key, StringComparer.Ordinal)) return false;
        keys.Add(key);
        Save(keys);
        if (keys.Count == 1) ActiveIndex = 0;
        MonitorLog.Info($"{LogTag} key {Mask(key)} added ({keys.Count} total)");
        return true;
    }

    public static void Remove(int index)
    {
        var keys = Keys.ToList();
        if (index < 0 || index >= keys.Count) return;
        int active = ActiveIndex;
        string removed = keys[index];
        keys.RemoveAt(index);
        Save(keys);
        ActiveIndex = index < active ? active - 1 : Math.Min(active, Math.Max(0, keys.Count - 1));
        MonitorLog.Info($"{LogTag} key {Mask(removed)} removed ({keys.Count} left)");
    }

    /// <summary>First and last characters only, e.g. ABCD****WXYZ.</summary>
    public static string Mask(string key) =>
        key.Length <= MaskVisibleChars * 2 ? MaskFill : key[..MaskVisibleChars] + MaskFill + key[^MaskVisibleChars..];

    /// <summary>RoS-BoT.ini of the configured ROSBOT folder, or null when the folder is not set.</summary>
    public static string? IniPath =>
        RosbotManager.Instance.GetRosDirectory() is { Length: > 0 } dir ? Path.Combine(dir, ShellConstants.RosbotIniFileName) : null;

    /// <summary>Write the active key to RoS-BoT.ini now (Apply now button); null when there is no key or no ROSBOT folder.</summary>
    public static IniSetResult? ApplyNow() => IniPath is { } path ? Apply(path) : null;

    private static void OnBeforeStart(string exePath)
    {
        if (!WriteBeforeStart || ActiveKey == null || Path.GetDirectoryName(exePath) is not { Length: > 0 } dir) return;
        string iniPath = Path.Combine(dir, ShellConstants.RosbotIniFileName);
        if (Apply(iniPath) is IniSetResult.FileMissing or IniSetResult.NoAnchor && FirstRunDone.Add(iniPath))
            FirstRunThenApply(exePath, iniPath);
    }

    /// <summary>Start ROSBOT once so it creates RoS-BoT.ini, close it gracefully, then write the key (the caller starts it again).</summary>
    private static void FirstRunThenApply(string exePath, string iniPath)
    {
        var rosbot = RosbotManager.Instance;
        MonitorLog.Info($"{LogTag} no Key slot in {iniPath}: starting ROSBOT once so it writes its settings");
        if (!rosbot.StartExecutable(exePath)) return;
        var deadline = DateTime.UtcNow.AddMilliseconds(FirstRunIniWaitMs);
        while (!File.Exists(iniPath) && DateTime.UtcNow < deadline) Thread.Sleep(FirstRunPollMs);
        Thread.Sleep(FirstRunSettleMs);
        rosbot.CloseGracefully(FirstRunCloseTimeoutMs);
        MonitorLog.Info($"{LogTag} first ROSBOT run closed, writing the key and restarting ROSBOT");
        Apply(iniPath);
    }

    private static IniSetResult? Apply(string iniPath)
    {
        if (ActiveKey is not { } key) return null;
        IniSetResult result;
        try
        {
            result = IniFileEditor.SetValue(iniPath, IniKeyName, key, IniAnchorKeys);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            MonitorLog.Warn($"{LogTag} {iniPath} not written: {ex.Message}");
            return null;
        }
        string line = $"{LogTag} {IniKeyName}={Mask(key)} -> {iniPath}: {result}";
        if (result is IniSetResult.FileMissing or IniSetResult.NoAnchor) MonitorLog.Warn(line);
        else MonitorLog.Info(line);
        LastApply = (result, DateTime.Now);
        Applied?.Invoke();
        return result;
    }

    private static void Save(IReadOnlyList<string> keys) => MonitorSettings.SetSecret(ConfigKeys.MonitorRosbotKeys, string.Join(KeySeparator, keys));
}
