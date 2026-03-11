namespace DotApps.d3check.Core;

/// <summary>
/// Thread-safe snapshot of game interface state for UI. Matches Python get_state_snapshot() keys.
/// Single source for bottom bar and panels; flow/status providers write, UI reads via this snapshot.
/// </summary>
public sealed class GameInterfaceStateSnapshot
{
    public bool BattlenetWindowFound { get; init; }
    public string? BattlenetRegion { get; init; }
    public bool RosbotWindowFound { get; init; }
    public bool RosbotHasMainUi { get; init; }
    public string RosbotExtendedStatus { get; init; } = "not_found";
    public bool RosbotRunning { get; init; }
    /// <summary>Master state: true when user clicks Start ROSBOT, false when Stop. Logic 1:1 with Python rosbot_flow_master_enabled.</summary>
    public bool RosbotFlowMasterEnabled { get; init; }
    /// <summary>True when user has enabled "Ensure Battle.net only" (BN open + activated). Dot: set after flow runs; no tick.</summary>
    public bool EnsureBattlenetOnlyEnabled { get; init; }
    public bool D3Running { get; init; }
    public string MapType { get; init; } = "unknown";
    public string GameStage { get; init; } = "unknown";
    public bool D3OnLoginScreen { get; init; }
    public bool D3Disconnected { get; init; }
    public bool D3InGame { get; init; }
    public bool BattlenetOnLoginScreen { get; init; }
    public bool BattlenetDisconnected { get; init; }
    /// <summary>True when BN is in sleep mode and we are waiting for wake (show 唤醒中 in status bar). ROSBOT must not start until false.</summary>
    public bool BattlenetWakingUp { get; init; }
    public bool BattlenetNormalAvailable { get; init; }
    public string RosbotFoundExeName { get; init; } = "";
    public string RosbotFoundWindowTitle { get; init; } = "";
    public bool RosbotNeedKeyInput { get; init; }
    public string RosbotNeedKeyMessage { get; init; } = "";
    public string? RosbotTestModeDisplay { get; init; }
    public int RosbotTotalRestartCount { get; init; }
    /// <summary>D3 window size for status bar (width x height).</summary>
    public int WindowWidth { get; init; }
    public int WindowHeight { get; init; }
    /// <summary>OAuth script connected for status bar.</summary>
    public bool OauthScriptConnected { get; init; }
    /// <summary>Path icons in bottom bar: config path exists and matches exe name. Set by UpdateFromPaths on background thread.</summary>
    public bool PathValidBn { get; init; }
    public bool PathValidD3 { get; init; }
    public bool PathValidRos { get; init; }
    /// <summary>ROSBOT version suffix for bottom bar (e.g. "Asia_36.0129"). Set by UpdateFromPaths.</summary>
    public string? RosVersionDisplay { get; init; }
}
