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
    BrowserLoginWait,
    LoginFailed,
    LoginCn,
    LoginCnWeb,
    LoginAsiaEmail,
    LoginAsiaPassword,
    LoginAsia,
    Disconnected,
    Connecting,
    GameStarting,
    Normal,
}

/// <summary>Probe result: state, region read from the UI itself (null when the screen does not tell), detail (e.g. Play label).</summary>
public sealed record BattlenetClientStatus(BattlenetClientState State, string? UiRegion, string? Detail)
{
    public static readonly BattlenetClientStatus None = new(BattlenetClientState.Unknown, null, null);

    /// <summary>The (on_login, disconnected, normal_available) triple kept by GameInterfaceData for the flows.</summary>
    public (bool OnLogin, bool Disconnected, bool Normal) DynamicTriple => State switch
    {
        BattlenetClientState.Disconnected => (false, true, false),
        BattlenetClientState.LoginCn or BattlenetClientState.LoginCnWeb or BattlenetClientState.LoginAsiaEmail
            or BattlenetClientState.LoginAsiaPassword or BattlenetClientState.LoginAsia => (true, false, false),
        BattlenetClientState.Normal or BattlenetClientState.GameStarting => (false, false, true),
        _ => (false, false, false),
    };

    public bool IsLogin => DynamicTriple.OnLogin;
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
        if (controls.Any(c => c.AutomationId.Contains(C.LoginPopupWindowAutomationId, StringComparison.Ordinal))) return C.RegionCn;
        if (HasExactAutomationId(controls, C.CnRegionAutomationIds)) return C.RegionCn;
        if (HasExactAutomationId(controls, C.AsiaRegionAutomationIds)) return C.RegionAsia;
        return null;
    }

    private static bool HasExactAutomationId(IReadOnlyList<BattlenetControl> controls, IReadOnlyList<string> ids) =>
        controls.Any(c => ids.Contains(c.AutomationId, StringComparer.Ordinal));
}
