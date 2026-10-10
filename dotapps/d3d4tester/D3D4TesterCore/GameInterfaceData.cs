// PY-REF: pyapps/d3-check/share/game_interface_data.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_task_processor.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_only.py
// PY-REF: pyapps/d3-check/d3utils/macro_config_ops.py
// PY-REF: pyapps/d3-check/d3utils/screenshot_provider.py
using System.Drawing;
using System.IO;
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Bridge;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.TemplateMatcher;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Global runtime state center (single source of truth): Battle.net, D3, ROSBOT and flow switches here; the D4 section is
/// <see cref="D4"/>. Writers are the status providers and flows; setters return whether the value changed so writers notify
/// once. UI reads via GetStateSnapshot() and callbacks on the main thread.
/// </summary>
public sealed class GameInterfaceData : IGameInterfaceData
{
    private readonly object _lock = new();
    private readonly List<Action<GameInterfaceStateSnapshot>> _callbacks = new();

    private bool _battlenetWindowFound;
    private string? _battlenetRegion;
    private bool _rosbotWindowFound;
    private bool _rosbotHasMainUi = false;
    private string _rosbotExtendedStatus = "not_found";
    private bool _rosbotRunning;
    private bool _rosbotDisconnectedFromLog;
    private bool _rosbotFlowMasterEnabled;
    private bool _rosbotFlowPaused;
    private RosbotBridgeState? _rosbotBridge;
    private bool _rosbotBridgeFresh;
    private bool _ensureBattlenetOnlyEnabled;
    private bool _d3Running;
    private string _mapType = GameInterfaceStateSnapshot.UnknownValue;
    private string _gameStage = GameInterfaceStateSnapshot.UnknownValue;
    private bool _d3OnLoginScreen = false;
    private bool _d3Disconnected = false;
    private bool _d3InGame = false;
    private bool _battlenetOnLoginScreen = false;
    private bool _battlenetDisconnected = false;
    private bool _battlenetWakingUp;
    private bool _battlenetNormalAvailable;
    private BattlenetClientState _battlenetClientState = BattlenetClientState.Unknown;
    private string? _battlenetUiRegion;
    private string? _battlenetStateDetail;
    private BattlenetGameUi _battlenetGameUi = BattlenetGameUi.None;
    private string? _battlenetAccountTag;
    private string? _battlenetAccountPresence;
    private string _rosbotFoundExeName = "";
    private string _rosbotFoundWindowTitle = "";
    private int _rosbotFoundPid;
    private string _d3ExeName = "";
    private int _d3Pid;
    private bool _rosbotNeedKeyInput = false;
    private string _rosbotNeedKeyMessage = "";
    private string? _rosbotTestModeDisplay = null;
    private int _rosbotTotalRestartCount = 0;
    private int _windowWidth = 0;
    private int _windowHeight = 0;

    private bool _pathValidBn;
    private bool _pathValidD3;
    private bool _pathValidRos;
    private string? _rosVersionDisplay;

    private double _globalScaleX = 1.0;
    private double _globalScaleY = 1.0;
    private int _gameWindowWidth;
    private int _gameWindowHeight;
    private int _fullscreenWidth;
    private int _fullscreenHeight;

    /// <summary>When set, NotifyCallbacks is run on the UI thread via this marshal. Prevents cross-thread UI access when flow calls NotifyCallbacks from thread pool.</summary>
    private Action<Action>? _marshalToUi;

    /// <summary>Cached D3 window client rect (screen coords). 1:1 Python macro_config_ops._cached_d3_client_rect. Cleared when macro stops.</summary>
    private (int Left, int Top, int Right, int Bottom)? _cachedD3ClientRect;

    private IntPtr _d3WindowHwnd;
    private string? _d3WindowTitle;

    public static GameInterfaceData Instance { get; } = new();

    private GameInterfaceData() { }

    /// <summary>D4 section of the state center (window, map, team, region images); written by the D4 tick.</summary>
    public global::DotApps.d3d4tester.Core.D4.D4InterfaceData D4 => global::DotApps.d3d4tester.Core.D4.D4InterfaceData.Instance;

    /// <summary>Flow-master switch (Start/Stop ROSBOT); written only through RosbotFlowState.</summary>
    public bool RosbotFlowMasterEnabled
    {
        get { lock (_lock) return _rosbotFlowMasterEnabled; }
    }

    /// <summary>Monitoring paused (flow halted, ROSBOT paused with its own key); written only through RosbotFlowState.</summary>
    public bool RosbotFlowPaused
    {
        get { lock (_lock) return _rosbotFlowPaused; }
    }

    /// <summary>Ensure-Battle.net-only switch; written only through RosbotFlowState.</summary>
    public bool EnsureBattlenetOnlyEnabled
    {
        get { lock (_lock) return _ensureBattlenetOnlyEnabled; }
    }

    /// <summary>D3 window handle from the last D3 status refresh (zero when no window). 1:1 Python game_data._window_hwnd.</summary>
    public IntPtr D3WindowHwnd
    {
        get { lock (_lock) return _d3WindowHwnd; }
    }

    /// <summary>D3 window title from the last D3 status refresh. 1:1 Python game_data._window_title.</summary>
    public string? D3WindowTitle
    {
        get { lock (_lock) return _d3WindowTitle; }
    }

    /// <summary>
    /// Apply D3 window geometry from the status refresh (offset, hwnd, title, fullscreen size); reset when no window.
    /// 1:1 Python d3_status_provider._apply_d3_geometry writing game_data.
    /// </summary>
    public void ApplyD3WindowGeometry(IntPtr hwnd, string? title, (int X, int Y) offset, (int Width, int Height) fullscreenSize)
    {
        lock (_lock)
        {
            _d3WindowHwnd = hwnd;
            _d3WindowTitle = title;
            _windowOffset = offset;
            _fullscreenWidth = fullscreenSize.Width;
            _fullscreenHeight = fullscreenSize.Height;
        }
    }

    public void RegisterCallback(Action<GameInterfaceStateSnapshot> callback)
    {
        if (callback == null) return;
        lock (_lock)
        {
            if (!_callbacks.Contains(callback))
                _callbacks.Add(callback);
        }
    }

    public void UnregisterCallback(Action<GameInterfaceStateSnapshot> callback)
    {
        if (callback == null) return;
        lock (_lock)
            _callbacks.Remove(callback);
    }

    public GameInterfaceStateSnapshot GetStateSnapshot()
    {
        lock (_lock)
        {
            return new GameInterfaceStateSnapshot
            {
                BattlenetWindowFound = _battlenetWindowFound,
                BattlenetRegion = _battlenetRegion,
                RosbotWindowFound = _rosbotWindowFound,
                RosbotHasMainUi = _rosbotHasMainUi,
                RosbotExtendedStatus = _rosbotExtendedStatus,
                RosbotRunning = _rosbotRunning,
                RosbotDisconnectedFromLog = _rosbotDisconnectedFromLog,
                RosbotFlowMasterEnabled = _rosbotFlowMasterEnabled,
                RosbotFlowPaused = _rosbotFlowPaused,
                RosbotBridge = _rosbotBridge,
                RosbotBridgeFresh = _rosbotBridgeFresh,
                EnsureBattlenetOnlyEnabled = _ensureBattlenetOnlyEnabled,
                D3Running = _d3Running,
                MapType = _mapType,
                GameStage = _gameStage,
                D3OnLoginScreen = _d3OnLoginScreen,
                D3Disconnected = _d3Disconnected,
                D3InGame = _d3InGame,
                BattlenetOnLoginScreen = _battlenetOnLoginScreen,
                BattlenetDisconnected = _battlenetDisconnected,
                BattlenetWakingUp = _battlenetWakingUp,
                BattlenetNormalAvailable = _battlenetNormalAvailable,
                BattlenetClientState = _battlenetClientState,
                BattlenetUiRegion = _battlenetUiRegion,
                BattlenetStateDetail = _battlenetStateDetail,
                BattlenetGameUi = _battlenetGameUi,
                BattlenetAccountTag = _battlenetAccountTag,
                BattlenetAccountPresence = _battlenetAccountPresence,
                RosbotFoundExeName = _rosbotFoundExeName,
                RosbotFoundWindowTitle = _rosbotFoundWindowTitle,
                RosbotFoundPid = _rosbotFoundPid,
                D3ExeName = _d3ExeName,
                D3Pid = _d3Pid,
                RosbotNeedKeyInput = _rosbotNeedKeyInput,
                RosbotNeedKeyMessage = _rosbotNeedKeyMessage,
                RosbotTestModeDisplay = _rosbotTestModeDisplay,
                RosbotTotalRestartCount = _rosbotTotalRestartCount,
                WindowWidth = _windowWidth,
                WindowHeight = _windowHeight,
                PathValidBn = _pathValidBn,
                PathValidD3 = _pathValidD3,
                PathValidRos = _pathValidRos,
                RosVersionDisplay = _rosVersionDisplay,
            };
        }
    }

    /// <summary>Set path-derived state from config when no window detection. Path validity and RosVersionDisplay only; window-found state is set by status poll (SetBattlenetWindowFound, etc.). 1:1 Python: path valid separate from battlenet_window_found/d3_running.</summary>
    public void UpdateFromPaths(string? battlenetPath, string? d3Path, string? rosDirectory)
    {
        lock (_lock)
        {
            _pathValidBn = PathScanner.IsConfiguredBattlenetValid(battlenetPath);
            _pathValidD3 = PathScanner.IsConfiguredD3Valid(d3Path);
            _pathValidRos = PathScanner.IsRosPathUsable(rosDirectory);
            _rosVersionDisplay = RosbotVersionInfo.GetRosVersionDisplay(rosDirectory, _battlenetRegion);

            // Window-found state is NOT set here; it is set by StatePollTimer (SetBattlenetWindowFound) and flow (D3/ROSBOT). Path validity only for bottom bar icons.
            if (string.IsNullOrWhiteSpace(rosDirectory))
            {
                _rosbotExtendedStatus = "not_found";
                _rosbotWindowFound = false;
            }
            // When ROS path is valid but no flow has run yet, leave _rosbotExtendedStatus unchanged (e.g. not_found) so UI shows "-" until refresh_rosbot_status runs
        }
    }

    /// <summary>Set whether Battle.net window was found (e.g. from process check or after Start).</summary>
    public bool SetBattlenetWindowFound(bool found)
    {
        lock (_lock)
        {
            if (_battlenetWindowFound == found) return false;
            _battlenetWindowFound = found;
            return true;
        }
    }

    /// <summary>Set Battle.net 唤醒中 (waiting for wake from sleep mode). When true, status bar shows 唤醒中 and ROSBOT must not start.</summary>
    public void SetBattlenetWakingUp(bool wakingUp)
    {
        lock (_lock)
        {
            _battlenetWakingUp = wakingUp;
        }
    }

    /// <summary>Set Battle.net region (e.g. "asia" or "cn"). Call after EnsureBattlenetRegionFromConfig or when region is known.</summary>
    public void SetBattlenetRegion(string? region)
    {
        lock (_lock)
        {
            _battlenetRegion = string.IsNullOrWhiteSpace(region) ? null : (region.Trim().ToLowerInvariant() == "cn" ? "cn" : "asia");
        }
    }

    /// <summary>Set ROSBOT running state. Logic 1:1 with Python set_rosbot_status.</summary>
    public void SetRosbotStatus(bool running)
    {
        lock (_lock)
        {
            if (_rosbotRunning != running)
            {
                _rosbotRunning = running;
                ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetRosbotStatus(running={running}).");
            }
        }
    }

    /// <summary>Set ROSBOT disconnected-from-log flag. 1:1 Python set_rosbot_disconnected_from_log.</summary>
    public void SetRosbotDisconnectedFromLog(bool disconnected)
    {
        lock (_lock)
        {
            if (_rosbotDisconnectedFromLog != disconnected)
            {
                _rosbotDisconnectedFromLog = disconnected;
                ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetRosbotDisconnectedFromLog({disconnected}).");
            }
        }
    }

    /// <summary>Read and clear the disconnected-from-log flag (flow master consumes it once). 1:1 Python get_and_clear_rosbot_disconnected_from_log.</summary>
    public bool GetAndClearRosbotDisconnectedFromLog()
    {
        lock (_lock)
        {
            bool v = _rosbotDisconnectedFromLog;
            _rosbotDisconnectedFromLog = false;
            return v;
        }
    }

    /// <summary>Set map type from ROSBOT log (e.g. town, echo, firstborn_temple). Returns true if value changed.</summary>
    public bool SetMapType(string mapType)
    {
        lock (_lock)
        {
            string v = string.IsNullOrWhiteSpace(mapType) ? GameInterfaceStateSnapshot.UnknownValue : mapType.Trim();
            if (_mapType == v) return false;
            _mapType = v;
            return true;
        }
    }

    /// <summary>Set game stage from ROSBOT log. Returns true if value changed.</summary>
    public bool SetGameStage(string gameStage)
    {
        lock (_lock)
        {
            string v = string.IsNullOrWhiteSpace(gameStage) ? GameInterfaceStateSnapshot.UnknownValue : gameStage.Trim();
            if (_gameStage == v) return false;
            _gameStage = v;
            return true;
        }
    }

    /// <summary>Set flow master enabled (Start/Stop ROSBOT); true when changed. Logic 1:1 with Python set_rosbot_flow_master_enabled.</summary>
    public bool SetRosbotFlowMasterEnabled(bool enabled)
    {
        lock (_lock)
        {
            if (_rosbotFlowMasterEnabled == enabled) return false;
            _rosbotFlowMasterEnabled = enabled;
        }
        ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetRosbotFlowMasterEnabled(enabled={enabled}).");
        return true;
    }

    /// <summary>Publish the CoreNodeBridge plugin state (null = no state.json). True when the state or its freshness changed.</summary>
    public bool SetRosbotBridgeState(RosbotBridgeState? state, DateTime nowUtc)
    {
        bool fresh = state != null && !state.IsStale(nowUtc);
        lock (_lock)
        {
            bool changed = fresh != _rosbotBridgeFresh || state?.UpdatedUtc != _rosbotBridge?.UpdatedUtc;
            _rosbotBridge = state;
            _rosbotBridgeFresh = fresh;
            return changed;
        }
    }

    /// <summary>Set monitoring paused (Pause / Resume monitoring); true when changed.</summary>
    public bool SetRosbotFlowPaused(bool paused)
    {
        lock (_lock)
        {
            if (_rosbotFlowPaused == paused) return false;
            _rosbotFlowPaused = paused;
        }
        ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetRosbotFlowPaused(paused={paused}).");
        return true;
    }

    /// <summary>Set Ensure Battle.net only mode (button on/off). Dot: 2s tick loop when enabled (1:1 Python process_task + tick_bn_only_flow).</summary>
    public bool SetEnsureBattlenetOnlyEnabled(bool enabled)
    {
        lock (_lock)
        {
            if (_ensureBattlenetOnlyEnabled == enabled) return false;
            _ensureBattlenetOnlyEnabled = enabled;
        }
        ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetEnsureBattlenetOnlyEnabled(enabled={enabled}).");
        return true;
    }

    /// <summary>Set D3 running status (window found). 1:1 with Python set_d3_status. Notify callbacks.</summary>
    public bool SetD3Status(bool running)
    {
        lock (_lock)
        {
            if (_d3Running == running) return false;
            _d3Running = running;
            ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetD3Status(running={running}).");
            return true;
        }
    }

    /// <summary>Set D3 dynamic state (login screen / disconnected / in game). 1:1 with Python set_d3_dynamic_status.</summary>
    public bool SetD3DynamicStatus(bool onLoginScreen, bool disconnected, bool inGame)
    {
        lock (_lock)
        {
            if (_d3OnLoginScreen == onLoginScreen && _d3Disconnected == disconnected && _d3InGame == inGame) return false;
            _d3OnLoginScreen = onLoginScreen;
            _d3Disconnected = disconnected;
            _d3InGame = inGame;
            return true;
        }
    }

    /// <summary>
    /// Set the probed Battle.net client screen state (state, UI region, detail) and the derived dynamic triple atomically.
    /// 1:1 with Python set_battlenet_dynamic_status for the triple; the screen state is DOT-only.
    /// </summary>
    /// <summary>
    /// Only the open game page shows its action button, so each game keeps the last action seen while its nav tab exists
    /// (D3 Play stays known while the D4 page is open); a missing tab clears it.
    /// </summary>
    private static BattlenetGameUi MergeGameUi(BattlenetGameUi previous, BattlenetGameUi current) => current with
    {
        D3Action = current.D3Action != BattlenetGameAction.None ? current.D3Action : current.D3Tab ? previous.D3Action : BattlenetGameAction.None,
        D4Action = current.D4Action != BattlenetGameAction.None ? current.D4Action : current.D4Tab ? previous.D4Action : BattlenetGameAction.None,
    };

    public bool SetBattlenetClientStatus(BattlenetClientStatus status)
    {
        var (onLogin, disconnected, normal) = status.DynamicTriple;
        lock (_lock)
        {
            var gameUi = MergeGameUi(_battlenetGameUi, status.GameUi);
            if (_battlenetClientState == status.State && _battlenetUiRegion == status.UiRegion && _battlenetStateDetail == status.Detail
                && _battlenetGameUi == gameUi
                && _battlenetAccountTag == status.AccountTag && _battlenetAccountPresence == status.AccountPresence
                && _battlenetOnLoginScreen == onLogin && _battlenetDisconnected == disconnected && _battlenetNormalAvailable == normal) return false;
            _battlenetGameUi = gameUi;
            _battlenetAccountTag = status.AccountTag;
            _battlenetAccountPresence = status.AccountPresence;
            _battlenetClientState = status.State;
            _battlenetUiRegion = status.UiRegion;
            _battlenetStateDetail = status.Detail;
            _battlenetOnLoginScreen = onLogin;
            _battlenetDisconnected = disconnected;
            _battlenetNormalAvailable = normal;
            return true;
        }
    }

    /// <summary>Set ROSBOT has main UI (visible when status is paused). 1:1 with Python set_rosbot_has_main_ui.</summary>
    public void SetRosbotHasMainUi(bool hasMainUi)
    {
        lock (_lock)
        {
            _rosbotHasMainUi = hasMainUi;
        }
    }

    /// <summary>Set ROSBOT extended status: not_found | running | paused. 1:1 Python set_rosbot_extended_status.</summary>
    public bool SetRosbotExtendedStatus(string status)
    {
        lock (_lock)
        {
            if (_rosbotExtendedStatus == status) return false;
            _rosbotExtendedStatus = status ?? "not_found";
            return true;
        }
    }

    /// <summary>Set ROSBOT found display (exe name, window title, PID). 1:1 Python set_rosbot_found_display (+ PID).</summary>
    public bool SetRosbotFoundDisplay(string exeName, string? windowTitle, int pid)
    {
        lock (_lock)
        {
            string exe = exeName ?? "";
            string title = windowTitle ?? "";
            if (_rosbotFoundExeName == exe && _rosbotFoundWindowTitle == title && _rosbotFoundPid == pid) return false;
            _rosbotFoundExeName = exe;
            _rosbotFoundWindowTitle = title;
            _rosbotFoundPid = pid;
            return true;
        }
    }

    /// <summary>Set the D3 client process shown in the UI (exe file name and PID; "" / 0 when no window).</summary>
    public bool SetD3Process(string exeName, int pid)
    {
        lock (_lock)
        {
            if (_d3ExeName == exeName && _d3Pid == pid) return false;
            _d3ExeName = exeName;
            _d3Pid = pid;
            return true;
        }
    }

    /// <summary>Set ROSBOT need-key state (from timer/flow). 1:1 with Python set_rosbot_ui_need_key.</summary>
    public void SetRosbotUiNeedKey(bool needKeyInput, string? message = null)
    {
        lock (_lock)
        {
            _rosbotNeedKeyInput = needKeyInput;
            _rosbotNeedKeyMessage = message ?? "";
        }
    }

    /// <summary>Set ROSBOT test mode display line for status bar (each tick when test_mode; null when off); true when changed.</summary>
    public bool SetRosbotTestModeDisplay(string? display)
    {
        lock (_lock)
        {
            if (string.Equals(_rosbotTestModeDisplay, display, StringComparison.Ordinal)) return false;
            _rosbotTestModeDisplay = display;
            return true;
        }
    }

    /// <summary>Set ROSBOT total restart count; true when changed. 1:1 with Python set_rosbot_total_restart_count.</summary>
    public bool SetRosbotTotalRestartCount(int count)
    {
        lock (_lock)
        {
            if (_rosbotTotalRestartCount == count) return false;
            _rosbotTotalRestartCount = count;
            return true;
        }
    }

    /// <summary>Set D3/game window size for status bar (width x height).</summary>
    public void SetStatusWindowSize(int width, int height)
    {
        lock (_lock)
        {
            _windowWidth = width;
            _windowHeight = height;
        }
    }

    /// <summary>Invoke all registered callbacks with current snapshot. Must be called on main thread only, or set MarshalToUi so callbacks are marshaled to UI when called from background.</summary>
    public void NotifyCallbacks()
    {
        if (_marshalToUi != null)
            _marshalToUi(DoNotifyCallbacks);
        else
            DoNotifyCallbacks();
    }

    /// <summary>Runs on current thread. Use via NotifyCallbacks so marshal can run this on UI thread.</summary>
    private void DoNotifyCallbacks()
    {
        var snapshot = GetStateSnapshot();
        List<Action<GameInterfaceStateSnapshot>> copy;
        lock (_lock)
            copy = _callbacks.ToList();
        foreach (var cb in copy)
        {
            try { cb(snapshot); }
            catch { /* ignore */ }
        }
    }

    /// <summary>Set delegate to run NotifyCallbacks on UI thread when called from background. App should pass e.g. action => { if (!dispatcher.CheckAccess()) dispatcher.InvokeAsync(action); else action(); }.</summary>
    public void SetMarshalToUi(Action<Action>? marshal)
    {
        _marshalToUi = marshal;
    }

    /// <summary>Clear cached D3 window client rect. 1:1 Python clear_d3_window_cache. Call when macro stops.</summary>
    public void ClearD3WindowCache()
    {
        lock (_lock) _cachedD3ClientRect = null;
    }

    /// <summary>Get cached D3 client rect if set. 1:1 Python _cached_d3_client_rect for cursor-in-bounds checks. Returns null when cache cleared.</summary>
    public (int Left, int Top, int Right, int Bottom)? GetCachedD3ClientRect()
    {
        lock (_lock) return _cachedD3ClientRect;
    }

    /// <summary>Cache D3 window client rect (screen coords). 1:1 Python refresh_d3_window_cache. Call when macro starts once window hwnd is known.</summary>
    public void RefreshD3WindowCache(int left, int top, int right, int bottom)
    {
        lock (_lock) _cachedD3ClientRect = (left, top, right, bottom);
    }

    // ---------- Assistant capture / bag / Kanai state (1:1 Python D3InterfaceData screenshot, ui_region, bag and interface fields) ----------
    private Bitmap? _gameWindowImage;
    private (int X, int Y) _windowOffset;
    private UiRegion? _uiRegion;
    private string? _timestamp;
    private string? _error;
    private BagCoordinates? _bagCoordinates;
    private BagLayout? _bagLayout;
    private string? _interfaceType;
    private string? _functionalInterface;
    private bool? _kanaiRightPageOpened;
    private TemplateMatchResult? _bagButtomMatch;
    private TemplateMatchResult? _bagLeftMatch;
    private IReadOnlyDictionary<string, DetectionResult>? _buttonDetections;

    /// <summary>
    /// Store the captured game window (cloned; previous image disposed), window offset and scale. 1:1 Python screenshot_provider
    /// filling game_window_image / window_offset / game_window_size then update_global_scale. Returns false when no game window.
    /// </summary>
    public bool UpdateFromScreenshot(ScreenshotData? data)
    {
        if (data?.GameWindowImage == null || !data.GameWindowSize.HasValue) return false;
        var clone = (Bitmap)data.GameWindowImage.Clone();
        Bitmap? old;
        lock (_lock)
        {
            old = _gameWindowImage;
            _gameWindowImage = clone;
            _windowOffset = data.WindowOffset;
        }
        old?.Dispose();
        var (gw, gh) = data.GameWindowSize.Value;
        var (fw, fh) = data.FullscreenSize;
        UpdateGlobalScale(gw, gh, fw, fh);
        return true;
    }

    /// <summary>Copy of the last captured game window image (caller disposes), or null. 1:1 game_window_image.</summary>
    public Bitmap? CloneGameWindowImage()
    {
        lock (_lock) return _gameWindowImage == null ? null : (Bitmap)_gameWindowImage.Clone();
    }

    /// <summary>True when a game window image is stored.</summary>
    public bool HasGameWindowImage
    {
        get { lock (_lock) return _gameWindowImage != null; }
    }

    /// <summary>Game window screen offset (left, top). 1:1 window_offset.</summary>
    public (int X, int Y) WindowOffset
    {
        get { lock (_lock) return _windowOffset; }
    }

    /// <summary>Last captured game window size (0,0 before capture). 1:1 game_window_size.</summary>
    public (int Width, int Height) GameWindowSize
    {
        get { lock (_lock) return (_gameWindowWidth, _gameWindowHeight); }
    }

    public UiRegion? UiRegion { get { lock (_lock) return _uiRegion; } set { lock (_lock) _uiRegion = value; } }
    public string? Timestamp { get { lock (_lock) return _timestamp; } set { lock (_lock) _timestamp = value; } }
    public string? Error { get { lock (_lock) return _error; } set { lock (_lock) _error = value; } }
    public BagCoordinates? BagCoordinates { get { lock (_lock) return _bagCoordinates; } set { lock (_lock) _bagCoordinates = value; } }
    public BagLayout? BagLayout { get { lock (_lock) return _bagLayout; } set { lock (_lock) _bagLayout = value; } }
    /// <summary>"blacksmith" | "kanai_cube" | null.</summary>
    public string? InterfaceType { get { lock (_lock) return _interfaceType; } set { lock (_lock) _interfaceType = value; } }
    /// <summary>"reforge" | "upgrade" | null.</summary>
    public string? FunctionalInterface { get { lock (_lock) return _functionalInterface; } set { lock (_lock) _functionalInterface = value; } }
    /// <summary>Kanai right recipe panel state managed by toggle clicks (null = unknown).</summary>
    public bool? KanaiRightPageOpened { get { lock (_lock) return _kanaiRightPageOpened; } set { lock (_lock) _kanaiRightPageOpened = value; } }
    public TemplateMatchResult? BagButtomMatch { get { lock (_lock) return _bagButtomMatch; } set { lock (_lock) _bagButtomMatch = value; } }
    public TemplateMatchResult? BagLeftMatch { get { lock (_lock) return _bagLeftMatch; } set { lock (_lock) _bagLeftMatch = value; } }
    public IReadOnlyDictionary<string, DetectionResult>? ButtonDetections { get { lock (_lock) return _buttonDetections; } set { lock (_lock) _buttonDetections = value; } }

    /// <summary>1:1 has_ui_region.</summary>
    public bool HasUiRegion() => UiRegion != null;

    /// <summary>1:1 has_bag_data.</summary>
    public bool HasBagData() => BagCoordinates != null;

    // ---------- Global scale (1:1 with Python update_global_scale / get_global_scale) ----------
    /// <summary>Update global scale after game window capture. Call after ScreenshotProvider.Gen(gameWindowHwnd) when GameWindowSize is set.</summary>
    public void UpdateGlobalScale(int actualWindowWidth, int actualWindowHeight, int fullscreenWidth = 0, int fullscreenHeight = 0)
    {
        lock (_lock)
        {
            _gameWindowWidth = actualWindowWidth;
            _gameWindowHeight = actualWindowHeight;
            _fullscreenWidth = fullscreenWidth;
            _fullscreenHeight = fullscreenHeight;

            bool isWindowed = IsWindowedModeInternal();
            double effectiveActualW, effectiveActualH, effectiveStandardW, effectiveStandardH;
            if (isWindowed)
            {
                effectiveActualW = actualWindowWidth - (D3ScaleConstants.WindowBorderLeft + D3ScaleConstants.WindowBorderRight);
                effectiveActualH = actualWindowHeight - (D3ScaleConstants.TitleBarHeight + D3ScaleConstants.WindowBorderBottom);
                effectiveStandardW = D3ScaleConstants.D3StandardResolutionWidth;
                effectiveStandardH = D3ScaleConstants.D3StandardResolutionHeight;
            }
            else
            {
                int th = D3ScaleConstants.WindowHeightThreshold;
                effectiveActualW = actualWindowWidth + th;
                effectiveActualH = actualWindowHeight + th;
                effectiveStandardW = D3ScaleConstants.D3StandardResolutionWidth + th;
                effectiveStandardH = D3ScaleConstants.D3StandardResolutionHeight + th;
            }
            _globalScaleX = effectiveActualW / effectiveStandardW;
            _globalScaleY = effectiveActualH / effectiveStandardH;
        }
    }

    /// <summary>Get current global scale (scale_x, scale_y). 1:1 with Python get_global_scale().</summary>
    public (double ScaleX, double ScaleY) GetGlobalScale()
    {
        lock (_lock)
            return (_globalScaleX, _globalScaleY);
    }

    /// <summary>True when last capture had fullscreen larger than game window by threshold (1:1 Python is_windowed_mode).</summary>
    public bool IsWindowedMode()
    {
        lock (_lock)
            return IsWindowedModeInternal();
    }

    private bool IsWindowedModeInternal()
    {
        if (_fullscreenWidth <= 0 || _fullscreenHeight <= 0 || _gameWindowWidth <= 0 || _gameWindowHeight <= 0)
            return true;
        int wDiff = _fullscreenWidth - _gameWindowWidth;
        int hDiff = _fullscreenHeight - _gameWindowHeight;
        return wDiff >= D3ScaleConstants.WindowHeightThreshold && hDiff >= D3ScaleConstants.WindowHeightThreshold;
    }

    /// <summary>Map standard outer coordinate (e.g. 0..1316, 0..839) to actual window pixel. 1:1 with Python calculate_unified_scaled_coordinate.</summary>
    public (int X, int Y) CalculateUnifiedScaledCoordinate(int stdX, int stdY)
    {
        var borders = new DotCore.Common.Geometry.WindowBorders(
            D3ScaleConstants.WindowBorderLeft, D3ScaleConstants.WindowBorderRight,
            D3ScaleConstants.TitleBarHeight, D3ScaleConstants.WindowBorderBottom);
        lock (_lock)
        {
            // Windowed reuses the global scale (same value as the pure scaler after UpdateGlobalScale; 1.0 before any capture).
            if (IsWindowedModeInternal())
                return DotCore.Common.Geometry.CoordinateScaler.ScaleWithFactors(stdX, stdY, _globalScaleX, _globalScaleY, true, borders);
            return DotCore.Common.Geometry.CoordinateScaler.Scale(
                stdX, stdY, _gameWindowWidth, _gameWindowHeight,
                D3ScaleConstants.D3StandardResolutionWidth, D3ScaleConstants.D3StandardResolutionHeight, false, borders);
        }
    }
}

/// <summary>UI region from the UI collector. 1:1 Python share.game_interface_data.UIRegion.</summary>
public sealed record UiRegion(int X, int Y, int Width, int Height, int UiOffsetX, int UiOffsetY, bool IsFullscreen, string Source);

/// <summary>Template detection with reliability flag and optional state. 1:1 Python share.game_interface_data.DetectionResult.</summary>
public sealed record DetectionResult(TemplateMatchResult Match, bool Reliable = false, string? State = null);
