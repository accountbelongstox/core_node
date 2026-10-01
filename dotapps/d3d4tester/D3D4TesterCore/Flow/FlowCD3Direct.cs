using DotCore.Utils.Window;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>C block steps (ROSBOT_FLOW_MERMAID C: D3 already running direct); phase state lives in ExtensionFlowState.</summary>
public enum CBlockStep
{
    C1Entry,
    C2Resize,
    C3Step,
    C3Result,
    C3GameToolOrigin,
    C3wWait,
    C5StartGame,
    C5wWait,
    C6GameTool,
    C7aPressM,
    C7wWait,
    C7bTeleport,
    C8Result,
    C10Check,
    C10Result,
    C12EndD3,
}

/// <summary>
/// C block step helpers: C1 entry gate, C2 resize to standard client size, C3 detect, C3_Result branch (C10 M-similarity),
/// C12 end D3, C4 disconnect -> F1d + F1c. 1:1 Python d3utils/rosbot_flow/flow_c_d3_direct.py.
/// </summary>
public static class FlowCD3Direct
{
    /// <summary>[C1] True when the C branch should run (BN confirmed + D3 process).</summary>
    public static bool RunC1Entry(bool hasBnConfirmed, bool hasD3Process) => hasBnConfirmed && hasD3Process;

    /// <summary>[C2] Resize the D3 window client to the standard resolution and invalidate the window cache.</summary>
    public static void RunC2Resize()
    {
        WindowResizer.ResizeWindowByTitlesToClientSize(
            D3WindowConstants.DiabloIIIWindowTitles,
            D3ScaleConstants.D3StandardResolutionWidth,
            D3ScaleConstants.D3StandardResolutionHeight);
        D3Manager.Instance.InvalidateWindowCache();
    }

    /// <summary>[C3] One step: capture and match all templates. Returns disconnect | start | game_tool | wait | null.</summary>
    public static string? RunC3ScreenshotState() => D3StartGameAndTeleport.DetectD3AlreadyRunningState();

    /// <summary>
    /// [C3_Result] Branch on the C3 result: start | game_tool | disconnect | wait | other.
    /// game_tool runs the blocking C10 M-similarity check (offline -> disconnect).
    /// </summary>
    public static string RunC4BranchResult(string? state)
    {
        switch (state)
        {
            case D3StartGameAndTeleport.StateDisconnect:
                return ExtensionFlowState.BranchDisconnect;
            case D3StartGameAndTeleport.StateWait:
                return ExtensionFlowState.BranchWait;
            case D3StartGameAndTeleport.StateGameTool:
                return D3StartGameAndTeleport.CheckD3OnlineByMSimilarity()
                    ? ExtensionFlowState.BranchGameTool
                    : ExtensionFlowState.BranchDisconnect;
            case D3StartGameAndTeleport.StateStart:
                return ExtensionFlowState.BranchStart;
            default:
                return ExtensionFlowState.BranchOther;
        }
    }

    /// <summary>[C12] End the D3 process; the D flow follows.</summary>
    public static void RunC12EndD3() => D3Manager.Instance.KillIfRunning();

    /// <summary>C4 detected disconnect: F1d then F1c.</summary>
    public static void RunC4DisconnectThenF1dF1c()
    {
        F1cF1d.RunF1dOnDisconnect();
        F1cF1d.RunF1cEndD3();
    }
}
