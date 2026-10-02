// PY-REF: pyapps/d3-check/d3utils/tick_driver.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Tick snapshot passed to flow steps: GlobalTick (+1 every 1 s) and FlowTick (GlobalTick / 2). 1:1 Python d3utils/tick_driver.py get_global_tick / get_flow_tick_from_global.</summary>
public interface IFlowTick
{
    int GlobalTick { get; }

    int FlowTick { get; }
}
