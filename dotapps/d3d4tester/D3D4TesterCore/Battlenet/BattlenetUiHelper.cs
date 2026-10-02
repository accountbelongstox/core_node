// PY-REF: pyapps/d3-check/share/battlenet_ui_common.py
using FlaUI.Core.AutomationElements;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>Shared UI helper for Battle.net: root element of the first Battle.net window (by process exe).</summary>
public static class BattlenetUiHelper
{
    /// <summary>Returns the root AutomationElement of the first Battle.net window, or null.</summary>
    public static AutomationElement? GetWindow() => BattlenetControlTree.GetRoot();
}
