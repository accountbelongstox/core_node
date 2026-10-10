// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/kanai/flow.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/ctl_func/kanai_cube_handler.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>
/// Kanai flow entry; caller has captured, collected bag info and interface_type == kanai_cube.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/kanai/flow.py (kanai_cube_handler.py thin wrapper folded in).
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

    /// <summary>
    /// Reset to the reforge page, then reforge the legendary under the cursor until the mode is met.
    /// Fixes Python bug: run_kanai_reforge_flow processed rare items (upgrade recipe) and ignored kanai_reforge.mode.
    /// </summary>
    public static bool RunReforgeFlow(string? mode, (int X, int Y)? cursor, int helperDelayMs, Func<bool> shouldStop)
    {
        var shared = GameInterfaceData.Instance;
        if (!IsKanai(shared)) return false;
        ColorPrinter.Blue("[KanaiFlow] Running Kanai reforge operation...");
        if (!KanaiOperations.ResetPanelToFirstPage(shared) || !KanaiOperations.NavigateToPage(shared, KanaiOperations.ReforgePageClicks)) return false;
        return KanaiRecipeHelper.RunReforge(shared, mode, cursor, helperDelayMs, shouldStop);
    }

    /// <summary>Convert materials on the open convert recipe page (D3KeyHelper: the page is opened by the player).</summary>
    public static bool RunConvertFlow(string? material, string keep, int helperDelayMs, Func<bool> shouldStop)
    {
        var shared = GameInterfaceData.Instance;
        if (!IsKanai(shared)) return false;
        ColorPrinter.Blue("[KanaiFlow] Running Kanai convert operation...");
        return KanaiRecipeHelper.RunConvert(shared, material, keep, helperDelayMs, shouldStop);
    }

    private static bool IsKanai(GameInterfaceData shared)
    {
        if (shared.InterfaceType == D3InterfaceDetection.InterfaceKanaiCube) return true;
        ColorPrinter.Yellow("[KanaiFlow] Not Kanai Cube interface, skip");
        return false;
    }
}
