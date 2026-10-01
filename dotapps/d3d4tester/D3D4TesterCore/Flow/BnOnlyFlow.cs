using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// "Ensure Battle.net only" flow: refresh Battle.net status (+ notify on change), re-check the flag, run the B block with
/// noActivate=true (really starts and logs in Battle.net), then keep the result; confirmed drops back to B13 poll.
/// 1:1 Python d3utils/rosbot_flow/flow_bn_only.py + flow_bn_only_state.py.
/// </summary>
public static class BnOnlyFlow
{
    private const string LogTag = "[BNOnly]";
    private const bool ForBnOnly = true;

    private static readonly object StateLock = new();
    private static bool _lastBnDone;
    private static string? _lastBnResult;

    /// <summary>1:1 Python get_last_bn_result.</summary>
    public static (bool Done, string? Result) GetLastBnResult()
    {
        lock (StateLock) return (_lastBnDone, _lastBnResult);
    }

    /// <summary>1:1 Python reset_bn_only_flow_state.</summary>
    public static void ResetState()
    {
        lock (StateLock)
        {
            _lastBnDone = false;
            _lastBnResult = null;
        }
    }

    /// <summary>One BN-only tick (call on the 2 s flow step while BN-only is enabled). 1:1 Python tick_bn_only_flow.</summary>
    public static void Tick()
    {
        try
        {
            ColorPrinter.Gray($"{LogTag} step=refresh_notify: refresh_battlenet_status...");
            bool changed = BattlenetFlowHooks.RefreshBattlenetStatus?.Invoke() ?? false;
            if (changed)
                BattlenetFlowHooks.NotifyStateSync?.Invoke();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogTag} step=refresh_notify error: {ex.Message}");
            return;
        }

        if (!RosbotFlowState.Instance.BnOnlyEnabled)
            return;

        ColorPrinter.Gray($"{LogTag} step=run_bn_tick: tick_battlenet_ready_flow(no_activate=True)...");
        var (done, result) = BattlenetReadyFlow.Tick(noActivate: true);

        lock (StateLock)
        {
            _lastBnDone = done;
            _lastBnResult = result;
        }
        if (done && result == BattlenetReadyFlow.ResultConfirmed)
            BnBlockState.ResetConfirmedToPoll(ForBnOnly);
    }
}
