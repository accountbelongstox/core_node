// PY-REF: pyapps/d3-check/main.py
// PY-REF: pyapps/d3-check/providor/constants/d3.py
// PY-REF: pyapps/d3-check/controller/game_interface_controller.py
// PY-REF: pyapps/d3-check/ui/components/auxiliary_options_block.py
namespace DotApps.d3d4tester.Constants;

/// <summary>
/// App-wide constants: panel keys, UI defaults, client type, region, log levels, timing.
/// Align with Python providor.constants (common, d3) and main.py usage.
/// </summary>
public static class AppConstants
{
    // ---------- App identity (runtime data dir under LocalApplicationData; user config stays shared with Python d3-check) ----------
    public const string AppDataDirName = "d3d4tester";
    public const string AppProjectFileName = "d3d4tester.csproj";

    // ---------- Tab / page keys (MainWindow GetPage, tab content) ----------
    public const string PanelKeyMain = "main";
    public const string PanelKeyRosbot = "rosbot";
    public const string PanelKeyD4 = "d4";
    public const string PanelKeyCalibration = "calibration";
    public const string PanelKeyLog = "log";
    public const int TabIndexMain = 0;
    public const int TabIndexRosbot = 1;
    public const int TabIndexD4 = 2;
    public const int TabIndexCalibration = 3;
    public const int TabIndexLog = 4;
    public const int TabCount = 5;

    // ---------- Popup keys (UiRegistry.RegisterPopup/GetPopup; 1:1 Python POPUP_KEY_*) ----------
    public const string PopupKeyDebugWindow = "debug_window";

    // ---------- Default hotkeys (1:1 Python game_interface_controller fallback when key missing) ----------
    public const string DefaultMacroStartHotkey = "F9";
    public const string DefaultAssistantHotkey = "F10";
    public const string DefaultQuickSwitchHotkey = "F1";

    // ---------- UI defaults: preset window size for title-bar "Restore" button and config fallback (single source of truth) ----------
    public const int DefaultWindowWidth = 800;
    public const int DefaultWindowHeight = 600;
    public const int DefaultWindowLeft = 100;
    public const int DefaultWindowTop = 100;
    /// <summary>Geometry string WxH+X+Y for ParseGeometry; built from the four constants above.</summary>
    public static readonly string DefaultWindowGeometry = $"{DefaultWindowWidth}x{DefaultWindowHeight}+{DefaultWindowLeft}+{DefaultWindowTop}";

    // ---------- Coord calibration / client type (config value: coord_calibration.client_type) ----------
    public const string ClientTypeBattlenet = "battlenet";
    public const string ClientTypeD3Game = "d3_game";
    public const string ClientTypeD4Game = "d4_game";

    // ---------- Battle.net region (ros_settings.battlenet_region_cache, flow) ----------
    public const string RegionAsia = "asia";
    public const string RegionCn = "cn";

    // ---------- Log level (config: log_settings.log_level) ----------
    public const string LogLevelDebug = "DEBUG";
    public const string LogLevelInfo = "INFO";
    public const string LogLevelWarning = "WARNING";
    public const string LogLevelError = "ERROR";
    public const string LogLevelCritical = "CRITICAL";
    public const string LogLevelDefault = "INFO";

    // ---------- Rosbot panel defaults (same as Python d3.py ROSBOT_*_DEFAULT where applicable) ----------
    public const int RosbotSmartEchoWaitSecondsDefault = 15;
    public const int RosbotTestTimeoutMinutesDefault = 30;
    public const int RosbotTimeoutMinutesDefault = 8;

    // ---------- Bag offset input (1:1 Python auxiliary_options_block _OFFSET_MIN/_OFFSET_MAX) ----------
    public const int BagOffsetMin = -500;
    public const int BagOffsetMax = 500;

    // ---------- OAuth script ping (1:1 Python OAUTH_SCRIPT_PING_TIMEOUT_SEC) ----------
    public const double OauthScriptPingTimeoutSec = 30.0;

    // ---------- Battle.net window wait (flow / login: poll until BN window appears) ----------
    public const int WaitForBnWindowMs = 500;
    public const int WaitForBnWindowMaxAttempts = 30;

    // ---------- B block (ROSBOT_FLOW_MERMAID): B3w wait after start, B7 poll interval, B11 browser OCR timeout, B5w after exit ----------
    /// <summary>B3w: wait ms after starting Battle.net before polling UI.</summary>
    public const int B3wWaitAfterStartMs = 3000;
    /// <summary>B7/B11: poll interval ms when waiting for UI or browser OAuth.</summary>
    public const int B7B11PollIntervalMs = 2000;
    /// <summary>B11: max ms to wait for browser OAuth / BN main UI after B10 (NetEase click).</summary>
    public const int B11BrowserWaitTimeoutMs = 30000;
    /// <summary>B5w: wait ms after killing Battle.net before re-entering B1.</summary>
    public const int B5wExitWaitMs = 2000;
    /// <summary>B7: max ms to wait for operable UI after B3w (no elements yet). 1:1 Python BN_FLOW_POLL_TIMEOUT_SEC = 120.</summary>
    public const int B7WaitForUiTimeoutMs = 120 * 1000;
    /// <summary>B7: after this many skips (no operable elements), trigger D block (D3 tab + Play). 1:1 Python B7_TRIGGER_D_AFTER_SKIPS = 6.</summary>
    public const int B7TriggerDAfterSkips = 6;
    /// <summary>B7: min seconds between two D-block triggers. 1:1 Python B7_TRIGGER_D_COOLDOWN_SEC = 30.</summary>
    public const double B7TriggerDCooldownSec = 30.0;
}
