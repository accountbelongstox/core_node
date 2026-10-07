// PY-REF: pyapps/d3-check/d3utils/rosbot_manager.py
// PY-REF: pyapps/d3-check/providor/constants/d3.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_ui_structure.py
// PY-REF: pyapps/d3-check/d3utils/key_send.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_ui_automation.py
// PY-REF: pyapps/d3-check/providor/constants/common.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_operation.py
namespace DotApps.d3d4tester.Core;

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

    /// <summary>F3 log timeout default (minutes) when rosbot.timeout_minutes is missing. Unified with the config/UI default (AppConstants.RosbotTimeoutMinutesDefault = 8); Python constant 30 conflicted with its documented 8 min.</summary>
    public const int RosbotLogTimeoutMinutesDefault = 8;

    /// <summary>F3 test-mode timeout default (minutes). 1:1 Python rosbot.test_timeout_minutes default 30.</summary>
    public const int RosbotTestTimeoutMinutesDefault = 30;

    // ---------- Manager (1:1 Python rosbot_manager / providor.constants.d3) ----------
    /// <summary>Main exe glob patterns after the exact name. 1:1 Python ROSBOT_EXE_PATTERNS.</summary>
    public static readonly string[] RosbotExePatterns = { "ros-bot*.exe", "RoS-BoT*.exe" };

    /// <summary>Default other_exe_exclude_patterns ("*" removed before substring match). 1:1 Python ROSBOTManager default.</summary>
    public static readonly string[] DefaultOtherExeExcludePatterns = { "RoS-BoT.exe", "Uninstall*.exe", "setup*.exe" };

    public const int StartupDelaySecondsDefault = 3;
    public const int ProcessDetectionTimeoutDefault = 30;
    public const int WaitForProcessPollMs = 2000;
    public const int WaitForNewOtherExePollMs = 3000;
    public const int WaitForNewOtherExeTimeoutSec = 60;
    public const int SendF7ActivateDelayMs = 500;
    public const int SendF7HoldMs = 100;
    public const int CleanupF7WaitMs = 1000;
    public const int CleanupPerProcessWaitMs = 500;
    public const int CleanupAfterKillWaitMs = 2000;
    public const string ManagerLogPrefix = "[ROSBOTManager]";

    /// <summary>Virtual key F7 (ROSBOT pause/stop hotkey). 1:1 Python key_send VK_F7.</summary>
    public const ushort VkF7 = 0x76;

    /// <summary>Virtual key F6 (ROSBOT pause toggle used around the unstuck move, RBAssist PRESSKEYANDCLICKWINDOWPOS).</summary>
    public const ushort VkF6 = 0x75;

    /// <summary>Virtual key F9 (ROSBOT hotkey, RBAssist "stop rosbot (F9)").</summary>
    public const ushort VkF9 = 0x78;

    // ---------- Config keys read from Core via RosbotFlowHost (Python providor keys; app ConfigKeys aliases these) ----------

    // ---------- UI automation (1:1 Python rosbot_ui_automation + providor.constants.common) ----------
    /// <summary>AutomationIds identifying the ROSBOT main window by content. 1:1 Python _ROSBOT_MAIN_CONTENT_IDS.</summary>
    public static readonly string[] MainContentAutomationIds = { ProfileTabAutomationId, StartButtonAutomationId };

    public const int MainContentMaxDepth = 8;
    public const int ControlSearchMaxDepth = 10;
    public const int OkButtonSearchMaxDepth = 6;
    public const int AutomationIdSearchMaxDepth = 8;
    public const int NoItemsSearchMaxDepth = 6;
    public const int SequenceFindMaxDepth = 12;
    public const int RiftItemFindMaxDepth = 14;
    public const int DebugDumpMaxDepth = 12;
    public const int DebugDumpNameMaxLength = 80;
    public const int ComboExpandWaitMs = 400;
    public const int RiftItemSelectWaitMs = 250;
    public const int WindowPollIntervalMs = 1000;
    public const int RestoreAfterActivateMs = 1000;

    /// <summary>1:1 Python UI_AUTOMATION_ID_OK_BUTTON.</summary>
    public const string OkButtonAutomationId = "OKButton";

    /// <summary>1:1 Python UI_AUTOMATION_ID_TEXT_BOX.</summary>
    public const string TextBoxAutomationId = "TextBox";

    /// <summary>1:1 Python UI_NAME_KEYWORDS_OK.</summary>
    public static readonly string[] OkNameKeywords = { "OK", "确定" };

    /// <summary>1:1 Python UI_NAME_KEYWORDS_NO_ITEMS.</summary>
    public static readonly string[] NoItemsNameKeywords = { "No items", "无物品" };

    /// <summary>"D3 must be launched" dialog max size. 1:1 Python _D3_MUST_LAUNCH_DIALOG_MAX_WIDTH/HEIGHT.</summary>
    public const int MustLaunchDialogMaxWidth = 600;
    public const int MustLaunchDialogMaxHeight = 280;

    /// <summary>Rift mode list item names (dropdown expanded). 1:1 Python LIST_ITEM_RIFT_MODE name_contains.</summary>
    public static readonly string[] RiftModeListItemNames = { "大小秘境", "秘境", "Rift" };

    /// <summary>Local profile tab names. 1:1 Python TAB_ITEM_LOCAL name_candidates.</summary>
    public static readonly string[] TabLocalProfileNames = { "本地档案", "本地檔案", "Local", "Local Profile" };

    /// <summary>Debug dump directory name under the app temp dir. 1:1 Python ROSBOT_UI_DEBUG_DIR = TMP_DIR / "debug".</summary>
    public const string UiDebugDirName = "debug";
    public const string UiDebugFilePrefix = "rosbot_ui_structure_";

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

    /// <summary>KEY dialog child classes (WinForms "WindowsForms10.EDIT.app..." / Win32 "Edit", same for BUTTON), matched case-insensitively.</summary>
    public const string KeyDialogEditClassToken = "edit";
    public const string KeyDialogButtonClassToken = "button";

    /// <summary>KEY dialogs filled with one key before it is treated as rejected (ROSBOT asks again after a wrong key).</summary>
    public const int KeyDialogMaxFills = 3;

    /// <summary>Pause between typing the key and pressing OK, and the poll step of stoppable waits.</summary>
    public const int KeyDialogSettleMs = 300;
    public const int StoppableWaitStepMs = 500;

    /// <summary>Fallback message when need_key_input and i18n not available. 1:1 Python ROSBOT_NEED_KEY_MESSAGE.</summary>
    public const string RosbotNeedKeyMessageFallback = "Key required";
}
