// PY-REF: none (DOT-only)
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// ROSBOT license keys added on the Monitor tab (stored encrypted, one active). ROSBOT keeps its key in
/// Documents/RoS-BoT/RosBotGlobalSettings.ini ([BotParameters] "Key"). Before every ROSBOT start (RosbotManager before-start hook)
/// the active key is written there: an existing Key line is replaced in place, otherwise it is added to the section holding ROSBOT's
/// other global fields. Without that ini ROSBOT shows its KEY dialog ("Please, enter a key"; it saves the ini only after a key is
/// accepted): whenever the state center reports that dialog, RosbotUiAutomation.TryFillKeyDialog types the active key and presses OK.
/// Switching the active key while ROSBOT runs with another key offers one ROSBOT-only restart (D3 kept): the running flow restarts
/// ROSBOT through its E block, otherwise ROSBOT is closed and started again here; both write the new key in the before-start hook.
/// </summary>
public static class RosbotKeyService
{
    private const string LogTag = "[RosbotKey]";
    private const string IniKeyName = "Key";
    private const char KeySeparator = '\n';
    private const int MaskVisibleChars = 8;
    /// <summary>ROSBOT [SettingsField] names without a Category, declared next to "Key" (same ini section).</summary>
    private static readonly string[] IniAnchorKeys = { "KeyEx", "TosAccepted", "LastScriptUsed", "LastLaunchWasLocal", "SceneVersion", "Seasons", "Exts", "LocalPickit", "LocalSkill", "DontPickit", "SeasonItems" };

    private const string LeaseKeySwitch = "ROSBOT key switch";
    private const int LeaseWaitMs = 20000;

    private static int _installed;
    private static int _fillRunning;
    private static int _restartRunning;
    /// <summary>Key written before the running ROSBOT started; null when ROSBOT was started outside this app.</summary>
    private static volatile string? _startedKey;

    /// <summary>Result and time of the last write (before-start or Apply now); null before the first one.</summary>
    public static (IniSetResult Result, DateTime At)? LastApply { get; private set; }

    public static event Action? Applied;

    public static void Install()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        RosbotManager.Instance.SetBeforeStartHook(OnBeforeStart);
        RosbotManager.Instance.SetKeyProvider(() => WriteBeforeStart ? ActiveKey : null);
        GameInterfaceData.Instance.RegisterCallback(OnState);
    }

    /// <summary>KEY dialog reported by the status refresh: fill it off the calling thread (one fill at a time).</summary>
    private static void OnState(GameInterfaceStateSnapshot s)
    {
        if (!s.RosbotNeedKeyInput || Interlocked.Exchange(ref _fillRunning, 1) == 1) return;
        Task.Run(() =>
        {
            try
            {
                if (RosbotUiAutomation.TryFillKeyDialog()) MonitorLog.Info($"{LogTag} ROSBOT KEY dialog filled with {Mask(ActiveKey ?? "")}");
            }
            finally
            {
                Interlocked.Exchange(ref _fillRunning, 0);
            }
        });
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

    /// <summary>Make a key active; false when it already was (nothing changed).</summary>
    public static bool SetActive(int index)
    {
        string? before = ActiveKey;
        if (index < 0 || index >= Keys.Count || index == ActiveIndex) return false;
        ActiveIndex = index;
        MonitorLog.Info($"{LogTag} active key {Mask(before ?? "")} -> {Mask(ActiveKey ?? "")}");
        return !string.Equals(before, ActiveKey, StringComparison.Ordinal);
    }

    /// <summary>True when a running ROSBOT uses another key than the active one and no key restart is running (ask once per change).</summary>
    public static bool RestartNeeded =>
        WriteBeforeStart && ActiveKey is { } key && Volatile.Read(ref _restartRunning) == 0
        && !string.Equals(key, _startedKey ?? CurrentKey, StringComparison.Ordinal) && RosbotManager.Instance.FindRosbotProcesses().Count > 0;

    /// <summary>
    /// Restart ROSBOT only, with the active key: the running flow (not paused) restarts it in its E block; otherwise ROSBOT is closed
    /// (F7, leftovers killed) and started again. D3 is never touched; a missing D3 is the flow's [F1] job.
    /// </summary>
    public static void RestartRosbotWithActiveKey()
    {
        if (Interlocked.Exchange(ref _restartRunning, 1) == 1) return;
        Task.Run(() =>
        {
            try
            {
                if (RosbotFlowRunner.IsRunning && !RosbotFlowRunner.IsPaused)
                {
                    MonitorLog.Info($"{LogTag} key switched -> flow restarts ROSBOT only");
                    F3MonitorProcess.RequestRosbotRestart();
                    return;
                }
                MonitorLog.Info($"{LogTag} key switched -> close ROSBOT and start it again (D3 kept)");
                using var lease = GameControl.TryAcquire(LeaseKeySwitch, LeaseWaitMs);
                var rosbot = RosbotManager.Instance;
                rosbot.CloseGracefully();
                rosbot.InvalidateLookupCache();
                if (!rosbot.Start(autostart: true)) MonitorLog.Warn($"{LogTag} ROSBOT start after key switch failed");
            }
            finally
            {
                Interlocked.Exchange(ref _restartRunning, 0);
            }
        });
    }

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

    /// <summary>First characters only, e.g. 30f1a2b3****.</summary>
    public static string Mask(string key) => SecretMask.Prefix(key, MaskVisibleChars);

    /// <summary>ROSBOT global settings ini that holds the key (Documents/RoS-BoT/RosBotGlobalSettings.ini).</summary>
    public static string IniPath => RosbotLogPaths.GetGlobalSettingsPath();

    public static string IniDirectory => RosbotLogPaths.GetRosbotDocumentsDirectory();

    /// <summary>Key ROSBOT currently has in its global settings ini; null when the file or the Key line is missing or empty.</summary>
    public static string? CurrentKey
    {
        get
        {
            try
            {
                return IniFileEditor.GetValue(IniPath, IniKeyName) is { Length: > 0 } key ? key : null;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return null;
            }
        }
    }

    /// <summary>Write the active key to the global settings ini now (Apply now button); null when there is no key.</summary>
    public static IniSetResult? ApplyNow() => Apply();

    private static void OnBeforeStart(string exePath)
    {
        if (!WriteBeforeStart || ActiveKey == null) return;
        _startedKey = ActiveKey;
        Apply();
    }

    private static IniSetResult? Apply()
    {
        string iniPath = IniPath;
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
        if (result == IniSetResult.NoAnchor) MonitorLog.Warn(line);
        else MonitorLog.Info(line);
        LastApply = (result, DateTime.Now);
        Applied?.Invoke();
        return result;
    }

    private static void Save(IReadOnlyList<string> keys) => MonitorSettings.SetSecret(ConfigKeys.MonitorRosbotKeys, string.Join(KeySeparator, keys));
}
