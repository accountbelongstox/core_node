namespace DotApps.d3check.Core;

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

    /// <summary>True when current UI is login screen for this region (CN: agree+NetEase; Asia: email/password).</summary>
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

    /// <summary>True when login screen has operable controls (CN: agree+NetEase; Asia: account/password/submit). 1:1 Python is_login_screen_ready.</summary>
    bool IsLoginScreenReady();

    /// <summary>If Play button is visible, click it and return true. 1:1 Python click_play_button_if_visible.</summary>
    bool ClickPlayButtonIfVisible(bool forceRefresh = true);
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
