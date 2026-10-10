// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/game_interface_data.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Thread-safe snapshot of game interface state for UI. Matches Python get_state_snapshot() keys.
/// Single source for bottom bar and panels; flow/status providers write, UI reads via this snapshot.
/// </summary>
public sealed class GameInterfaceStateSnapshot
{
    /// <summary>Map type / game stage value when not known.</summary>
    public const string UnknownValue = "unknown";

    public bool BattlenetWindowFound { get; init; }
    public string? BattlenetRegion { get; init; }
    public bool RosbotWindowFound { get; init; }
    public bool RosbotHasMainUi { get; init; }
    public string RosbotExtendedStatus { get; init; } = "not_found";
    public bool RosbotRunning { get; init; }
    /// <summary>Master state: true when user clicks Start ROSBOT, false when Stop. Logic 1:1 with Python rosbot_flow_master_enabled.</summary>
    public bool RosbotFlowMasterEnabled { get; init; }
    /// <summary>Monitoring on but paused (flow halted, ROSBOT paused with its own key).</summary>
    public bool RosbotFlowPaused { get; init; }
    /// <summary>True when user has enabled "Ensure Battle.net only" (BN open + activated). Dot: set after flow runs; no tick.</summary>
    public bool EnsureBattlenetOnlyEnabled { get; init; }
    public bool D3Running { get; init; }
    /// <summary>Latest CoreNodeBridge plugin state (null = no state.json); published once per second by RosbotBridgePluginService.</summary>
    public Bridge.RosbotBridgeState? RosbotBridge { get; init; }
    /// <summary>True when <see cref="RosbotBridge"/> is current (the plugin runs inside a running ROSBOT).</summary>
    public bool RosbotBridgeFresh { get; init; }
    public string MapType { get; init; } = UnknownValue;
    public string GameStage { get; init; } = UnknownValue;
    public bool D3OnLoginScreen { get; init; }
    public bool D3Disconnected { get; init; }
    public bool D3InGame { get; init; }
    public bool BattlenetOnLoginScreen { get; init; }
    public bool BattlenetDisconnected { get; init; }
    /// <summary>Probed client screen (connecting, CN/Asia login steps, browser wait, sleeping, ...). Refreshed every 10 s and by the flows.</summary>
    public Battlenet.BattlenetClientState BattlenetClientState { get; init; }
    /// <summary>Region the client UI shows ("cn" / "asia"), null when the screen does not tell.</summary>
    public string? BattlenetUiRegion { get; init; }
    /// <summary>D3 / D4 tab and Play button recognised on the client (status bar icons; next step switches tab and starts the game).</summary>
    public Battlenet.BattlenetGameUi BattlenetGameUi { get; init; } = Battlenet.BattlenetGameUi.None;
    /// <summary>Verified BattleTag next to the avatar and its presence text (null when not on the main UI).</summary>
    public string? BattlenetAccountTag { get; init; }
    public string? BattlenetAccountPresence { get; init; }
    /// <summary>Extra text for the state (e.g. the Play button label).</summary>
    public string? BattlenetStateDetail { get; init; }
    /// <summary>True when BN is in sleep mode and we are waiting for wake (show 唤醒中 in status bar). ROSBOT must not start until false.</summary>
    public bool BattlenetWakingUp { get; init; }
    public bool BattlenetNormalAvailable { get; init; }
    public string RosbotFoundExeName { get; init; } = "";
    public string RosbotFoundWindowTitle { get; init; } = "";
    /// <summary>PID of the found ROSBOT process (0 = none).</summary>
    public int RosbotFoundPid { get; init; }
    /// <summary>Exe file name and PID of the D3 client owning the found window ("" / 0 = none).</summary>
    public string D3ExeName { get; init; } = "";
    public int D3Pid { get; init; }
    public bool RosbotNeedKeyInput { get; init; }
    public string RosbotNeedKeyMessage { get; init; } = "";
    public string? RosbotTestModeDisplay { get; init; }
    public int RosbotTotalRestartCount { get; init; }
    /// <summary>D3 window size for status bar (width x height).</summary>
    public int WindowWidth { get; init; }
    public int WindowHeight { get; init; }
    /// <summary>Path icons in bottom bar: config path exists and matches exe name. Set by UpdateFromPaths on background thread.</summary>
    public bool PathValidBn { get; init; }
    public bool PathValidD3 { get; init; }
    public bool PathValidRos { get; init; }
    /// <summary>ROSBOT version suffix for bottom bar (e.g. "Asia_36.0129"). Set by UpdateFromPaths.</summary>
    public string? RosVersionDisplay { get; init; }
}
