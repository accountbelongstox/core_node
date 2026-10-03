// PY-REF: pyapps/d3-check/providor/constants/d4.py
// PY-REF: pyapps/d3-check/d3utils/browser_login_ocr_flow.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_block_state.py
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
    public static readonly string[] CnPreLoginTitleKeywords = { "战网登录", "Login" };

    // ---------- CN browser confirmation (uidocs: 战网_CB2F804E) ----------
    public const string CnBrowserConfirmWindowClassName = "Phoenix::LoginPopupWindow";
    public static readonly string[] CnBrowserLoginWindowTitleKeywords = { "战网登录", "战网", "Loading", "Login", "网易账号登录" };

    // ---------- Web login automation (B11, BrowserLoginAutomation; replaces OCR clicks + Tampermonkey callback) ----------
    /// <summary>Page text after a successful web login.</summary>
    public static readonly string[] BrowserLoginSuccessKeywords = { "现在可以返回战网游戏或应用程序", "现在可以返回战网", "return to Battle.net" };
    /// <summary>EULA checkbox label.</summary>
    public static readonly string[] BrowserLoginEulaKeywords = { "我接受暴雪战网最终用户许可协议", "最终用户许可协议", "End User License Agreement" };
    public static readonly string[] BrowserLoginAgreeKeywords = { "同意", "Accept", "Agree" };
    /// <summary>Never click these (cancel / reject next to agree / login).</summary>
    public static readonly string[] BrowserLoginRejectKeywords = { "取消", "不同意", "拒绝", "Cancel", "Decline" };
    public static readonly string[] BrowserLoginSubmitKeywords = { "登录", "登 录", "登入", "Log in", "Log In", "Sign in" };
    /// <summary>Password field name fallback when the UIA IsPassword property is not exposed.</summary>
    public static readonly string[] BrowserLoginPasswordKeywords = { "密码", "密碼", "Password" };
    /// <summary>Web login step timeout (s) before exiting Battle.net (B11 -> B5).</summary>
    public const double BrowserLoginTimeoutSec = 300.0;

    // ---------- Login screen: AutomationId first; keyword fallback only when no AutomationId found ----------
    public static readonly string[] LoginWindowAutomationIdMarkersCn = { "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper", "login-header", "legalAcceptance", "ntes", "connectAccounts" };
    public static readonly string[] LoginWindowAutomationIdMarkersAsia = { "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper", "login-header", "legalAcceptance", "connectAccounts" };
    /// <summary>Fallback when no AutomationId marker in tree (CN).</summary>
    public static readonly string[] LoginScreenKeywordsFallbackCn = { "需要登陆", "请登录", "您同意", "使用网易账号登录或注册" };
    public static readonly string[] LoginScreenKeywordsFallbackAsia = { "Log in", "Sign in", "請登入", "登入" };

    // ---------- Disconnect / connecting: no AutomationId in uidocs — keyword only ----------
    public static readonly string[] DisconnectKeywords = { "Retry", "重试" };
    public static readonly string[] ConnectingKeywords = { "Connecting", "连接中", "正在连接" };

    // ---------- Client state probe (BattlenetClientStateDetector; verified by tools/BnProbe live scans and docs/uidocs) ----------
    public const string ButtonControlType = "ButtonControl";
    /// <summary>In-page modal popups (live scan: welcome-screen-modal "Explore your favorite games..." with Continue / Close).</summary>
    public const string ModalAutomationIdSuffix = "-modal";
    public static readonly string[] ModalCloseNames = { "Close", "关闭", "關閉" };
    /// <summary>Play label game names (live scan CN: "Play: Diablo III, Version: 2.8.1.101167").</summary>
    public static readonly string[] D3PlayLabelKeywords = { "Diablo III", "暗黑破坏神III", "暗黑破壞神III", "暗黑破坏神Ⅲ" };
    public static readonly string[] D4PlayLabelKeywords = { "Diablo IV", "暗黑破坏神IV", "暗黑破壞神IV", "暗黑破坏神Ⅳ" };
    /// <summary>Main-window Play button has no AutomationId in live scans; its Name starts with these (e.g. "Play: Diablo III, Version: ...").</summary>
    public static readonly string[] PlayButtonNamePrefixes = { "Play", "开始游戏", "開始遊戲", "正在", "进行中" };
    /// <summary>Login web popup (NetEase / password entry, also the security check page for any region). Not a region signal.</summary>
    public const string LoginPopupWindowAutomationId = "LoginPopupWindow";
    /// <summary>Exact ids only on the CN login page (uidocs 战网登录_8914CEDB).</summary>
    public static readonly string[] CnLoginAutomationIds = { "ntes" };
    /// <summary>Exact ids that only the CN client shows (D3 tab D3CN, NetEase login). Substring matching must not be used: D3CN contains D3.</summary>
    public static readonly string[] CnRegionAutomationIds = { "game-nav-btn-D3CN", "game-nav-btn-D4CN", "ntes" };
    /// <summary>Exact ids that only the Asia client shows (global D3 tab, Asia account/password fields).</summary>
    /// <summary>Only the global D3 tab: the account form (accountName / password) is the same for CN and Asia accounts (live scan).</summary>
    public static readonly string[] AsiaRegionAutomationIds = { "game-nav-btn-D3" };
    /// <summary>Update agent sleep message text (uidocs 战网_85BFA152: "战网更新服务进入了睡眠模式。正在尝试唤醒它…"). The announcer group itself is always present.</summary>
    /// <summary>Security check page in the login web view: pick how to verify (live scan: "...quick security check. Select how you would like to verify your account." + method dropdown data-select-current, Continue / Go Back). Needs the user.</summary>
    public static readonly string[] SecurityCheckKeywords = { "quick security check", "verify your account", "安全检查", "安全验证", "验证您的账户", "验证你的账户", "驗證您的帳號" };
    public const string SecurityCheckMethodAutomationId = "data-select-current";
    /// <summary>Continue button on the security check page (live scan: ButtonControl "Continue" id submit); pressing it e-mails the code.</summary>
    public const string SecurityCheckSubmitAutomationId = "submit";
    /// <summary>Page waiting for the e-mailed / SMS / authenticator code. Needs the user.</summary>
    public static readonly string[] VerificationCodeKeywords =
    {
        "Enter the code", "enter the code", "verification code", "security code", "Check your email", "check your email",
        "sent a code", "sent you", "We sent", "验证码", "驗證碼", "安全码", "输入代码", "已发送", "请查收", "查看您的电子邮件",
    };
    /// <summary>"Keep me logged in" checkbox on the account form (live scan: persistLogin).</summary>
    public const string PersistLoginAutomationId = "persistLogin";
    /// <summary>Battle.net login window (Qt) hosting the account form web view.</summary>
    public const string LoginWindowClassName = "Phoenix::LoginWindow";

    /// <summary>Login window while credentials are being verified (live scan: labelLoggingIn "Logging in...").</summary>
    public const string LoggingInAutomationIdSuffix = "labelLoggingIn";
    /// <summary>Login web view spinner (live scan after submitting the code: LoginWindow ...webFrame.spinnerContainer.labelSpinner, no text yet).</summary>
    public const string LoginSpinnerAutomationIdSuffix = "labelSpinner";
    public static readonly string[] LoggingInKeywords = { "Logging in", "正在登录", "登录中" };

    // ---------- Guard watchdog config (keys shared with the app ConfigKeys; defaults also in Config/default_config.json) ----------
    public const int AbnormalTimeoutSecDefault = 120;
    public const int LoginTimeoutSecDefault = 300;

    // ---------- Region switch (official launcher argument; LastLoginRegion becomes CN / KR) ----------
    public const string LauncherExeName = "Battle.net Launcher.exe";
    public const string SetRegionArgFormat = "--setregion={0}";
    public const string SetRegionCodeCn = "CN";
    /// <summary>Asia entry: --setregion=TW (Battle.net.config then shows LastLoginRegion KR).</summary>
    public const string SetRegionCodeAsia = "TW";

    // ---------- Account menu (live scan: MenuItem "&lt;BattleTag&gt;, Online" next to avatar-edit-button opens DropdownMenu_N_menu) ----------
    public const string AvatarEditButtonId = "avatar-edit-button";
    public const string DropdownMenuButtonPrefix = "DropdownMenu_";
    public const string DropdownMenuButtonSuffix = "_button";
    public static readonly string[] LogOutKeywords = { "Log Out", "Log out", "Sign Out", "退出登录", "登出", "注销" };
    public const int AccountMenuOpenWaitMs = 800;

    /// <summary>Main window right after login, before the game tabs load (live scan: "Loading account information").</summary>
    public static readonly string[] AccountLoadingKeywords = { "Loading account", "account information", "正在载入账户", "账户信息", "帐户信息", "账号信息" };
    public static readonly string[] SleepModeTextKeywords = { "睡眠模式", "正在尝试唤醒", "went to sleep", "Attempting to wake", "wake it up" };

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
    /// <summary>AutomationId substrings that identify the main window title-bar (X button). When automation_id contains any of these AND "winCloseButton", do NOT click (would close whole client). 1:1 Python BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS.</summary>
    public static readonly string[] MainWindowCloseAutomationIdSubstrings = { "topLayerContainer.TopLayer.buttonContainer" };

    // ---------- Fetching / Loading account info (stuck state, EN/CN). Reddit/Blizzard: "Fetching account info", "Loading", 读取中, 获取信息. ----------
    /// <summary>UI text indicating Battle.net is fetching/loading account info (stuck state). Match when any present. Case-insensitive for EN.</summary>
    public static readonly string[] FetchingAccountInfoKeywords = { "Fetching", "Loading", "account info", "Loading account", "Please wait", "读取中", "获取信息", "正在获取", "正在读取", "载入中" };

    // ---------- Stuck recovery: cache cleanup only after this duration (seconds). Reddit/Blizzard: cache corruption causes sleep/loading loop. ----------
    /// <summary>When stuck in sleep or fetching/loading account info for this many seconds, trigger cache cleanup. 5 minutes.</summary>
    public const double StuckCleanupDelaySec = 300.0;
    /// <summary>Main nav container (uidocs 战网_85BFA152).</summary>
    public const string MainNavContainerAutomationId = "main-nav-container";
    public const string NotificationPillAutomationId = "notification-pill";
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
    public const string D3TabAutomationIdCnSecondary = D3TabAutomationIdAsia;
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
    public static readonly string[] LoadingIndicatorNameSubstrings = { "Update Agent", "wake it up", "Attempting to wake", "载入", "正在启动", "正在载入" };

    /// <summary>Play button text meaning the game is starting/running. 1:1 Python play_button_indicates_starting.</summary>
    public static readonly string[] PlayStartingNameSubstrings = { "Playing Now", "正在" };
    /// <summary>Play label "Playing" substrings for B9/B13 logs.</summary>
    public static readonly string[] PlayPlayingNameSubstrings = { "Playing", "正在" };
    /// <summary>Tab names that are not the game tab. 1:1 Python click_d3_tab exclusions.</summary>
    public static readonly string[] GameTabExcludedNameSubstrings = { "Playing Now", "Game Version" };

    // ---------- D4 tab (CN and Asia). 1:1 Python providor/constants/d4.py ----------
    public static readonly string[] D4TabAutomationIdsCn = { "game-nav-btn-Fen", "game-nav-btn-D4CN", "game-nav-btn-D4" };
    public static readonly string[] D4TabNameKeywordsCn = { "Diablo IV", "暗黑破坏神IV", "暗黑破壞神IV", "IV》" };
    public static readonly string[] D4TabAutomationIdsAsia = { "game-nav-btn-Fen", "game-nav-btn-D4" };
    public static readonly string[] D4TabNameKeywordsAsia = { "Diablo IV", "暗黑破壞神IV", "IV》" };

    // ---------- Control tree / click. 1:1 Python battlenet_operation_base ----------
    public const string BattlenetExeName = "Battle.net.exe";
    /// <summary>Process names (no extension): the client first, then the Blizzard update agent.</summary>
    public static readonly string[] ClientProcessNames = { "Battle.net", "Agent" };
    public const int ControlTreeMaxDepth = 25;
    public const double ControlsLightCacheTtlSec = 2.0;
    public const double ClickMoveDurationSec = 0.0;
    public const double ClickPauseAfterMoveSec = 0.0;
    public const int ActivateSettleMs = 200;
    public const int KillWaitTimeoutSec = 15;

    // ---------- UI snapshots. 1:1 Python BN_FLOW_SNAPSHOTS_DIR / DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS ----------
    public static readonly bool DebugSaveBnFlowUiSnapshots = false;
    public const string BnFlowSnapshotsDirName = "bn_flow_snapshots";
    public const string CacheDirName = D3PathConstants.CacheDirName;
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
    public static readonly int B11MaxTicks = Math.Max(1, (int)(BrowserLoginTimeoutSec / B11TickIntervalSec));

    public const string RegionAsia = "asia";
    public const string RegionCn = "cn";
}
