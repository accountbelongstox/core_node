using System.IO;
using DotCore.Foundations;

namespace DotApps.d3check.Core;

/// <summary>
/// Singleton state center for D3 game interface. Writers: config path checker (dot), later status providers.
/// UI reads via GetStateSnapshot() and callbacks on main thread.
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
    private bool _ensureBattlenetOnlyEnabled;
    private bool _d3Running;
    private string _mapType = "unknown";
    private string _gameStage = "unknown";
    private bool _d3OnLoginScreen = false;
    private bool _d3Disconnected = false;
    private bool _d3InGame = false;
    private bool _battlenetOnLoginScreen = false;
    private bool _battlenetDisconnected = false;
    private bool _battlenetWakingUp;
    private bool _battlenetNormalAvailable;
    private string _rosbotFoundExeName = "";
    private string _rosbotFoundWindowTitle = "";
    private bool _rosbotNeedKeyInput = false;
    private string _rosbotNeedKeyMessage = "";
    private string? _rosbotTestModeDisplay = null;
    private int _rosbotTotalRestartCount = 0;
    private int _windowWidth = 0;
    private int _windowHeight = 0;
    private bool _oauthScriptConnected = false;

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

    public static GameInterfaceData Instance { get; } = new();

    private GameInterfaceData() { }

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
                RosbotFoundExeName = _rosbotFoundExeName,
                RosbotFoundWindowTitle = _rosbotFoundWindowTitle,
                RosbotNeedKeyInput = _rosbotNeedKeyInput,
                RosbotNeedKeyMessage = _rosbotNeedKeyMessage,
                RosbotTestModeDisplay = _rosbotTestModeDisplay,
                RosbotTotalRestartCount = _rosbotTotalRestartCount,
                WindowWidth = _windowWidth,
                WindowHeight = _windowHeight,
                OauthScriptConnected = _oauthScriptConnected,
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
            _pathValidBn = !string.IsNullOrWhiteSpace(battlenetPath) && File.Exists(battlenetPath)
                && string.Equals(Path.GetFileName(battlenetPath), D3PathConstants.BattleNetExeName, StringComparison.OrdinalIgnoreCase);
            _pathValidD3 = !string.IsNullOrWhiteSpace(d3Path) && File.Exists(d3Path)
                && string.Equals(Path.GetFileName(d3Path), D3PathConstants.DiabloIIIExeName, StringComparison.OrdinalIgnoreCase);
            _pathValidRos = !string.IsNullOrWhiteSpace(rosDirectory)
                && (Directory.Exists(rosDirectory) || (File.Exists(rosDirectory) && rosDirectory.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)));
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
    public void SetBattlenetWindowFound(bool found)
    {
        lock (_lock)
        {
            _battlenetWindowFound = found;
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

    /// <summary>Set Battle.net 正常 (ready): has main window and usable. Dot: set from HasWindow() until UI automation provides login/disconnect.</summary>
    public void SetBattlenetNormalAvailable(bool normal)
    {
        lock (_lock)
        {
            _battlenetNormalAvailable = normal;
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

    /// <summary>Set map type from ROSBOT log (e.g. town, echo, firstborn_temple). Returns true if value changed.</summary>
    public bool SetMapType(string mapType)
    {
        lock (_lock)
        {
            string v = string.IsNullOrWhiteSpace(mapType) ? "unknown" : mapType.Trim();
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
            string v = string.IsNullOrWhiteSpace(gameStage) ? "unknown" : gameStage.Trim();
            if (_gameStage == v) return false;
            _gameStage = v;
            return true;
        }
    }

    /// <summary>Set flow master enabled (Start/Stop ROSBOT). Logic 1:1 with Python set_rosbot_flow_master_enabled.</summary>
    public void SetRosbotFlowMasterEnabled(bool enabled)
    {
        lock (_lock)
        {
            if (_rosbotFlowMasterEnabled != enabled)
            {
                _rosbotFlowMasterEnabled = enabled;
                ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetRosbotFlowMasterEnabled(enabled={enabled}).");
            }
        }
    }

    /// <summary>Set Ensure Battle.net only mode (button on/off). Dot: 2s tick loop when enabled (1:1 Python process_task + tick_bn_only_flow).</summary>
    public void SetEnsureBattlenetOnlyEnabled(bool enabled)
    {
        lock (_lock)
        {
            bool changed = _ensureBattlenetOnlyEnabled != enabled;
            _ensureBattlenetOnlyEnabled = enabled;
            if (changed)
                ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetEnsureBattlenetOnlyEnabled(enabled={enabled}).");
        }
    }

    /// <summary>Set D3 running status (window found). 1:1 with Python set_d3_status. Notify callbacks.</summary>
    public void SetD3Status(bool running)
    {
        lock (_lock)
        {
            if (_d3Running != running)
            {
                _d3Running = running;
                ColorPrinter.Gray($"[DEBUG][GameInterfaceData] SetD3Status(running={running}).");
            }
        }
    }

    /// <summary>Set D3 dynamic state (login screen / disconnected / in game). 1:1 with Python set_d3_dynamic_status.</summary>
    public void SetD3DynamicStatus(bool onLoginScreen, bool disconnected, bool inGame)
    {
        lock (_lock)
        {
            _d3OnLoginScreen = onLoginScreen;
            _d3Disconnected = disconnected;
            _d3InGame = inGame;
        }
    }

    /// <summary>Set Battle.net on login screen. 1:1 with Python set_battlenet_dynamic_status.</summary>
    public void SetBattlenetOnLoginScreen(bool onLoginScreen)
    {
        lock (_lock)
        {
            _battlenetOnLoginScreen = onLoginScreen;
        }
    }

    /// <summary>Set Battle.net disconnected. 1:1 with Python set_battlenet_dynamic_status.</summary>
    public void SetBattlenetDisconnected(bool disconnected)
    {
        lock (_lock)
        {
            _battlenetDisconnected = disconnected;
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

    /// <summary>Set ROSBOT found display (exe name and window title). 1:1 Python set_rosbot_found_display.</summary>
    public bool SetRosbotFoundDisplay(string exeName, string? windowTitle)
    {
        lock (_lock)
        {
            string exe = exeName ?? "";
            string title = windowTitle ?? "";
            if (_rosbotFoundExeName == exe && _rosbotFoundWindowTitle == title) return false;
            _rosbotFoundExeName = exe;
            _rosbotFoundWindowTitle = title;
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

    /// <summary>Set ROSBOT test mode display line for status bar. Set each tick when test_mode; null when off.</summary>
    public void SetRosbotTestModeDisplay(string? display)
    {
        lock (_lock)
        {
            _rosbotTestModeDisplay = display;
        }
    }

    /// <summary>Set ROSBOT total restart count. 1:1 with Python set_rosbot_total_restart_count.</summary>
    public void SetRosbotTotalRestartCount(int count)
    {
        lock (_lock)
        {
            _rosbotTotalRestartCount = count;
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

    /// <summary>Set OAuth script connected for status bar.</summary>
    public void SetOauthScriptConnected(bool connected)
    {
        lock (_lock)
        {
            _oauthScriptConnected = connected;
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

    /// <summary>DEBUG: returns (isWindowed, gameWindowW, gameWindowH, effectiveActualW, effectiveActualH, effectiveStandardW, effectiveStandardH). 1:1 Python update_global_scale: windowed = outer - borders/title, fullscreen = actual + threshold.</summary>
    public (bool IsWindowed, int GameWindowW, int GameWindowH, double EffectiveActualW, double EffectiveActualH, double EffectiveStandardW, double EffectiveStandardH) GetScaleDebugInfo()
    {
        lock (_lock)
        {
            bool isWindowed = IsWindowedModeInternal();
            double effAw, effAh, effSw, effSh;
            if (isWindowed)
            {
                effAw = _gameWindowWidth - (D3ScaleConstants.WindowBorderLeft + D3ScaleConstants.WindowBorderRight);
                effAh = _gameWindowHeight - (D3ScaleConstants.TitleBarHeight + D3ScaleConstants.WindowBorderBottom);
                effSw = D3ScaleConstants.D3StandardResolutionWidth;
                effSh = D3ScaleConstants.D3StandardResolutionHeight;
            }
            else
            {
                int th = D3ScaleConstants.WindowHeightThreshold;
                effAw = _gameWindowWidth + th;
                effAh = _gameWindowHeight + th;
                effSw = D3ScaleConstants.D3StandardResolutionWidth + th;
                effSh = D3ScaleConstants.D3StandardResolutionHeight + th;
            }
            return (isWindowed, _gameWindowWidth, _gameWindowHeight, effAw, effAh, effSw, effSh);
        }
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
        lock (_lock)
        {
            bool isWindowed = IsWindowedModeInternal();
            double scaleX = _globalScaleX;
            double scaleY = _globalScaleY;
            int scaledX, scaledY;
            if (isWindowed)
            {
                scaledX = (int)((stdX - D3ScaleConstants.WindowBorderLeft) * scaleX + D3ScaleConstants.WindowBorderLeft);
                scaledY = (int)((stdY - D3ScaleConstants.TitleBarHeight) * scaleY + D3ScaleConstants.TitleBarHeight);
            }
            else
            {
                // Fullscreen: no borders; scale = actual content / standard content; scaled = std * scale (Python line 223-226)
                double fsScaleX = _gameWindowWidth / (double)D3ScaleConstants.D3StandardResolutionWidth;
                double fsScaleY = _gameWindowHeight / (double)D3ScaleConstants.D3StandardResolutionHeight;
                scaledX = (int)(stdX * fsScaleX);
                scaledY = (int)(stdY * fsScaleY);
            }
            return (scaledX, scaledY);
        }
    }
}
