// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_only.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_only_state.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// "Ensure Battle.net only" flow: refresh Battle.net status (+ notify on change), then run the B block with noActivate=true (really
/// starts and logs in Battle.net); confirmed drops back to B13 poll. While the flow master is on it owns Battle.net (its own B block
/// when D3 is down, hands off while D3 runs), so this flow only refreshes. 1:1 Python d3utils/rosbot_flow/flow_bn_only.py.
/// </summary>
public static class BnOnlyFlow
{
    private const string LogTag = "[BNOnly]";
    private const bool ForBnOnly = true;

    /// <summary>One BN-only tick (2 s flow step while BN-only is enabled). 1:1 Python tick_bn_only_flow.</summary>
    public static void Tick()
    {
        try
        {
            var host = RosbotFlowHost.Current;
            if (host?.RefreshBattlenetStatus() == true)
                host.NotifyStateSync();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogTag} step=refresh_notify error: {ex.Message}");
            return;
        }

        var state = RosbotFlowState.Instance;
        if (!state.BnOnlyEnabled || state.FlowMasterEnabled)
            return;

        ColorPrinter.Gray($"{LogTag} step=run_bn_tick: tick_battlenet_ready_flow(no_activate=True)...");
        var (done, result) = BattlenetReadyFlow.Tick(noActivate: true);
        if (done && result == BattlenetReadyFlow.ResultConfirmed)
            BnBlockState.ResetConfirmedToPoll(ForBnOnly);
    }
}
