// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/tick_driver.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Tick snapshot passed to periodic callbacks: GlobalTick (+1 every 1 s). 1:1 Python d3utils/tick_driver.py get_global_tick.</summary>
public interface IFlowTick
{
    int GlobalTick { get; }
}
