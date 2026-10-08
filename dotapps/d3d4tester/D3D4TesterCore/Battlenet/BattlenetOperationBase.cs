// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_cn.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_asia.py
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Shared Battle.net operations (no region logic): start/close/activate, client screen classification, game tab / Play clicks,
/// account log out, play-starting rule.
/// 1:1 Python d3utils/battlenet_operation_base.py (BattlenetOperationBase).
/// </summary>
public abstract class BattlenetOperationBase : IBattlenetOperation
{
    public abstract string Region { get; }

    public bool Start() => BattlenetManager.Instance.Start();

    public bool Close() => BattlenetManager.Instance.Close();

    public bool ActivateWindow() => BattlenetManager.Instance.ActivateWindow();

    public abstract bool PerformCnLoginFlow(double waitAfterNetEaseSec = C.CnAfterNetEaseClickSettleSec);
    public abstract bool PerformAsiaLoginFillAndSubmit(string? email, string? password);
    public abstract bool ClickD3Tab();
    public abstract bool ClickStartGame();
    public abstract bool IsOnAsiaLoginScreen();
    public abstract bool ClickD4Tab();

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
        if (FindDownloadButton(controls) is { } download)
            return (download, StartsWithAny(download.Name.Trim(), C.DownloadPauseNames) ? BattlenetGameAction.Downloading : BattlenetGameAction.DownloadPaused);
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

    /// <summary>Pause / Resume button of the open game page's download (same automation id suffix for both), or null.</summary>
    public static BattlenetControl? FindDownloadButton(IReadOnlyList<BattlenetControl> controls) =>
        controls.FirstOrDefault(c => c.Type == C.ButtonControlType && c.IsOffscreen != true && c.Level <= C.GameActionMaxLevel
                                     && (c.AutomationId.EndsWith(C.DownloadButtonAutomationIdSuffix, StringComparison.Ordinal)
                                         || StartsWithAny(c.Name.Trim(), C.DownloadResumeNames) || StartsWithAny(c.Name.Trim(), C.DownloadPauseNames)));

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
        if (play != null && PlayButtonIndicatesStarting(play) && FindDownloadButton(controls) == null) return new(BattlenetClientState.GameStarting, Region, play.Name);
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

    /// <summary>Name contains Playing Now/正在, else disabled. 1:1 Python play_button_indicates_starting.</summary>
    public static bool PlayButtonIndicatesStarting(BattlenetControl ctrl)
    {
        if (BattlenetRegionJudge.ContainsAny(ctrl.Name, C.PlayStartingNameSubstrings))
            return true;
        return ctrl.IsEnabled is { } enabled && !enabled;
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

    /// <summary>Play control by automation id (substring, matched id returned) then name. 1:1 Python _find_play_control_in_list.</summary>
    protected static (BattlenetControl? Control, string? MatchedAutomationId) FindPlay(IReadOnlyList<BattlenetControl> controls, string[] aids, string[] names)
    {
        if (controls.Count == 0) return (null, null);
        foreach (var aid in aids)
        {
            var ctrl = T.FindByAutomationId(controls, aid);
            if (ctrl != null) return (ctrl, aid);
        }
        return (T.FindByName(controls, names), null);
    }

    /// <summary>Region label in click log lines ("CN" / "Asia").</summary>
    protected abstract string LogRegionLabel { get; }

    /// <summary>Suffix of the region's "not found" click log lines.</summary>
    protected abstract string NotFoundLogSuffix { get; }

    private const string OperationLogTag = "[BattlenetOperation]";
    private const string D4OperationLogTag = "[D4BattlenetOperation]";
    private const string D3TabLogLabel = "D3";
    private const string D4TabLogLabel = "D4";

    /// <summary>D3 tab: exact automation id, then name (not Playing Now / Game Version). 1:1 Python click_d3_tab.</summary>
    protected bool ClickD3TabBy(string[] aids, string[] names) =>
        ClickGameTab(OperationLogTag, D3TabLogLabel, aids, skipExcludedOnAid: false, names);

    /// <summary>D4 tab: exact automation id (optionally skipping Playing Now / Game Version), then name. 1:1 Python D4BattlenetOperation.click_d4_tab.</summary>
    protected bool ClickD4TabBy(string[] aids, bool skipExcludedOnAid, string[] names) =>
        ClickGameTab(D4OperationLogTag, D4TabLogLabel, aids, skipExcludedOnAid, names);

    private bool ClickGameTab(string logTag, string tabLabel, string[] aids, bool skipExcludedOnAid, string[] names)
    {
        var controls = T.Enumerate();
        var ctrl = FindGameTabByAutomationId(controls, aids, skipExcludedOnAid);
        if (ctrl != null)
        {
            ColorPrinter.Blue($"{logTag} {LogRegionLabel} Click {tabLabel} tab: automation_id={ctrl.AutomationId}");
            return T.ClickControl(ctrl);
        }
        var byName = T.FindByName(controls, names);
        if (byName != null && !BattlenetRegionJudge.ContainsAny(byName.Name, C.GameTabExcludedNameSubstrings))
        {
            ColorPrinter.Blue($"{logTag} {LogRegionLabel} Click {tabLabel} tab: name={byName.Name}");
            return T.ClickControl(byName);
        }
        ColorPrinter.Yellow($"{logTag} {tabLabel} tab control not found{NotFoundLogSuffix}");
        return false;
    }

    /// <summary>Play / start game: automation id (substring), then name. 1:1 Python click_start_game.</summary>
    protected bool ClickPlayBy(string[] aids, string[] names)
    {
        var (ctrl, aid) = FindPlay(T.Enumerate(), aids, names);
        if (ctrl == null)
        {
            ColorPrinter.Yellow($"{OperationLogTag} Start game button not found{NotFoundLogSuffix}");
            return false;
        }
        ColorPrinter.Blue(aid != null
            ? $"{OperationLogTag} {LogRegionLabel} Click start game: automation_id={aid}"
            : $"{OperationLogTag} {LogRegionLabel} Click start game: name={ctrl.Name}");
        return T.ClickControl(ctrl);
    }
}
