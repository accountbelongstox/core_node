// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_only.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// "Ensure Battle.net" guard (battlenet.ensure_normal): its own thread checks every <see cref="FlowTimings.GuardPollSec"/> and runs
/// <see cref="BattlenetReadyProcess"/> without activation. It stands aside while monitoring runs (the flow owns Battle.net and the
/// guard yields mid-run) and while D3 runs (Battle.net is reused as is).
/// </summary>
public static class BattlenetGuardRunner
{
    private const string LogTag = "[BNGuard]";

    private static readonly FlowThread Worker = new("BattlenetGuard", RunCycle);

    public static bool IsRunning => Worker.IsRunning;

    public static void Start() => Worker.Start();

    public static void Stop() => Worker.Stop();

    private static void RunCycle(FlowContext ctx)
    {
        var state = RosbotFlowState.Instance;
        if (!state.FlowMasterEnabled && !GameInterfaceData.Instance.GetStateSnapshot().D3Running)
        {
            try
            {
                BattlenetReadyProcess.Run(ctx.WithYield(() => state.FlowMasterEnabled), activate: false);
            }
            catch (OperationCanceledException) when (!ctx.IsStopped)
            {
                ColorPrinter.Gray($"{LogTag} monitoring started, Battle.net handed to the flow");
            }
        }
        ctx.Wait(FlowTimings.GuardPollSec);
    }
}
