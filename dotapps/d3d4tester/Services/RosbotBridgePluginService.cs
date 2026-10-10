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
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

public enum RosbotBridgeInstallResult { Installed, UpToDate, NoRosbot, NoBundle, Locked, Failed }

/// <summary>What the single plugin button does now (RosbotBridgePluginService.PluginAction).</summary>
public enum RosbotBridgePluginAction { Install, UpToDate, RestartToLoad, RestartToUpdate, Restarting }

/// <summary>Pause + stay in town: already in town, dead (the plugin revives in town), town portal key sent / not sent.</summary>
public enum TownStandbyResult { InTown, Reviving, PortalSent, PortalNotSent }

/// <summary>Installed vs bundled plugin for the current ROSBOT.</summary>
public sealed record RosbotBridgePluginInfo(string? RosDirectory, string? InstalledPath, string? InstalledVersion, string? BundledVersion, bool UpToDate);

/// <summary>
/// This app's ROSBOT plugin (CoreNodeBridge): install / refresh it in &lt;ROSBOT&gt;\plugins\CoreNodeBridge (idempotent, by
/// content hash; also automatically on startup, before every ROSBOT start (ROSBOT does not hold the DLL then, so a rebuilt plugin
/// always lands) and whenever ros_settings.ros_directory changes, unless switched off), publish the
/// state.json it writes into GameInterfaceData once per second (TickDriver; the single source for the bottom bar, the bridge panel
/// and the planner), and keep user names for level-area SNO ids (rosbot_area_names.json in the user data dir).
/// ROSBOT loads plugins at its start, so a refreshed DLL is used after the next ROSBOT start; enable it once in ROSBOT's plugin list.
/// </summary>
public static class RosbotBridgePluginService
{
    private const string LogTag = "[RosbotBridge]";
    private const double CommandPollSec = 0.5;
    private const double CommandFreeWaitSec = 15.0;
    private const double HoldConfirmSec = 6.0;
    /// <summary>Time for ROSBOT to stop its current action after the pause key before a command is written.</summary>
    public const int TakeControlSettleMs = 1500;
    private const string LeaseReturnToTown = "return to town";
    private const int TownPortalLeaseWaitMs = 10000;
    private static readonly JsonSerializerOptions ReadOptions = new() { PropertyNameCaseInsensitive = true, Converters = { new RosbotBridgeDateTimeConverter() } };
    private static string? _lastReadError;
    private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true };
    private static readonly object NamesLock = new();
    private static Dictionary<int, string>? _areaNames;
    private static int _initialized;
    private static int _installOnNextStart;

    public static string BundledDllPath => Path.Combine(AppContext.BaseDirectory, RosbotPluginConstants.BridgeBundledDir, RosbotPluginConstants.BridgeDllName);

    public static string? RosDirectory =>
        ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") is { Length: > 0 } d && Directory.Exists(d) ? d : null;

    public static string? InstalledDir => RosDirectory is { } d ? Path.Combine(d, RosbotPluginConstants.PluginsDirName, RosbotPluginConstants.BridgeDirName) : null;

    public static string? StatePath => InstalledDir is { } d ? Path.Combine(d, RosbotPluginConstants.BridgeStateFileName) : null;

    public static bool IsInstalled => InstalledDir is { } d && File.Exists(Path.Combine(d, RosbotPluginConstants.BridgeDllName));

    /// <summary>True while a ROSBOT process runs (it loads plugins at its start); from the shared ROSBOT status in GameInterfaceData.</summary>
    public static bool IsRosbotRunning => RosbotDetection.IsOnline(GameInterfaceData.Instance.GetStateSnapshot().RosbotExtendedStatus);

    public static bool AutoInstall => ConfigBinding.GetValue(ConfigKeys.RosbotBridgePluginAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstallDefault);

    /// <summary>Auto-install now and on every ROSBOT path / switch change, and publish the plugin state every tick (call once at startup).</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(_ => PublishState());
        RosbotFlowRunner.Resumed += ReleasePluginControlOnResume;
        RosbotManager.Instance.AddBeforeStartHook(_ => InstallBeforeStart());
        D3D4TesterConfigChangeHub.Notifier.Subscribe(key =>
        {
            if (key is ConfigKeys.RosSettingsRosDirectory or ConfigKeys.RosbotBridgePluginAutoInstall) _ = Task.Run(AutoInstallIfEnabled);
        });
        _ = Task.Run(AutoInstallIfEnabled);
    }

    /// <summary>
    /// Control given back to ROSBOT: end town standby or follow mode (they exclude each other in the plugin), so the plugin does not
    /// move the hero while ROSBOT bots; the follow setup is kept for the next ROSBOT start.
    /// </summary>
    private static void ReleasePluginControlOnResume()
    {
        var bridge = GameInterfaceData.Instance.GetStateSnapshot().RosbotBridge;
        if (bridge is { HoldState: RosbotBridgeState.HoldStateHolding or RosbotBridgeState.HoldStateRequested })
        {
            ColorPrinter.Blue($"{LogTag} resumed -> plugin hold off (ROSBOT continues, town standby off)");
            _ = SendWhenFreeAsync(RosbotPluginConstants.BridgeActionHold, RosbotPluginConstants.BridgeHoldOff, rememberFollow: false);
        }
        else if (bridge is { StandbyEnabled: true })
        {
            ColorPrinter.Blue($"{LogTag} resumed -> town standby off");
            _ = SendWhenFreeAsync(RosbotPluginConstants.BridgeActionStandby, RosbotPluginConstants.BridgeStandbyOff, rememberFollow: false);
        }
        else if (bridge is { FollowEnabled: true })
        {
            ColorPrinter.Blue($"{LogTag} resumed -> follow off (follow setup kept)");
            _ = SendWhenFreeAsync(RosbotPluginConstants.BridgeActionFollow, RosbotPluginConstants.BridgeFollowOff, rememberFollow: false);
        }
    }

    /// <summary>
    /// Take control for the app / panel, never stopping ROSBOT or leaving the game. Preferred: the plugin holds ROSBOT (its bot thread kept
    /// in the plugin: no task runs, plugin data and commands stay live) when the plugin is live and ROSBOT bots; confirmed within
    /// HoldConfirmSec. Otherwise (older plugin, ROSBOT not pulsing, hold unsupported) ROSBOT's own pause key, which also stops the
    /// plugin's data until resume; checked again when control is already taken (a restarted ROSBOT bots unpaused), then a short settle.
    /// </summary>
    public static async Task TakeControlAsync()
    {
        if (RosbotFlowRunner.HeldByPlugin) return;
        if (await TryPluginHoldAsync().ConfigureAwait(false))
        {
            RosbotFlowRunner.PauseHeldByPlugin();
            return;
        }
        if (await RosbotTaskProcessor.Instance.RequestPauseFlow().ConfigureAwait(false))
            await Task.Delay(TakeControlSettleMs).ConfigureAwait(false);
    }

    /// <summary>Ask the plugin to hold ROSBOT and wait until it reports holding; false when not possible or not confirmed.</summary>
    private static async Task<bool> TryPluginHoldAsync()
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (snapshot.RosbotFlowPaused || !snapshot.RosbotBridgeFresh
            || snapshot.RosbotBridge is not { InGame: true, Botting: true, HoldState: not RosbotBridgeState.HoldStateUnsupported })
            return false;
        if (await SendWhenFreeAsync(RosbotPluginConstants.BridgeActionHold, RosbotPluginConstants.BridgeHoldOn, rememberFollow: false).ConfigureAwait(false) == null)
            return false;
        var deadline = DateTime.UtcNow.AddSeconds(HoldConfirmSec);
        while (DateTime.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromSeconds(CommandPollSec)).ConfigureAwait(false);
            var s = GameInterfaceData.Instance.GetStateSnapshot();
            if (s.RosbotBridgeFresh && s.RosbotBridge?.HoldState == RosbotBridgeState.HoldStateHolding)
            {
                ColorPrinter.Blue($"{LogTag} ROSBOT held by the plugin (no pause key, live data)");
                return true;
            }
        }
        ColorPrinter.Yellow($"{LogTag} plugin hold not confirmed in {HoldConfirmSec}s -> ROSBOT pause key instead");
        _ = SendWhenFreeAsync(RosbotPluginConstants.BridgeActionHold, RosbotPluginConstants.BridgeHoldOff, rememberFollow: false);
        return false;
    }

    /// <summary>
    /// Pause + stay in town (clickable anywhere, also in town): take control (TakeControlAsync: ROSBOT paused, no more tasks, the game is
    /// kept), then make sure the hero is in town: already in town (plugin state) -> no key; dead -> the plugin revives in town; else the
    /// town portal key at once. With the plugin live it switches to town standby, which keeps it so until Resume monitoring: outside town
    /// the portal key is pressed again (BridgeTownPortal) until the hero arrives, follow mode ends, the hero stays idle in town.
    /// </summary>
    public static async Task<TownStandbyResult> EnterTownStandbyAsync()
    {
        ColorPrinter.Blue($"{LogTag} pause + stay in town: take control (ROSBOT paused, game kept)");
        await TakeControlAsync().ConfigureAwait(false);
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        var bridge = snapshot.RosbotBridgeFresh ? snapshot.RosbotBridge : null;
        var result = bridge is { InGame: true, InTown: true } ? TownStandbyResult.InTown
            : bridge is { InGame: true, Dead: true } ? TownStandbyResult.Reviving
            : BridgeTownPortal.Press(LeaseReturnToTown, TownPortalLeaseWaitMs) ? TownStandbyResult.PortalSent
            : TownStandbyResult.PortalNotSent;
        ColorPrinter.Blue($"{LogTag} pause + stay in town: {result}");
        if (bridge != null)
            await SendWhenFreeAsync(RosbotPluginConstants.BridgeActionStandby, RosbotPluginConstants.BridgeStandbyOn, rememberFollow: false).ConfigureAwait(false);
        return result;
    }

    /// <summary>Send once command.txt is free (an earlier command is waited out up to CommandFreeWaitSec); null when it never frees.</summary>
    private static async Task<long?> SendWhenFreeAsync(string action, string value, bool rememberFollow)
    {
        var deadline = DateTime.UtcNow.AddSeconds(CommandFreeWaitSec);
        while (CommandPending && DateTime.UtcNow < deadline) await Task.Delay(TimeSpan.FromSeconds(CommandPollSec)).ConfigureAwait(false);
        return SendCommand(action, null, null, null, null, value, rememberFollow);
    }

    private static void AutoInstallIfEnabled()
    {
        if (AutoInstall) Install();
    }

    /// <summary>ROSBOT is about to start (the DLL is free): install when auto-install is on or an update restart asked for it.</summary>
    private static void InstallBeforeStart()
    {
        if (Interlocked.Exchange(ref _installOnNextStart, 0) == 1 || AutoInstall) Install();
    }

    /// <summary>
    /// What the plugin button offers: Restarting while a ROSBOT-only restart runs; ROSBOT running with an installed DLL that differs from
    /// the bundled one -> RestartToUpdate (the running ROSBOT locks it); with the installed one not loaded (the live plugin reports another
    /// version, or no live plugin and the DLL is newer than the ROSBOT process) -> RestartToLoad; else Install (UpToDate when nothing to do).
    /// </summary>
    public static RosbotBridgePluginAction PluginAction()
    {
        if (RosbotOnlyRestart.IsRunning) return RosbotBridgePluginAction.Restarting;
        var info = GetInfo();
        if (!IsRosbotRunning || info.InstalledPath == null) return info.UpToDate ? RosbotBridgePluginAction.UpToDate : RosbotBridgePluginAction.Install;
        if (!info.UpToDate) return RosbotBridgePluginAction.RestartToUpdate;
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (snapshot.RosbotBridgeFresh)
            return snapshot.RosbotBridge is { } s && !SameVersion(s.PluginVersion, info.InstalledVersion)
                ? RosbotBridgePluginAction.RestartToLoad : RosbotBridgePluginAction.UpToDate;
        return InstalledAfterRosbotStart(info.InstalledPath, snapshot.RosbotFoundPid) ? RosbotBridgePluginAction.RestartToLoad : RosbotBridgePluginAction.UpToDate;
    }

    /// <summary>Restart ROSBOT only so it loads the plugin; update = install the bundled DLL while ROSBOT is closed. False when one already runs.</summary>
    public static bool RestartRosbotForPlugin(bool update)
    {
        if (update) Interlocked.Exchange(ref _installOnNextStart, 1);
        return RosbotOnlyRestart.Restart(update ? "bridge plugin update" : "bridge plugin reload");
    }

    private static bool SameVersion(string? a, string? b) =>
        Version.TryParse(a, out var va) && Version.TryParse(b, out var vb) ? va == vb : string.Equals(a, b, StringComparison.Ordinal);

    /// <summary>The installed DLL was written after the running ROSBOT started (so it is not loaded); false when unknown.</summary>
    private static bool InstalledAfterRosbotStart(string dllPath, int pid)
    {
        if (pid <= 0) return false;
        try
        {
            using var process = Process.GetProcessById(pid);
            return File.GetLastWriteTime(dllPath) > process.StartTime;
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception or IOException)
        {
            return false;
        }
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
            var state = JsonSerializer.Deserialize<RosbotBridgeState>(stream, ReadOptions);
            _lastReadError = null;
            return state;
        }
        catch (JsonException ex)
        {
            if (ex.Message != _lastReadError) ColorPrinter.Red($"{LogTag} state.json not readable (plugin / app field mismatch): {ex.Message}");
            _lastReadError = ex.Message;
            return null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    /// <summary>
    /// Queue a command for the plugin (command.txt, taken by the plugin's own timer once its worker is free; the result appears as
    /// last_command in state.json). Returns the command id, or null when ROSBOT's plugin folder is missing or an earlier command
    /// is still waiting in command.txt (never overwritten, so no command is lost). Logged in the app log.
    /// </summary>
    public static long? SendCommand(string action, string? target = null, bool? mode = null, bool? click = null, string? uiId = null, string? value = null) =>
        SendCommand(action, target, mode, click, uiId, value, rememberFollow: true);

    /// <summary>rememberFollow: a follow command is saved as the follow setup replayed after ROSBOT starts (false for automatic follow-off).</summary>
    private static long? SendCommand(string action, string? target, bool? mode, bool? click, string? uiId, string? value, bool rememberFollow)
    {
        if (InstalledDir is not { } dir || !Directory.Exists(dir)) return null;
        if (CommandPending)
        {
            ColorPrinter.Yellow($"{LogTag} command {action} not sent: the previous command is not taken by the plugin yet");
            return null;
        }
        long id = DateTime.UtcNow.Ticks;
        var lines = new List<string> { $"{CommandKeyId}={id}", $"{CommandKeyAction}={action}" };
        if (!string.IsNullOrWhiteSpace(target)) lines.Add($"{CommandKeyTarget}={target.Trim()}");
        if (mode != null) lines.Add($"{CommandKeyMode}={mode.Value}");
        if (click != null) lines.Add($"{CommandKeyClick}={click.Value}");
        if (!string.IsNullOrWhiteSpace(uiId)) lines.Add($"{CommandKeyUiId}={uiId.Trim()}");
        if (!string.IsNullOrWhiteSpace(value)) lines.Add($"{CommandKeyValue}={value.Trim()}");
        lines.Add($"{CommandKeyAssist}={AssistEnabled}");
        lines.Add($"{CommandKeyCast}={PluginCastEnabled}");
        if (!WriteAtomic(Path.Combine(dir, RosbotPluginConstants.BridgeCommandFileName), lines)) return null;
        ColorPrinter.Blue($"{LogTag} command {id} {action} target='{target}' mode={mode} click={click} ui={uiId} assist={AssistEnabled}");
        if (rememberFollow && action == RosbotPluginConstants.BridgeActionFollow)
        {
            ConfigBinding.SetValue(ConfigKeys.BridgeFollowCommandValue, value?.Trim() ?? "");
            ConfigBinding.SetValue(ConfigKeys.BridgeFollowCommandTarget, target?.Trim() ?? "");
        }
        return id;
    }

    /// <summary>
    /// True while command.txt holds a command the plugin has not taken yet (it keeps it while another command runs). A command
    /// older than the plugin's max age is dropped by the plugin anyway, so it no longer blocks.
    /// </summary>
    public static bool CommandPending
    {
        get
        {
            if (InstalledDir is not { } dir) return false;
            string path = Path.Combine(dir, RosbotPluginConstants.BridgeCommandFileName);
            try
            {
                if (!File.Exists(path)) return false;
                long ticks = File.ReadAllLines(path)
                    .Select(l => l.Split('=', 2))
                    .Where(kv => kv.Length == 2 && kv[0].Trim().Equals(CommandKeyId, StringComparison.OrdinalIgnoreCase))
                    .Select(kv => long.TryParse(kv[1].Trim(), out long t) ? t : 0)
                    .FirstOrDefault();
                return ticks > 0 && (DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc)).TotalSeconds <= RosbotPluginConstants.BridgeCommandMaxAgeSec;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return true;
            }
        }
    }

    /// <summary>
    /// Send a command and wait (polling the shared plugin state) until the plugin reports its result; an earlier command still
    /// waiting in command.txt is waited out first (same timeout). Null on timeout / no plugin.
    /// </summary>
    public static RosbotBridgeCommandResult? SendCommandAndWait(FlowContext ctx, TimeSpan timeout, string action, string? target = null, string? value = null)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (CommandPending && DateTime.UtcNow < deadline) ctx.Wait(CommandPollSec);
        if (SendCommand(action, target, value: value) is not { } id) return null;
        deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            ctx.Wait(CommandPollSec);
            if (GameInterfaceData.Instance.GetStateSnapshot().RosbotBridge?.LastCommand is { } r && r.Id == id) return r;
        }
        return null;
    }

    /// <summary>True when the saved follow command turns follow on (it is replayed after ROSBOT starts).</summary>
    public static bool FollowConfigured(out string value, out string target)
    {
        value = ConfigBinding.GetValue(ConfigKeys.BridgeFollowCommandValue, "") ?? "";
        target = ConfigBinding.GetValue(ConfigKeys.BridgeFollowCommandTarget, "") ?? "";
        return value.Length > 0 && value != RosbotPluginConstants.BridgeFollowOff;
    }

    /// <summary>Shared combat assist setting (ConfigKeys.BridgeAssist), sent with every command.</summary>
    public static bool AssistEnabled => ConfigBinding.GetValue(ConfigKeys.BridgeAssist, ConfigKeys.BridgeAssistDefault);

    /// <summary>Shared "plugin casts" setting (ConfigKeys.BridgePluginCast), sent with every command.</summary>
    public static bool PluginCastEnabled => ConfigBinding.GetValue(ConfigKeys.BridgePluginCast, ConfigKeys.BridgePluginCastDefault);

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

    /// <summary>Tell the plugin whether the app has town work (hold the next town visit) or is done (end the current hold).</summary>
    public static bool SaveTownHold(bool hold)
    {
        if (InstalledDir is not { } dir || !Directory.Exists(dir)) return false;
        return WriteAtomic(Path.Combine(dir, RosbotPluginConstants.BridgeTownHoldFileName),
            new[] { hold ? RosbotPluginConstants.BridgeTownHoldOn : RosbotPluginConstants.BridgeTownHoldOff });
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
    private const string CommandKeyAssist = "assist";
    private const string CommandKeyCast = "cast";
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
