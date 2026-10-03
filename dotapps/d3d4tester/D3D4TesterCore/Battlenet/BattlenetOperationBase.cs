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
        var presence = ReadAccountPresence(controls);
        return ClassifyScreen(controls) with { GameUi = DetectGameUi(controls), AccountTag = presence?.Tag, AccountPresence = presence?.Status };
    }

    /// <summary>
    /// D3 / D4 nav tabs by exact automation id (CN D3CN / Fen / D4CN, Asia D3 / Fen) and the open page's action button
    /// (Play / Update / Install / Try For Free / Starting). The button belongs to the game named in its label
    /// (live scan: "Play: Diablo III, ...") or else to the selected nav tab ("Try For Free" names no game).
    /// </summary>
    public static BattlenetGameUi DetectGameUi(IReadOnlyList<BattlenetControl> controls)
    {
        if (controls.Count == 0) return BattlenetGameUi.None;
        var d3Tab = controls.FirstOrDefault(c => C.D3TabAutomationIdsCn.Contains(c.AutomationId, StringComparer.Ordinal) || C.D3TabAutomationIdsAsia.Contains(c.AutomationId, StringComparer.Ordinal));
        var d4Tab = controls.FirstOrDefault(c => C.D4TabAutomationIdsCn.Contains(c.AutomationId, StringComparer.Ordinal) || C.D4TabAutomationIdsAsia.Contains(c.AutomationId, StringComparer.Ordinal));
        var (button, action) = FindGameAction(controls);
        var d3Action = BattlenetGameAction.None;
        var d4Action = BattlenetGameAction.None;
        if (button != null)
        {
            bool isD4 = BattlenetRegionJudge.ContainsAny(button.Name, C.D4PlayLabelKeywords)
                        || (!BattlenetRegionJudge.ContainsAny(button.Name, C.D3PlayLabelKeywords) && d4Tab?.IsSelected == true);
            bool isD3 = !isD4 && (BattlenetRegionJudge.ContainsAny(button.Name, C.D3PlayLabelKeywords) || d3Tab?.IsSelected == true);
            if (isD4) d4Action = action;
            else if (isD3) d3Action = action;
        }
        return new BattlenetGameUi(d3Tab != null, d3Action, d4Tab != null, d4Action);
    }

    /// <summary>Main action button of the open game page and its kind; (null, None) on pages without one (HOME / SHOP).</summary>
    public static (BattlenetControl? Button, BattlenetGameAction Action) FindGameAction(IReadOnlyList<BattlenetControl> controls)
    {
        if (FindMainPlayButton(controls) is { } play)
            return (play, PlayButtonIndicatesStarting(play) ? BattlenetGameAction.Starting : BattlenetGameAction.Play);
        foreach (var c in controls)
        {
            if (c.Type != C.ButtonControlType || c.IsOffscreen == true || c.Level > C.GameActionMaxLevel) continue;
            string name = c.Name.Trim();
            if (StartsWithAny(name, C.GameActionUpdateNames)) return (c, BattlenetGameAction.Update);
            if (StartsWithAny(name, C.GameActionInstallNames)) return (c, BattlenetGameAction.Install);
            if (StartsWithAny(name, C.GameActionTryFreeNames)) return (c, BattlenetGameAction.TryFree);
        }
        return (null, BattlenetGameAction.None);
    }

    private static bool StartsWithAny(string text, IEnumerable<string> prefixes) =>
        prefixes.Any(p => text.StartsWith(p, StringComparison.OrdinalIgnoreCase));

    private BattlenetClientStatus ClassifyScreen(IReadOnlyList<BattlenetControl> controls)
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
        if (BattlenetPopupDismiss.FindModal(controls) is { } modal) return new(BattlenetClientState.Popup, Region, modal.AutomationId);
        var judge = new BattlenetRegionJudge(controls);
        if (judge.HasDisconnect()) return new(BattlenetClientState.Disconnected, Region, null);
        if (judge.HasConnecting()) return new(BattlenetClientState.Connecting, Region, null);
        var play = FindMainPlayButton(controls);
        if (play != null && PlayButtonIndicatesStarting(play)) return new(BattlenetClientState.GameStarting, Region, play.Name);
        if (HasText(controls, C.AccountLoadingKeywords)) return new(BattlenetClientState.LoadingAccount, Region, null);
        // Main UI health comes from the top-right avatar presence: Offline / Connecting / Reconnecting = not connected yet;
        // Online / Away / Busy / Appear Offline = normal (HOME / SHOP pages have no Play button, so Play is detail only).
        if (ReadAccountPresence(controls) is { } presence)
        {
            string detail = presence.Tag + AccountDetailSeparator + presence.Status + (play != null ? AccountDetailSeparator + play.Name : "");
            if (C.AccountNotConnectedStatuses.Contains(presence.Status, StringComparer.OrdinalIgnoreCase))
                return new(BattlenetClientState.AccountOffline, Region, detail);
            if (C.AccountConnectedStatuses.Contains(presence.Status, StringComparer.OrdinalIgnoreCase))
                return new(BattlenetClientState.Normal, Region, detail);
        }
        if (T.FindByAutomationId(controls, C.MainNavContainerAutomationId, exactMatch: true) != null)
            return new(BattlenetClientState.Normal, Region, play?.Name);
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
        var menuButton = FindAccountMenu(controls);
        if (menuButton == null)
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

    /// <summary>The account menu next to the top-right avatar (first DropdownMenu_N_button after avatar-edit-button), or null.</summary>
    public static BattlenetControl? FindAccountMenu(IReadOnlyList<BattlenetControl> controls)
    {
        int avatar = -1;
        for (int i = 0; i < controls.Count; i++)
            if (controls[i].AutomationId == C.AvatarEditButtonId) { avatar = i; break; }
        if (avatar < 0) return null;
        return controls.Skip(avatar).FirstOrDefault(c =>
            c.AutomationId.StartsWith(C.DropdownMenuButtonPrefix, StringComparison.Ordinal)
            && c.AutomationId.EndsWith(C.DropdownMenuButtonSuffix, StringComparison.Ordinal));
    }

    /// <summary>
    /// (BattleTag, presence) from the avatar menu "&lt;tag&gt;, &lt;status&gt;" (live scan: "MegRyanA, Appear Offline" with child text
    /// "MegRyanA"). Trusted only when the menu holds a text element equal to that BattleTag; null otherwise.
    /// </summary>
    public static (string Tag, string Status)? ReadAccountPresence(IReadOnlyList<BattlenetControl> controls)
    {
        var menu = FindAccountMenu(controls);
        if (menu == null) return null;
        string name = menu.Name;
        int sep = name.LastIndexOf(C.AccountStatusSeparator, StringComparison.Ordinal);
        if (sep <= 0) return null;
        string tag = name[..sep].Trim();
        string status = name[(sep + C.AccountStatusSeparator.Length)..].Trim();
        int start = -1;
        for (int i = 0; i < controls.Count; i++)
            if (ReferenceEquals(controls[i], menu)) { start = i; break; }
        for (int i = start + 1; start >= 0 && i < controls.Count && controls[i].Level > menu.Level; i++)
            if (controls[i].Type == C.TextControlType && string.Equals(controls[i].Name.Trim(), tag, StringComparison.Ordinal))
                return (tag, status);
        return null;
    }

    /// <summary>Region login screens (CN: NetEase page / web login popup; Asia: email / password / combined); null when not on one.</summary>
    protected abstract BattlenetClientState? ClassifyLoginScreen(IReadOnlyList<BattlenetControl> controls);

    private const string AccountDetailSeparator = " · ";

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
    /// Flow view of the single client classifier (ClassifyClientState) on one fresh walk, so the B / D blocks judge the screen exactly
    /// like the status center: Normal = logged-in main UI by the avatar presence (HOME has no Play), AccountOffline counts as connecting.
    /// </summary>
    public BattlenetDynamicState GetDynamicState()
    {
        var controls = T.EnumerateLight(forceRefresh: true);
        if (controls.Count == 0) return new BattlenetDynamicState(false, false, false, null, false, null);
        var status = ClassifyClientState(controls);
        var (onLogin, disconnected, normal) = status.DynamicTriple;
        bool connecting = status.State is BattlenetClientState.Connecting or BattlenetClientState.AccountOffline;
        return new BattlenetDynamicState(onLogin, disconnected, normal, FindMainPlayButton(controls)?.Name, connecting, Region);
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
