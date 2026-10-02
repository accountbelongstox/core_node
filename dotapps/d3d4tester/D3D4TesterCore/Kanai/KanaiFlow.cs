// PY-REF: pyapps/d3-check/d3utils/kanai/flow.py
// PY-REF: pyapps/d3-check/controller/ctl_func/kanai_cube_handler.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>
/// Kanai flow entry; caller has captured, collected bag info and interface_type == kanai_cube.
/// 1:1 Python pyapps/d3-check/d3utils/kanai/flow.py (kanai_cube_handler.py thin wrapper folded in).
/// </summary>
public static class KanaiFlow
{
    /// <summary>1:1 run_kanai_upgrade_flow.</summary>
    public static bool RunUpgradeFlow()
    {
        var shared = GameInterfaceData.Instance;
        if (!IsKanai(shared)) return false;
        ColorPrinter.Blue("[KanaiFlow] Running Kanai upgrade operation...");
        return KanaiOperations.RunUpgradeOperation(shared);
    }

    /// <summary>1:1 run_kanai_reforge_flow.</summary>
    public static bool RunReforgeFlow()
    {
        var shared = GameInterfaceData.Instance;
        if (!IsKanai(shared)) return false;
        ColorPrinter.Blue("[KanaiFlow] Running Kanai reforge operation...");
        return KanaiOperations.RunReforgeOperation(shared);
    }

    private static bool IsKanai(GameInterfaceData shared)
    {
        if (shared.InterfaceType == D3InterfaceDetection.InterfaceKanaiCube) return true;
        ColorPrinter.Yellow("[KanaiFlow] Not Kanai Cube interface, skip");
        return false;
    }
}
