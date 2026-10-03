// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_cn.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_asia.py
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Shared Battle.net operations (no region logic): start/close/activate, loading/disconnect/login-failed/browser-wait detection,
/// popup close, UI snapshot, single-walk dynamic state, play-starting rule.
/// 1:1 Python d3utils/battlenet_operation_base.py (BattlenetOperationBase).
/// </summary>
public abstract class BattlenetOperationBase : IBattlenetOperation
{
    public abstract string Region { get; }

    public bool Start() => BattlenetManager.Instance.Start();

    public bool Close() => BattlenetManager.Instance.Close();

    public bool Restart(double waitAfterSec = 2.0) => BattlenetManager.Instance.Restart(null, waitAfterSec);

    public bool ActivateWindow() => BattlenetManager.Instance.ActivateWindow();

    public abstract bool IsOnLoginScreen();
    public abstract bool IsLoggedIn();
    public abstract bool PerformCnLoginFlow(double waitAfterNetEaseSec = C.CnAfterNetEaseClickSettleSec);
    public abstract bool PerformAsiaLoginFillAndSubmit(string? email, string? password);
    public abstract bool ClickD3Tab();
    public abstract bool ClickStartGame();
    public abstract BattlenetDynamicState GetDynamicState();
    public abstract bool IsLoginScreenReady();
    public abstract bool ClickPlayButtonIfVisible(bool forceRefresh = true);
    public abstract bool IsGameStarting();
    public abstract bool IsOnAsiaLoginScreen();
    public abstract bool PerformAsiaEmailStep(string email);
    public abstract bool PerformAsiaPasswordStep(string? password = null);
    public abstract bool ClickCnLoginButton();
    public abstract bool ClickD4Tab();
    public abstract bool IsD4Starting();

    /// <summary>
    /// Shared screen classification (priority order): sleep, browser-login wait, login failed, region login screens
    /// (<see cref="ClassifyLoginScreen"/>), disconnected, connecting, game starting, main UI normal, loading, unknown.
    /// </summary>
    public BattlenetClientStatus ClassifyClientState(IReadOnlyList<BattlenetControl> controls)
    {
        if (controls.Count == 0) return BattlenetClientStatus.None;
        if (HasText(controls, C.SleepModeTextKeywords)) return new(BattlenetClientState.Sleeping, Region, null);
        if (T.FindByName(controls, C.BrowserLoginWaitMainKeywords) != null) return new(BattlenetClientState.BrowserLoginWait, Region, null);
        if (T.FindByName(controls, C.LoginFailedPrimaryKeywords) != null && T.FindByName(controls, C.LoginFailedSecondaryKeywords) != null)
            return new(BattlenetClientState.LoginFailed, Region, null);
        if (controls.Any(c => c.AutomationId.EndsWith(C.LoggingInAutomationIdSuffix, StringComparison.Ordinal)
                              || c.AutomationId.EndsWith(C.LoginSpinnerAutomationIdSuffix, StringComparison.Ordinal))
            || HasText(controls, C.LoggingInKeywords))
            return new(BattlenetClientState.LoggingIn, Region, null);
        if (HasText(controls, C.VerificationCodeKeywords)) return new(BattlenetClientState.VerificationCode, Region, null);
        if (HasText(controls, C.SecurityCheckKeywords)) return new(BattlenetClientState.SecurityCheck, Region, SelectedVerifyMethod(controls));
        var form = new BattlenetRegionJudge(controls);
        if (form.IsAsiaEmailStep()) return new(BattlenetClientState.LoginEmail, Region, null);
        if (form.IsAsiaPasswordStep()) return new(BattlenetClientState.LoginPassword, Region, AccountShownOnForm(controls));
        if (ClassifyLoginScreen(controls) is { } login) return new(login, Region, null);
        var judge = new BattlenetRegionJudge(controls);
        if (judge.HasDisconnect()) return new(BattlenetClientState.Disconnected, Region, null);
        if (judge.HasConnecting()) return new(BattlenetClientState.Connecting, Region, null);
        var play = FindMainPlayButton(controls);
        if (play != null && PlayButtonIndicatesStarting(play)) return new(BattlenetClientState.GameStarting, Region, play.Name);
        if (play != null && T.FindByAutomationId(controls, C.MainNavContainerAutomationId, exactMatch: true) != null)
            return new(BattlenetClientState.Normal, Region, play.Name);
        if (HasText(controls, C.AccountLoadingKeywords)) return new(BattlenetClientState.LoadingAccount, Region, null);
        if (HasText(controls, C.LoadingIndicatorNameSubstrings)) return new(BattlenetClientState.Loading, Region, null);
        return new(BattlenetClientState.Unknown, Region, null);
    }

    /// <summary>
    /// Log out of the current account: open the account menu (the DropdownMenu_N_button right after avatar-edit-button) and
    /// click Log Out. Used when switching accounts; the guard flow then logs in with the active credentials.
    /// </summary>
    public bool LogOut()
    {
        var controls = T.Enumerate();
        int avatar = controls.FindIndex(c => c.AutomationId == C.AvatarEditButtonId);
        var menuButton = controls.Skip(Math.Max(0, avatar)).FirstOrDefault(c =>
            c.AutomationId.StartsWith(C.DropdownMenuButtonPrefix, StringComparison.Ordinal)
            && c.AutomationId.EndsWith(C.DropdownMenuButtonSuffix, StringComparison.Ordinal));
        if (avatar < 0 || menuButton == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] LogOut: account menu not found (not on the main UI?)");
            return false;
        }
        T.ClickControl(menuButton);
        Thread.Sleep(C.AccountMenuOpenWaitMs);
        var logOut = T.FindByName(T.Enumerate(), C.LogOutKeywords);
        if (logOut == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] LogOut: Log Out item not found in the account menu");
            return false;
        }
        ColorPrinter.Blue($"[BattlenetOperation] LogOut: clicking '{logOut.Name}'");
        return T.ClickControl(logOut);
    }

    /// <summary>Verify method selected on the security check page (the dropdown text after the prompt, e.g. "E-Mail").</summary>
    private static string? SelectedVerifyMethod(IReadOnlyList<BattlenetControl> controls) =>
        controls.FirstOrDefault(c => c.AutomationId == C.SecurityCheckMethodAutomationId) is { } menu
            ? controls.SkipWhile(c => c != menu).Skip(1).FirstOrDefault(c => c.Type == C.LoadingIndicatorControlType && c.Name.Length > 0)?.Name
            : null;

    /// <summary>Account already shown on the password form (text before "Switch account"), for the state detail.</summary>
    private static string? AccountShownOnForm(IReadOnlyList<BattlenetControl> controls)
    {
        int i = controls.ToList().FindIndex(c => BattlenetRegionJudge.ContainsAny(c.Name, C.AsiaLoginSwitchAccountKeywords));
        return i > 0 && controls[i - 1].Type == C.LoadingIndicatorControlType ? controls[i - 1].Name : null;
    }

    /// <summary>Region login screens (CN: NetEase page / web login popup; Asia: email / password / combined); null when not on one.</summary>
    protected abstract BattlenetClientState? ClassifyLoginScreen(IReadOnlyList<BattlenetControl> controls);

    /// <summary>Main-window Play button: AutomationId when present, else a button whose name starts with a Play label (live scans: no id).</summary>
    protected static BattlenetControl? FindMainPlayButton(IReadOnlyList<BattlenetControl> controls) =>
        T.FindByAnyAutomationId(controls, C.StartGameAutomationIdsAsia)
        ?? controls.FirstOrDefault(c => c.Type == C.ButtonControlType
                                        && C.PlayButtonNamePrefixes.Any(p => c.Name.StartsWith(p, StringComparison.OrdinalIgnoreCase)));

    /// <summary>A TextControl whose name contains any keyword.</summary>
    protected static bool HasText(IReadOnlyList<BattlenetControl> controls, IReadOnlyList<string> keywords) =>
        controls.Any(c => (c.Type == C.LoadingIndicatorControlType || c.Type == C.LoadingIndicatorControlTypeShort)
                          && BattlenetRegionJudge.ContainsAny(c.Name, keywords));

    /// <summary>1:1 Python try_close_popup (full enumeration, ButtonControl only).</summary>
    public bool TryClosePopup() => BattlenetPopupDismiss.TryClosePopup(T.Enumerate());

    public string? SaveUiElementsSnapshot(string nodeName, string reason) => T.SaveUiElementsSnapshot(nodeName, reason);

    /// <summary>TextControl whose name contains a loading substring. 1:1 Python is_loading_ui_visible.</summary>
    public bool IsLoadingUiVisible()
    {
        foreach (var c in T.Enumerate())
        {
            if (c.Type != C.LoadingIndicatorControlType && c.Type != C.LoadingIndicatorControlTypeShort) continue;
            if (BattlenetRegionJudge.ContainsAny(c.Name, C.LoadingIndicatorNameSubstrings))
                return true;
        }
        return false;
    }

    /// <summary>Primary (Continue Offline) and secondary (Cancel) both present; false on browser-wait popup. 1:1 Python is_login_failed_screen.</summary>
    public bool IsLoginFailedScreen()
    {
        var controls = T.EnumerateLight();
        if (controls.Count == 0) return false;
        if (IsOnBrowserLoginWaitScreen()) return false;
        bool hasPrimary = T.HasAutomationIdContainingAny(controls, C.LoginFailedPrimaryAutomationIds);
        bool hasSecondary = T.HasAutomationIdContainingAny(controls, C.LoginFailedSecondaryAutomationIds);
        if (!hasPrimary || !hasSecondary)
        {
            foreach (var c in controls)
            {
                if (!hasPrimary && (BattlenetRegionJudge.ContainsAny(c.Name, C.LoginFailedPrimaryKeywords) || BattlenetRegionJudge.ContainsAny(c.AutomationId, C.LoginFailedPrimaryKeywords)))
                    hasPrimary = true;
                if (!hasSecondary && (BattlenetRegionJudge.ContainsAny(c.Name, C.LoginFailedSecondaryKeywords) || BattlenetRegionJudge.ContainsAny(c.AutomationId, C.LoginFailedSecondaryKeywords)))
                    hasSecondary = true;
            }
        }
        return hasPrimary && hasSecondary;
    }

    /// <summary>1:1 Python is_on_browser_login_wait_screen.</summary>
    public bool IsOnBrowserLoginWaitScreen()
    {
        var controls = T.EnumerateLight();
        if (controls.Count == 0) return false;
        if (C.BrowserLoginWaitAutomationIds.Length > 0 && T.HasAutomationIdContainingAny(controls, C.BrowserLoginWaitAutomationIds))
            return true;
        return T.FindByName(controls, C.BrowserLoginWaitMainKeywords) != null;
    }

    /// <summary>1:1 Python is_disconnected.</summary>
    public bool IsDisconnected()
    {
        var controls = T.EnumerateLight();
        if (controls.Count == 0) return false;
        if (C.DisconnectAutomationIds.Length > 0 && T.HasAutomationIdContainingAny(controls, C.DisconnectAutomationIds))
            return true;
        return T.FindByName(controls, C.DisconnectKeywords) != null;
    }

    /// <summary>Name contains Playing Now/正在, else disabled. 1:1 Python play_button_indicates_starting.</summary>
    public static bool PlayButtonIndicatesStarting(BattlenetControl ctrl)
    {
        if (BattlenetRegionJudge.ContainsAny(ctrl.Name, C.PlayStartingNameSubstrings))
            return true;
        return ctrl.IsEnabled is { } enabled && !enabled;
    }

    /// <summary>
    /// One fresh walk; flags: login (marker id or strict keyword), disconnect, connecting, D3 tab, Play (+ first Play name).
    /// 1:1 Python _get_dynamic_state_cn / _get_dynamic_state_asia.
    /// </summary>
    protected BattlenetDynamicState ComputeDynamicState(
        string[] loginMarkers, string[] loginKeywords, string[] d3Aids, string[] d3Names, string[] playAids, string[] playNames)
    {
        var controls = T.EnumerateLight(forceRefresh: true);
        var empty = new BattlenetDynamicState(false, false, false, null, false, null);
        if (controls.Count == 0) return empty;
        bool login = false, disconnect = false, connecting = false, d3 = false, play = false;
        string? playName = null;
        foreach (var c in controls)
        {
            if (BattlenetRegionJudge.ContainsAny(c.AutomationId, loginMarkers) || BattlenetRegionJudge.ContainsAny(c.Name, loginKeywords))
                login = true;
            if (BattlenetRegionJudge.ContainsAny(c.Name, C.DisconnectKeywords))
                disconnect = true;
            if (BattlenetRegionJudge.ContainsAny(c.Name, C.ConnectingKeywords))
                connecting = true;
            if (BattlenetRegionJudge.ContainsAny(c.AutomationId, d3Aids) || BattlenetRegionJudge.ContainsAny(c.Name, d3Names))
                d3 = true;
            if (BattlenetRegionJudge.ContainsAny(c.AutomationId, playAids) || BattlenetRegionJudge.ContainsAny(c.Name, playNames))
            {
                play = true;
                if (c.Name.Length > 0 && playName == null)
                    playName = c.Name;
            }
        }
        if (d3 && play && !login)
        {
            if (connecting)
                return new BattlenetDynamicState(false, false, false, null, true, Region);
            return new BattlenetDynamicState(false, false, true, playName ?? "Play", false, Region);
        }
        if (disconnect) return new BattlenetDynamicState(false, true, false, null, false, Region);
        if (login) return new BattlenetDynamicState(true, false, false, null, false, Region);
        return empty;
    }

    /// <summary>Exact automation id match (optionally skipping Playing Now/Game Version names). Shared by D3/D4 tab clicks.</summary>
    protected static BattlenetControl? FindGameTabByAutomationId(IReadOnlyList<BattlenetControl> controls, string[] aids, bool skipExcludedOnAid)
    {
        foreach (var aid in aids)
        {
            var ctrl = T.FindByAutomationId(controls, aid, exactMatch: true);
            if (ctrl == null) continue;
            if (skipExcludedOnAid && BattlenetRegionJudge.ContainsAny(ctrl.Name, C.GameTabExcludedNameSubstrings)) continue;
            return ctrl;
        }
        return null;
    }

    /// <summary>Play control by automation id (substring) then name. 1:1 Python _find_play_control_in_list.</summary>
    protected static BattlenetControl? FindPlay(IReadOnlyList<BattlenetControl> controls, string[] aids, string[] names)
    {
        if (controls.Count == 0) return null;
        foreach (var aid in aids)
        {
            var ctrl = T.FindByAutomationId(controls, aid);
            if (ctrl != null) return ctrl;
        }
        return T.FindByName(controls, names);
    }

    protected static bool ClickPlayIfVisible(string[] aids, string[] names, bool forceRefresh)
    {
        var ctrl = FindPlay(T.EnumerateLight(forceRefresh), aids, names);
        if (ctrl == null) return false;
        ColorPrinter.Gray("[BattlenetOperation] Play button visible, click");
        return T.ClickControl(ctrl);
    }
}
