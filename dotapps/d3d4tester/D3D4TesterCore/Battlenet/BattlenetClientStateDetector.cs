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

/// <summary>Which game entry points the main UI shows: D3 / D4 nav tab and their Play button (by the Play label).</summary>
public sealed record BattlenetGameUi(bool D3Tab, bool D3Play, bool D4Tab, bool D4Play)
{
    public static readonly BattlenetGameUi None = new(false, false, false, false);
}

/// <summary>Probe result: state, region read from the UI itself (null when the screen does not tell), detail (e.g. Play label).</summary>
public sealed record BattlenetClientStatus(BattlenetClientState State, string? UiRegion, string? Detail)
{
    /// <summary>D3 / D4 tab and Play recognition from the same walk.</summary>
    public BattlenetGameUi GameUi { get; init; } = BattlenetGameUi.None;

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
