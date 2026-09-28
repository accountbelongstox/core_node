namespace DotApps.d3check.Core;

/// <summary>
/// ROSBOT lookup and flow constants. 1:1 with Python d3utils.rosbot_manager, providor.constants.d3, and d3utils.rosbot_ui_structure.
/// Same-dir exe list (other exes first, then main); exclude patterns; popup window title; cache TTL.
/// UI automation: tab/start button AutomationIds and name candidates from rosbot_ui_structure.json.
/// </summary>
public static class RosbotConstants
{
    // ---------- Lookup / cache (1:1 Python rosbot_manager) ----------
    /// <summary>Popup window title to exclude when resolving main window (e.g. "No items" dialog). 1:1 Python _POPUP_NO_ITEMS_TITLE.</summary>
    public const string PopupNoItemsTitle = "The Vault";

    /// <summary>Lookup result cache TTL seconds. Reuse result for this long to avoid repeated lookup. 1:1 Python _ROSBOT_LOOKUP_CACHE_TTL_SEC = 15.</summary>
    public const double LookupCacheTtlSec = 15.0;

    /// <summary>Default exclude substrings for same-dir other exe (main launcher + installers). 1:1 Python _DEFAULT_EXCLUDE.</summary>
    public static readonly string[] DefaultExcludeSubstrings = { "RoS-BoT.exe", "Uninstall", "setup", "install" };

    /// <summary>Main ROSBOT exe name when config does not specify. 1:1 Python rosbot_exe_name default.</summary>
    public const string DefaultRosbotExeName = "RoS-BoT.exe";

    /// <summary>Search patterns for same-dir other exe files. 1:1 Python other_exe_search_patterns.</summary>
    public static readonly string[] OtherExeSearchPatterns = { "*.exe" };

    // ---------- UI automation (1:1 Python providor.constants.d3 TAB_MAIN_PROFILE_NAMES, START_BUTTON_*, UI_OPERATION_DELAY, etc.) ----------
    /// <summary>Main profile tab name candidates (CN/EN). 1:1 Python TAB_MAIN_PROFILE_NAMES.</summary>
    public static readonly string[] TabMainProfileNames = { "主档案", "主檔案", "Main Profile" };

    /// <summary>Start botting button name candidates. 1:1 Python START_BUTTON_NAMES.</summary>
    public static readonly string[] StartButtonNames = { "Start botting", "Start botting!", "開始掛機", "开始挂机" };

    /// <summary>Start button AutomationId. 1:1 Python START_BUTTON_AUTOMATION_ID and rosbot_ui_structure BTN_START.</summary>
    public const string StartButtonAutomationId = "btnStart";

    /// <summary>Delay (s) between UI operations. 1:1 Python UI_OPERATION_DELAY = 1.0.</summary>
    public const double UiOperationDelaySec = 1.0;

    /// <summary>Server wait seconds after start. 1:1 Python SERVER_WAIT_SECONDS = 10.</summary>
    public const int ServerWaitSeconds = 10;

    /// <summary>Main UI poll timeout (s). 1:1 Python MAIN_UI_POLL_TIMEOUT_SECONDS = 50.</summary>
    public const int MainUiPollTimeoutSeconds = 50;

    /// <summary>Main UI poll interval (s). 1:1 Python MAIN_UI_POLL_INTERVAL_SECONDS = 2.</summary>
    public const int MainUiPollIntervalSeconds = 2;

    /// <summary>F3 log timeout default (minutes). 1:1 Python ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT = 30.</summary>
    public const int RosbotLogTimeoutMinutesDefault = 30;

    // ---------- ROSBOT UI structure AutomationIds (1:1 Python d3utils.rosbot_ui_structure) ----------
    /// <summary>Profile tab control. 1:1 Python TAB_PROFILE automation_id.</summary>
    public const string ProfileTabAutomationId = "profileTab";

    /// <summary>Master profile page pane. 1:1 Python PANE_MAIN_PROFILE automation_id.</summary>
    public const string MasterProfilePageAutomationId = "masterProfilePage";

    /// <summary>Master profile group. 1:1 Python GRP_MASTER_PROFILE automation_id.</summary>
    public const string GrpMasterProfileAutomationId = "grpMasterProfile";

    /// <summary>Global settings button. 1:1 Python BTN_GLOBAL_SETTINGS automation_id.</summary>
    public const string BtnGlobalSettingsAutomationId = "btnGlobalSettings";

    /// <summary>Main menu strip. 1:1 Python MENUBAR_MAIN automation_id.</summary>
    public const string MenuStripAutomationId = "menuStrip1";

    /// <summary>Sequence combo. 1:1 Python CMB_SEQUENCE automation_id.</summary>
    public const string CmbSequenceAutomationId = "cmbSequence";

    // ---------- KEY dialog (1:1 Python rosbot_operation + docs/rosbot_ui_elements_1.json) ----------
    /// <summary>KEY dialog window title when ROSBOT asks for key. 1:1 Python _load_rosbot_key_dialog_signature default "Error".</summary>
    public const string KeyDialogWindowTitleDefault = "Error";

    /// <summary>KEY dialog prompt substring. 1:1 Python key dialog controls name containing "key" -> "enter a key".</summary>
    public const string KeyDialogPromptSubstring = "enter a key";

    /// <summary>Fallback message when need_key_input and i18n not available. 1:1 Python ROSBOT_NEED_KEY_MESSAGE.</summary>
    public const string RosbotNeedKeyMessageFallback = "Key required";
}
