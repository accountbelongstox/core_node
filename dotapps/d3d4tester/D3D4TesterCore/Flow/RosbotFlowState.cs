// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_state.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Flow switches (flow_master, bn_only) as a view over GameInterfaceData, which holds the only copy. The tick always runs;
/// flow steps skip when inactive. 1:1 Python d3utils/rosbot_flow_state.py.
/// </summary>
public sealed class RosbotFlowState
{
    public static RosbotFlowState Instance { get; } = new();

    private RosbotFlowState()
    {
    }

    public bool FlowMasterEnabled => GameInterfaceData.Instance.RosbotFlowMasterEnabled;

    public bool BnOnlyEnabled => GameInterfaceData.Instance.EnsureBattlenetOnlyEnabled;

    /// <summary>True when the flow tick should run (flow_master or bn_only).</summary>
    public bool IsFlowActive => FlowMasterEnabled || BnOnlyEnabled;

    public void SetFlowMasterEnabled(bool enabled) => GameInterfaceData.Instance.SetRosbotFlowMasterEnabled(enabled);

    public void SetBnOnlyEnabled(bool enabled) => GameInterfaceData.Instance.SetEnsureBattlenetOnlyEnabled(enabled);
}
