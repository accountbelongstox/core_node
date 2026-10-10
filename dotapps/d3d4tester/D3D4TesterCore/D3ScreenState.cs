// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/d3_start_game_and_teleport_waiter.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/scaled_template_matcher_base.py
using DotCore.ScreenCapture;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// D3 screen state from one game-window capture (all templates at once): disconnected / Start Game button / game tool / connecting.
/// Used by the D3 status refresh, the manual login try and F3. The map teleport is done by the CoreNodeBridge plugin, not here.
/// </summary>
public static class D3ScreenState
{
    public const string StateDisconnect = "disconnect";
    public const string StateStart = "start";
    public const string StateGameTool = "game_tool";
    public const string StateWait = "wait";

    private static readonly D3StatesMatch NoStates = new(false, false, false, false);

    private static D3Manager D3 => D3Manager.Instance;

    /// <summary>
    /// One D3 capture -> all UI states (disconnected / start_game_button / game_tool / connecting).
    /// Used by D3StatusProvider dynamic detection. 1:1 Python capture_and_detect_all_d3_states.
    /// </summary>
    public static (ScreenshotData? Sd, D3StatesMatch States) CaptureAndDetectAllD3States()
    {
        var sd = D3.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null) return (sd, NoStates);
        return (sd, D3ScaledTemplateMatcher.Instance.MatchAllD3States(sd.GameWindowImage));
    }

    /// <summary>
    /// One capture, all templates. Priority: disconnected -> game_tool -> start -> connecting -> null.
    /// Returns disconnect | start | game_tool | wait | null. 1:1 Python detect_d3_already_running_state.
    /// </summary>
    public static string? DetectD3AlreadyRunningState()
    {
        var (_, s) = CaptureAndDetectAllD3States();
        if (s.Disconnected) return StateDisconnect;
        if (s.GameTool) return StateGameTool;
        if (s.StartGameButton) return StateStart;
        if (s.Connecting) return StateWait;
        return null;
    }
}
