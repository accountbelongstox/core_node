// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_state.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Flow switches (monitoring = flow master, Battle.net guard = bn_only) as a view over GameInterfaceData, which holds the only copy;
/// RosbotFlowRunner / BattlenetGuardRunner set them when they start and stop. 1:1 Python d3utils/rosbot_flow_state.py.
/// </summary>
public sealed class RosbotFlowState
{
    /// <summary>Stop predicate for long flow steps: true once the flow master (Start / Stop monitoring) is off.</summary>
    public static bool FlowStopped() => !Instance.FlowMasterEnabled;

    public static RosbotFlowState Instance { get; } = new();

    private RosbotFlowState()
    {
    }

    public bool FlowMasterEnabled => GameInterfaceData.Instance.RosbotFlowMasterEnabled;

    public bool BnOnlyEnabled => GameInterfaceData.Instance.EnsureBattlenetOnlyEnabled;

    /// <summary>Monitoring is on but paused: the flow is halted and ROSBOT was paused with its pause key.</summary>
    public bool Paused => GameInterfaceData.Instance.RosbotFlowPaused;

    public void SetFlowMasterEnabled(bool enabled) => GameInterfaceData.Instance.SetRosbotFlowMasterEnabled(enabled);

    public void SetPaused(bool paused) => GameInterfaceData.Instance.SetRosbotFlowPaused(paused);

    public void SetBnOnlyEnabled(bool enabled) => GameInterfaceData.Instance.SetEnsureBattlenetOnlyEnabled(enabled);
}
