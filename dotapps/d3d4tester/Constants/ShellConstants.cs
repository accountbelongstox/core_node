// PY-REF: pyapps/d3-check/ui/diablo3_macro_ui.py
// PY-REF: pyapps/d3-check/ui/components/system_tray.py
// PY-REF: pyapps/d3-check/main.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_update_manager.py
// PY-REF: pyapps/d3-check/share/oauth_callback.py
// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
namespace DotApps.d3d4tester.Constants;

/// <summary>
/// Main window shell constants: identity, window behavior, tray, HTTP bridge, path scan and ROSBOT update timings.
/// 1:1 Python ui/diablo3_macro_ui.py, ui/components/system_tray.py, main.py, d3utils/rosbot_update_manager.py.
/// </summary>
public static class ShellConstants
{
    // ---------- Identity / icon ----------
    public const string AppUserModelId = "pycore.d3check.1.0";
    public const string DefaultAppIconPackUri = "pack://application:,,,/d3d4tester;component/Assets/app_icon.ico";

    // ---------- Main window (Python root.minsize(670, 400), debounced geometry save 800 ms, first-run topmost 500 ms) ----------
    public const int MinWindowWidth = 670;
    public const int MinWindowHeight = 400;
    public const int GeometrySaveDebounceMs = 800;
    public const int FirstRunTopmostMs = 500;

    // ---------- Tray (Python root.after(500, start_system_tray_if_needed)) ----------
    public const int TrayStartDelayMs = 500;

    // ---------- Config switch beep (Python winsound.Beep(1000, 100)) ----------
    public const int ConfigSwitchBeepFrequency = 1000;
    public const int ConfigSwitchBeepDurationMs = 100;

    // ---------- Path scan (Python _submit_path_scan_if_throttle_ok 5 s, startup root.after(800)) ----------
    public const double PathScanThrottleSec = 5.0;
    public const int StartupPathScanDelayMs = 800;

    // ---------- HTTP bridge (Python main.py --http-bridge-only / --host / --port) ----------
    public const string ArgHttpBridgeOnly = "--http-bridge-only";
    public const string ArgHost = "--host";
    public const string ArgPort = "--port";
    public const string HttpBridgeServerVersion = "1.0.0";

    // ---------- OAuth callback (Python share/oauth_callback.py OAUTH_STEP1_VALID_SEC) ----------
    public const double OauthStep1ValidSec = 120.0;

    // ---------- ROSBOT update (Python rosbot_update_manager / one_shot_tasks.do_rosbot_update) ----------
    public const int RosbotNestedZipMaxDepth = 5;
    public const int RosbotConfigVerifyAttempts = 10;
    public const int RosbotConfigVerifyIntervalMs = 100;
    public const int RosbotUpdateKillWaitMs = 1000;
    public const int RosbotUpdateZipPreviewCount = 5;
    public const bool RosbotCheckBothRegionsDefault = true;
    public const string RosbotIniFileName = "RoS-BoT.ini";
    public const string RosbotNestedZipKeyword1 = "ros-bot";
    public const string RosbotNestedZipKeyword2 = "rosbot";
    public const string TempDeleteSuffix = ".tmp_delete";
    public const string UnknownVersion = "unknown";
}
