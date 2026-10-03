// PY-REF: none (DOT-only)
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>Battle.net client screen, one value per probe (exclusive, in detection priority order).</summary>
public enum BattlenetClientState
{
    Unknown = 0,
    NotRunning,
    TrayHidden,
    Sleeping,
    Loading,
    LoadingAccount,
    BrowserLoginWait,
    LoggingIn,
    LoginFailed,
    LoginCn,
    LoginCnWeb,
    SecurityCheck,
    VerificationCode,
    LoginEmail,
    LoginPassword,
    LoginAsia,
    Popup,
    /// <summary>Main UI shown but the top-right avatar presence says Offline: the client is not connected (abnormal).</summary>
    AccountOffline,
    Disconnected,
    Connecting,
    GameStarting,
    Normal,
}

/// <summary>Main action button of a game page: Play, Update, Install (not installed), Try For Free / Buy (not owned), Starting.</summary>
public enum BattlenetGameAction
{
    None,
    Play,
    Update,
    Install,
    TryFree,
    Starting,
}

/// <summary>Game entry points on the main UI: D3 / D4 nav tab and the action button of that game's page (seen while its page is open).</summary>
public sealed record BattlenetGameUi(bool D3Tab, BattlenetGameAction D3Action, bool D4Tab, BattlenetGameAction D4Action)
{
    public static readonly BattlenetGameUi None = new(false, BattlenetGameAction.None, false, BattlenetGameAction.None);
}

/// <summary>Probe result: state, region read from the UI itself (null when the screen does not tell), detail (e.g. Play label).</summary>
public sealed record BattlenetClientStatus(BattlenetClientState State, string? UiRegion, string? Detail)
{
    /// <summary>D3 / D4 tab and action button recognition from the same walk.</summary>
    public BattlenetGameUi GameUi { get; init; } = BattlenetGameUi.None;
    /// <summary>BattleTag shown next to the avatar (verified: menu name and its tag text agree); null when not read.</summary>
    public string? AccountTag { get; init; }
    /// <summary>Presence text of that BattleTag (Online / Away / Busy / Appear Offline / Offline ...).</summary>
    public string? AccountPresence { get; init; }

    public static readonly BattlenetClientStatus None = new(BattlenetClientState.Unknown, null, null);

    /// <summary>The (on_login, disconnected, normal_available) triple kept by GameInterfaceData for the flows.</summary>
    public (bool OnLogin, bool Disconnected, bool Normal) DynamicTriple => State switch
    {
        BattlenetClientState.Disconnected => (false, true, false),
        BattlenetClientState.LoginCn or BattlenetClientState.LoginCnWeb or BattlenetClientState.LoginEmail
            or BattlenetClientState.LoginPassword or BattlenetClientState.LoginAsia => (true, false, false),
        BattlenetClientState.Normal or BattlenetClientState.GameStarting => (false, false, true),
        _ => (false, false, false),
    };

    public bool IsLogin => DynamicTriple.OnLogin;

    /// <summary>Logging in / security check / e-mail wait or code entry: the user is mid-login, so nothing may close or restart the client.</summary>
    public bool IsWaitingForUser => IsWaitingForUserState(State);

    public static bool IsWaitingForUserState(BattlenetClientState state) =>
        state is BattlenetClientState.LoggingIn or BattlenetClientState.SecurityCheck or BattlenetClientState.VerificationCode;
}

/// <summary>
/// Passive Battle.net client probe: one light UIA walk over every visible Battle.net window (main, login, login popup), no clicks,
/// no activation. Picks the region implementation from the UI (exact CN / Asia ids, else the configured region) and lets that
/// IBattlenetOperation classify, since CN and Asia clients differ in UI and flow. Signals verified with tools/BnProbe and docs/uidocs.
/// </summary>
public static class BattlenetClientStateDetector
{
    public static BattlenetClientStatus Detect()
    {
        var bn = BattlenetManager.Instance;
        var windows = bn.FindWindows();
        if (windows.Count == 0)
            return new BattlenetClientStatus(bn.IsProcessRunning() ? BattlenetClientState.TrayHidden : BattlenetClientState.NotRunning, null, null);

        var controls = new List<BattlenetControl>();
        foreach (var w in windows)
            controls.AddRange(T.EnumerateLightForWindow(w.Hwnd));
        string? uiRegion = UiRegion(controls);
        var status = BattlenetOperationFactory.GetOperation(uiRegion).ClassifyClientState(controls);
        return status with { UiRegion = uiRegion };
    }

    /// <summary>Region the UI itself shows: exact CN-only / Asia-only automation ids (substring matching would read D3CN as D3).</summary>
    public static string? UiRegion(IReadOnlyList<BattlenetControl> controls)
    {
        if (HasExactAutomationId(controls, C.CnRegionAutomationIds)) return C.RegionCn;
        if (HasExactAutomationId(controls, C.AsiaRegionAutomationIds)) return C.RegionAsia;
        return null;
    }

    private static bool HasExactAutomationId(IReadOnlyList<BattlenetControl> controls, IReadOnlyList<string> ids) =>
        controls.Any(c => ids.Contains(c.AutomationId, StringComparer.Ordinal));
}
