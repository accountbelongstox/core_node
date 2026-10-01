namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Single source of truth for flow_master and bn_only; syncs to GameInterfaceData for UI. The tick always runs; flow steps skip when inactive.
/// 1:1 Python d3utils/rosbot_flow_state.py (module state -> Instance).
/// </summary>
public sealed class RosbotFlowState
{
    private readonly object _lock = new();
    private volatile bool _flowMasterEnabled;
    private volatile bool _bnOnlyEnabled;

    public static RosbotFlowState Instance { get; } = new();

    private RosbotFlowState()
    {
    }

    public bool FlowMasterEnabled => _flowMasterEnabled;

    public bool BnOnlyEnabled => _bnOnlyEnabled;

    /// <summary>True when the flow tick should run (flow_master or bn_only).</summary>
    public bool IsFlowActive => _flowMasterEnabled || _bnOnlyEnabled;

    public void SetFlowMasterEnabled(bool enabled)
    {
        lock (_lock)
        {
            if (_flowMasterEnabled == enabled) return;
            _flowMasterEnabled = enabled;
        }
        GameInterfaceData.Instance.SetRosbotFlowMasterEnabled(enabled);
    }

    public void SetBnOnlyEnabled(bool enabled)
    {
        lock (_lock)
        {
            if (_bnOnlyEnabled == enabled) return;
            _bnOnlyEnabled = enabled;
        }
        GameInterfaceData.Instance.SetEnsureBattlenetOnlyEnabled(enabled);
    }
}
