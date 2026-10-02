// PY-REF: pyapps/d3-check/d3utils/battlenet_operation.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_asia.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_cn.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Battle.net operation contract. Implementations are region-specific: Asia and CN only.
/// Do not mix region logic; use GetBattlenetOperation(region) to obtain the correct implementation.
/// Logic 1:1 with Python d3utils.battlenet_operation get_battlenet_operation() returning BattlenetOperationAsia or BattlenetOperationCN.
/// </summary>
public interface IBattlenetOperation
{
    /// <summary>Region this instance serves: "asia" or "cn".</summary>
    string Region { get; }

    /// <summary>Start Battle.net process from configured path. Returns true if started or already running.</summary>
    bool Start();

    /// <summary>Close/kill Battle.net process. Returns true if closed or was not running.</summary>
    bool Close();

    /// <summary>Activate Battle.net window if found. Returns true if activated.</summary>
    bool ActivateWindow();

    /// <summary>CN login UI (agree + NetEase, judge-based). Always false for Asia (use IsOnAsiaLoginScreen). 1:1 Python is_on_login_screen.</summary>
    bool IsOnLoginScreen();

    /// <summary>True when D3 tab and Play are visible and not on login screen (main UI).</summary>
    bool IsLoggedIn();

    /// <summary>CN only: activate, ensure agree checkbox, click NetEase, wait. Asia returns false.</summary>
    bool PerformCnLoginFlow(double waitAfterNetEaseSec = 0.5);

    /// <summary>Asia only: fill account/password and click submit. CN returns false.</summary>
    bool PerformAsiaLoginFillAndSubmit(string? email, string? password);

    /// <summary>Click D3 game tab in Battle.net.</summary>
    bool ClickD3Tab();

    /// <summary>Click Play / Start game button.</summary>
    bool ClickStartGame();

    /// <summary>Current UI state: on_login, disconnected, normal_available (D3 tab+Play), play_button_name, connecting, region. 1:1 Python get_dynamic_state().</summary>
    BattlenetDynamicState GetDynamicState();

    /// <summary>If in-UI popup or reconnect banner is present, find and click to close. 1:1 Python try_close_popup.</summary>
    bool TryClosePopup();

    /// <summary>True when login failed screen (Continue Offline / Cancel); requires primary and secondary keywords; false when browser-wait. 1:1 Python is_login_failed_screen.</summary>
    bool IsLoginFailedScreen();

    /// <summary>True when "Complete login in browser" popup is shown. 1:1 Python is_on_browser_login_wait_screen.</summary>
    bool IsOnBrowserLoginWaitScreen();

    /// <summary>CN: legalAcceptance or ntes present. Always false for Asia. 1:1 Python is_login_screen_ready.</summary>
    bool IsLoginScreenReady();

    /// <summary>If Play button is visible, click it and return true. 1:1 Python click_play_button_if_visible.</summary>
    bool ClickPlayButtonIfVisible(bool forceRefresh = true);

    /// <summary>True when the Play button shows the game is starting (Launching / In game). 1:1 Python is_game_starting.</summary>
    bool IsGameStarting() => false;

    /// <summary>True when a loading / updating UI is visible. 1:1 Python battlenet_operation_base.is_loading_ui_visible.</summary>
    bool IsLoadingUiVisible() => false;

    /// <summary>True when the Battle.net client shows a disconnected state. 1:1 Python battlenet_operation_base.is_disconnected.</summary>
    bool IsDisconnected() => false;

    /// <summary>Asia only: true when the two-step Asia login screen (email / password) is shown. 1:1 Python is_on_asia_login_screen.</summary>
    bool IsOnAsiaLoginScreen() => false;

    /// <summary>Dump the current UI elements to a debug JSON file; returns its path or null. 1:1 Python save_ui_elements_snapshot(node_name, reason).</summary>
    string? SaveUiElementsSnapshot(string nodeName, string reason) => null;

    /// <summary>Asia only: fill email and continue (step 1). 1:1 Python perform_asia_email_step.</summary>
    bool PerformAsiaEmailStep(string email) => false;

    /// <summary>Asia only: fill password and log in (step 2); null uses stored credentials. 1:1 Python perform_asia_password_step.</summary>
    bool PerformAsiaPasswordStep(string? password = null) => false;

    /// <summary>CN only: click the CN login button. 1:1 Python click_cn_login_button.</summary>
    bool ClickCnLoginButton() => false;

    /// <summary>Click D4 game tab in Battle.net. 1:1 Python d4_battlenet_operation.click_d4_tab.</summary>
    bool ClickD4Tab() => false;

    /// <summary>True when D4 is starting from Battle.net. 1:1 Python d4_battlenet_operation.is_game_starting.</summary>
    bool IsD4Starting() => false;

    /// <summary>Log out of the current account via the account menu (Log Out). Used when switching accounts.</summary>
    bool LogOut();

    /// <summary>Passive client screen state from one control list (all visible Battle.net windows); no clicks. Region UI differs, so each region classifies its own login screens.</summary>
    Battlenet.BattlenetClientStatus ClassifyClientState(IReadOnlyList<Battlenet.BattlenetControl> controls);
}

/// <summary>Result of get_dynamic_state. on_login=true when on CN/Asia login screen; normal_available=true when D3 tab and Play visible; connecting when "Connecting" shown.</summary>
public sealed record BattlenetDynamicState(
    bool OnLogin,
    bool Disconnected,
    bool NormalAvailable,
    string? PlayButtonName,
    bool Connecting,
    string? RegionDetected
);
