// PY-REF: pyapps/d3-check/main.py
// PY-REF: pyapps/d3-check/providor/constants/d3.py
// PY-REF: pyapps/d3-check/controller/game_interface_controller.py
// PY-REF: pyapps/d3-check/ui/components/auxiliary_options_block.py
// PY-REF: pyapps/d3-check/share/values/skill_config_hotkeys.py
// PY-REF: pyapps/d3-check/providor/constants/ui.py
namespace DotApps.d3d4tester.Constants;

/// <summary>
/// App-wide constants: panel keys, UI defaults, client type, region, log levels, timing.
/// Align with Python providor.constants (common, d3) and main.py usage.
/// </summary>
public static class AppConstants
{
    // ---------- App identity (runtime data dir under LocalApplicationData; user config stays shared with Python d3-check) ----------
    public const string AppDataDirName = "d3d4tester";

    // ---------- Tab / page keys (MainWindow GetPage, tab content) ----------
    public const string PanelKeyMain = "main";
    public const string PanelKeyD4 = "d4";
    public const string PanelKeyCalibration = "calibration";
    public const string PanelKeyLog = "log";
    public const string PanelKeyBattlenet = "battlenet";
    public const string PanelKeyMonitor = "monitor";
    public const int TabIndexMain = 0;
    public const int TabIndexD4 = 1;
    public const int TabIndexCalibration = 2;
    /// <summary>Battle.net management sits before the log; the control center (monitor + test) follows it; the log tab is always last.</summary>
    public const int TabIndexBattlenet = 3;
    public const int TabIndexMonitor = 4;
    public const int TabIndexLog = 5;
    public const int TabCount = 6;

    // ---------- Popup keys (UiRegistry.RegisterPopup/GetPopup; 1:1 Python POPUP_KEY_*) ----------
    public const string PopupKeyDebugWindow = "debug_window";

    // ---------- Default hotkeys (1:1 Python game_interface_controller fallback when key missing) ----------
    public const string DefaultMacroStartHotkey = "F2";
    public const string DefaultAssistantHotkey = "F3";
    /// <summary>Per-config hotkey default (macro_configs.skill_configs.&lt;name&gt;.quick_switch). 1:1 Python PER_CONFIG_HOTKEY_SPEC.</summary>
    public const string DefaultQuickSwitchHotkey = "F1";

    /// <summary>Separator between parts of one status text (status bar, Monitor and Battle.net tabs).</summary>
    public const string DisplaySeparator = " · ";

    /// <summary>Default custom force-stand key (macro_configs.auxiliary_config.custom_stand_key).</summary>
    public const string DefaultCustomStandKey = "Shift";

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

    // ---------- Log level (config: log_settings.log_level) ----------
    public const string LogLevelDebug = "DEBUG";
    public const string LogLevelInfo = "INFO";
    public const string LogLevelWarning = "WARNING";
    public const string LogLevelError = "ERROR";
    public const string LogLevelCritical = "CRITICAL";
    public const string LogLevelDefault = LogLevelInfo;

    // ---------- Rosbot panel defaults (same as Python d3.py ROSBOT_*_DEFAULT where applicable) ----------

    // ---------- Bag offset input (1:1 Python auxiliary_options_block _OFFSET_MIN/_OFFSET_MAX) ----------
    public const int BagOffsetMin = -500;
    public const int BagOffsetMax = 500;
}
