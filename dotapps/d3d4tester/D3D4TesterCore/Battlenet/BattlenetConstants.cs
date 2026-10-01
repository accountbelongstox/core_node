namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net UI constants. Prefer AutomationId; only when no AutomationId in uidocs (or lookup fails) fall back to keyword.
/// Values from uidocs: 战网登录_8914CEDB, 战网_CB2F804E, 战网_85BFA152.
/// </summary>
public static class BattlenetConstants
{
    // ---------- CN login (uidocs 战网登录_8914CEDB) — AutomationId first; keyword fallback when not found ----------
    public const string CnAgreeAutomationId = "legalAcceptance";
    /// <summary>Fallback when AutomationId not found. CheckBox Name contains.</summary>
    public static readonly string[] CnAgreeKeywordsFallback = { "您同意" };
    public const string CnNetEaseAutomationId = "ntes";
    public static readonly string[] CnNetEaseLoginKeywordsFallback = { "使用网易账号登录或注册" };
    public const string CnConnectAccountsAutomationId = "connectAccounts";
    public const double CnAfterNetEaseClickSettleSec = 0.5;

    // ---------- CN pre-login window (uidocs: 战网登录_8914CEDB) ----------
    public const string CnPreLoginWindowAutomationId = "LoginWindow";
    public const string CnPreLoginWindowClassName = "Phoenix::LoginWindow";
    public static readonly string[] CnPreLoginTitleKeywords = { "战网登录", "Login" };

    // ---------- CN browser confirmation (uidocs: 战网_CB2F804E) ----------
    public const string CnBrowserConfirmWindowAutomationId = "LoginPopupWindow";
    public const string CnBrowserConfirmWindowClassName = "Phoenix::LoginPopupWindow";
    public static readonly string[] CnBrowserLoginWindowTitleKeywords = { "战网登录", "战网", "Loading", "Login", "网易账号登录" };
    public static readonly string[] CnBrowserSuccessOcrKeywords = { "现在可以返回战网游戏或应用程序", "现在可以返回战网", "return to Battle.net", "return to" };

    // ---------- CN browser login OCR (B11, 1:1 Python browser_login_ocr_flow) ----------
    /// <summary>EULA label text for OCR match. 1:1 Python EULA_LABEL_SUBSTR.</summary>
    public static readonly string[] BrowserOcrEulaKeywords = { "我接受暴雪战网最终用户许可协议" };
    /// <summary>Agree button text. 1:1 Python AGREE_BTN_SUBSTR.</summary>
    public static readonly string[] BrowserOcrAgreeKeywords = { "同意" };
    /// <summary>Cancel button (exclude from agree). 1:1 Python CANCEL_BTN_SUBSTR.</summary>
    public static readonly string[] BrowserOcrCancelKeywords = { "取消" };
    /// <summary>Login button text. 1:1 Python LOGIN_BTN_SUBSTR.</summary>
    public static readonly string[] BrowserOcrLoginKeywords = { "登录" };
    /// <summary>Center region of browser for OCR: width/height ratio. 1:1 Python CENTER_REGION_*_RATIO = 0.8.</summary>
    public const double BrowserOcrCenterWidthRatio = 0.8;
    public const double BrowserOcrCenterHeightRatio = 0.8;
    /// <summary>Delay (s) after activating browser before capture. 1:1 Python ACTIVATE_BEFORE_CAPTURE_DELAY_SEC.</summary>
    public const double BrowserOcrActivateDelaySec = 0.3;
    /// <summary>Poll interval (s) between OCR attempts. 1:1 Python POLL_INTERVAL_SEC.</summary>
    public const double BrowserOcrPollIntervalSec = 2.0;
    /// <summary>Timeout (s) for browser login OCR flow. 1:1 Python BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC.</summary>
    public const double BrowserOcrTimeoutSec = 300.0;

    // ---------- Login screen: AutomationId first; keyword fallback only when no AutomationId found ----------
    public static readonly string[] LoginWindowAutomationIdMarkersCn = { "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper", "login-header", "legalAcceptance", "ntes", "connectAccounts" };
    public static readonly string[] LoginWindowAutomationIdMarkersAsia = { "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper", "login-header", "legalAcceptance", "connectAccounts" };
    /// <summary>Fallback when no AutomationId marker in tree (CN).</summary>
    public static readonly string[] LoginScreenKeywordsFallbackCn = { "需要登陆", "请登录", "您同意", "使用网易账号登录或注册" };
    public static readonly string[] LoginScreenKeywordsFallbackAsia = { "Log in", "Sign in", "請登入", "登入" };

    // ---------- Disconnect / connecting: no AutomationId in uidocs — keyword only ----------
    public static readonly string[] DisconnectKeywords = { "Retry", "重试" };
    public static readonly string[] ConnectingKeywords = { "Connecting", "连接中" };

    // ---------- Login failed (Continue Offline / Cancel): primary + secondary both required; exclude browser-wait. 1:1 Python BATTLE_NET_LOGIN_FAILED_*. ----------
    /// <summary>Primary keywords (e.g. Continue Offline, 继续离线). Must have at least one.</summary>
    public static readonly string[] LoginFailedPrimaryKeywords = { "Continue Offline", "继续离线" };
    /// <summary>Secondary keywords (e.g. Cancel, 取消). Must have at least one. Together with primary = login failed screen.</summary>
    public static readonly string[] LoginFailedSecondaryKeywords = { "Cancel", "取消" };

    // ---------- Browser login wait popup: exit BN when this is shown. 1:1 Python BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS. ----------
    /// <summary>Main keyword for "Complete login in browser" popup. When present -> B5 exit.</summary>
    public static readonly string[] BrowserLoginWaitMainKeywords = { "使用浏览器完成登录" };

    // ---------- In-UI popup close: ButtonControl only. 1:1 Python BATTLE_NET_POPUP_CLOSE_AUTOMATION_IDS / BATTLE_NET_POPUP_CLOSE_NAME_KEYWORDS (UI_NAME_KEYWORDS_CLOSE). ----------
    public static readonly string[] PopupCloseAutomationIds = { "winCloseButton" };
    public static readonly string[] PopupCloseNameKeywords = { "Close", "关闭" };
    public const string PopupCloseControlType = "ButtonControl";
    /// <summary>AutomationId substrings that identify the main window title-bar (X button). When automation_id contains any of these AND "winCloseButton", do NOT click (would close whole client). 1:1 Python BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS.</summary>
    public static readonly string[] MainWindowCloseAutomationIdSubstrings = { "topLayerContainer.TopLayer.buttonContainer" };

    // ---------- Sleep mode (uidocs: 战网_85BFA152) — Group announcer contains sleep message ----------
    /// <summary>AutomationId of Group that contains "战网更新服务进入了睡眠模式。正在尝试唤醒它…". Detection by AutomationId only.</summary>
    public const string SleepModeAnnouncerAutomationId = "announcer";
    public static readonly string[] SleepModeAutomationIdMarkers = { "announcer" };

    // ---------- Fetching / Loading account info (stuck state, EN/CN). Reddit/Blizzard: "Fetching account info", "Loading", 读取中, 获取信息. ----------
    /// <summary>UI text indicating Battle.net is fetching/loading account info (stuck state). Match when any present. Case-insensitive for EN.</summary>
    public static readonly string[] FetchingAccountInfoKeywords = { "Fetching", "Loading", "account info", "Loading account", "Please wait", "读取中", "获取信息", "正在获取", "正在读取", "载入中" };

    // ---------- Stuck recovery: cache cleanup only after this duration (seconds). Reddit/Blizzard: cache corruption causes sleep/loading loop. ----------
    /// <summary>When stuck in sleep or fetching/loading account info for this many seconds, trigger cache cleanup. 5 minutes.</summary>
    public const double StuckCleanupDelaySec = 300.0;
    /// <summary>Main nav container (uidocs 战网_85BFA152).</summary>
    public const string MainNavContainerAutomationId = "main-nav-container";
    public const string NotificationPillAutomationId = "notification-pill";
    public const string AvatarEditButtonAutomationId = "avatar-edit-button";
    public const string DockControlBtnAutomationId = "dock-control-btn";
    public const string AddFriendAutomationId = "add-friend";
    public const string FriendFilterAutomationId = "friend-filter";
    public const string HostAnchorAutomationId = "host-anchor";
    public const string CollapseSocialPanelButtonAutomationId = "collapse-social-panel-button";

    // ---------- Asia login fields: AutomationId first; keyword fallback when not found ----------
    public const string AsiaLoginAccountAutomationId = "accountName";
    public const string AsiaLoginPasswordAutomationId = "password";
    public const string AsiaLoginSubmitAutomationId = "submit";
    public static readonly string[] AsiaLoginAccountAutomationIds = { "accountName" };
    public static readonly string[] AsiaLoginPasswordAutomationIds = { "password" };
    public static readonly string[] AsiaLoginSubmitAutomationIds = { "submit" };
    public static readonly string[] AsiaLoginAccountKeywordsFallback = { "email", "電子郵件", "信箱", "account", "帳號", "phone", "電話" };
    public static readonly string[] AsiaLoginPasswordKeywordsFallback = { "密碼", "密码", "Password", "密碼欄位" };
    public static readonly string[] AsiaLoginSubmitKeywordsFallback = { "登入", "登录", "Log in", "Sign in" };

    // ---------- D3 tab / Play CN: AutomationId first; keyword fallback when not found ----------
    public const string D3TabAutomationIdCnPrimary = "game-nav-btn-D3CN";
    public const string D3TabAutomationIdCnSecondary = "game-nav-btn-D3";
    public static readonly string[] D3TabAutomationIdsCn = { "game-nav-btn-D3CN", "game-nav-btn-D3" };
    public static readonly string[] D3TabNameKeywordsFallbackCn = { "Diablo III", "暗黑破坏神", "暗黑破壞神", "Diablo" };
    public const string StartGameAutomationIdCnPrimary = "play-btn-main";
    public const string StartGameAutomationIdCnSecondary = "play-btn";
    public static readonly string[] StartGameAutomationIdsCn = { "play-btn-main", "play-btn" };
    public static readonly string[] StartGameNameKeywordsFallbackCn = { "Play", "开始游戏", "開始遊戲", "Playing Now" };

    // ---------- D3 tab / Play Asia: AutomationId first; keyword fallback when not found ----------
    public const string D3TabAutomationIdAsia = "game-nav-btn-D3";
    public static readonly string[] D3TabAutomationIdsAsia = { "game-nav-btn-D3" };
    public static readonly string[] D3TabNameKeywordsFallbackAsia = { "Diablo III", "暗黑破壞神", "Diablo" };
    public static readonly string[] StartGameAutomationIdsAsia = { "play-btn-main", "play-btn" };
    public static readonly string[] StartGameNameKeywordsFallbackAsia = { "Play", "開始遊戲", "Playing Now" };

    // ---------- Asia login step rules. 1:1 Python ASIA_LOGIN_* ----------
    public static readonly string[] AsiaLoginContinueNameKeywords = { "繼續", "继续", "Continue", "Next", "下一步" };
    public static readonly string[] AsiaLoginSwitchAccountKeywords = { "切換帳號", "切换账号", "Switch account" };
    public const bool AsiaLoginDebugInput = true;
    public const double AsiaFieldAfterFocusSec = 0.2;
    public const double AsiaFieldInputIntervalMinSec = 0.05;
    public const double AsiaFieldInputIntervalMaxSec = 0.15;
    public const double AsiaPasswordReenumerateDelaySec = 0.5;
    public const double AsiaAfterFieldFillSec = 0.15;

    // ---------- CN login button. 1:1 Python BATTLE_NET_CN_LOGIN_BUTTON_* (+ "Login") ----------
    public static readonly string[] CnLoginButtonAutomationIds = Array.Empty<string>();
    public static readonly string[] CnLoginButtonKeywords = { "登陆", "登录", "Login" };

    // ---------- Detection by AutomationId (empty in uidocs) then keyword. 1:1 Python BATTLE_NET_*_AUTOMATION_IDS ----------
    public static readonly string[] DisconnectAutomationIds = Array.Empty<string>();
    public static readonly string[] ConnectingAutomationIds = Array.Empty<string>();
    public static readonly string[] BrowserLoginWaitAutomationIds = Array.Empty<string>();
    public static readonly string[] LoginFailedPrimaryAutomationIds = Array.Empty<string>();
    public static readonly string[] LoginFailedSecondaryAutomationIds = Array.Empty<string>();

    // ---------- Loading UI: TextControl whose name contains a substring. 1:1 Python BATTLE_NET_LOADING_INDICATOR_* ----------
    public const string LoadingIndicatorControlType = "TextControl";
    public const string LoadingIndicatorControlTypeShort = "Text";
    public static readonly string[] LoadingIndicatorNameSubstrings = { "Update Agent", "wake it up", "Attempting to wake", "战网", "载入", "正在启动", "正在载入" };

    /// <summary>Play button text meaning the game is starting/running. 1:1 Python play_button_indicates_starting.</summary>
    public static readonly string[] PlayStartingNameSubstrings = { "Playing Now", "正在" };
    /// <summary>Play label "Playing" substrings for B9/B13 logs.</summary>
    public static readonly string[] PlayPlayingNameSubstrings = { "Playing", "正在" };
    /// <summary>Tab names that are not the game tab. 1:1 Python click_d3_tab exclusions.</summary>
    public static readonly string[] GameTabExcludedNameSubstrings = { "Playing Now", "Game Version" };

    // ---------- D4 tab (CN and Asia). 1:1 Python providor/constants/d4.py ----------
    public static readonly string[] D4TabAutomationIdsCn = { "game-nav-btn-D4CN", "game-nav-btn-D4" };
    public static readonly string[] D4TabNameKeywordsCn = { "Diablo IV", "暗黑破坏神IV", "暗黑破壞神IV", "IV》" };
    public static readonly string[] D4TabAutomationIdsAsia = { "game-nav-btn-D4" };
    public static readonly string[] D4TabNameKeywordsAsia = { "Diablo IV", "暗黑破壞神IV", "IV》" };

    // ---------- Control tree / click. 1:1 Python battlenet_operation_base ----------
    public const string BattlenetExeName = "Battle.net.exe";
    public const int ControlTreeMaxDepth = 25;
    public const double ControlsLightCacheTtlSec = 2.0;
    public const double ClickMoveDurationSec = 0.0;
    public const double ClickPauseAfterMoveSec = 0.0;
    public const int ActivateSettleMs = 200;
    public const int KillWaitTimeoutSec = 15;

    // ---------- UI snapshots. 1:1 Python BN_FLOW_SNAPSHOTS_DIR / DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS ----------
    public const bool DebugSaveBnFlowUiSnapshots = false;
    public const string BnFlowSnapshotsDirName = "bn_flow_snapshots";
    public const string CacheDirName = ".cache";
    public const string BnFlowSnapshotFilePrefix = "bn_flow_";

    // ---------- BN flow timings. 1:1 Python BN_FLOW_* / flow_bn_block_state ----------
    public const double FlowWaitAfterStartSec = 3.0;
    public const double FlowPollTimeoutSec = 120.0;
    public const double FlowOauthWaitSec = 120.0;
    public const double FlowExitWaitSec = 2.0;
    public const double FlowWaitPlaySec = 8.0;
    public const int B7TriggerDAfterSkips = 6;
    public const double B7TriggerDCooldownSec = 30.0;
    public const double B11TickIntervalSec = 2.0;
    public static readonly int B11MaxTicks = Math.Max(1, (int)(BrowserOcrTimeoutSec / B11TickIntervalSec));

    public const string RegionAsia = "asia";
    public const string RegionCn = "cn";
}
