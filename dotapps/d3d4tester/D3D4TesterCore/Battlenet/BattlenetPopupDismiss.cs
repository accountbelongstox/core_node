// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/battlenet_ui_inspector.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/battlenet_operation_base.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Find and close in-page modals (welcome / promotion) via the Close button inside the modal subtree; the main window X is never clicked.
/// </summary>
public static class BattlenetPopupDismiss
{
    /// <summary>First in-page modal (automation id ending "-modal") that has a Close button, or null.</summary>
    public static BattlenetControl? FindModal(IReadOnlyList<BattlenetControl> controls) =>
        controls.Where(c => c.AutomationId.EndsWith(BattlenetConstants.ModalAutomationIdSuffix, StringComparison.Ordinal))
            .FirstOrDefault(m => FindModalClose(controls, m) != null);

    /// <summary>Close button inside the modal subtree (controls after it with a deeper level, until the subtree ends).</summary>
    private static BattlenetControl? FindModalClose(IReadOnlyList<BattlenetControl> controls, BattlenetControl modal)
    {
        int start = -1;
        for (int i = 0; i < controls.Count; i++)
            if (ReferenceEquals(controls[i], modal)) { start = i; break; }
        if (start < 0) return null;
        for (int i = start + 1; i < controls.Count && controls[i].Level > modal.Level; i++)
        {
            var c = controls[i];
            if (c.Type == BattlenetConstants.ButtonControlType && BattlenetConstants.ModalCloseNames.Contains(c.Name.Trim(), StringComparer.OrdinalIgnoreCase))
                return c;
        }
        return null;
    }

    /// <summary>Close an in-page modal (welcome / promotion) via its Close button. True when one was clicked.</summary>
    public static bool TryCloseModal()
    {
        var controls = BattlenetControlTree.Enumerate();
        var modal = FindModal(controls);
        var close = modal == null ? null : FindModalClose(controls, modal);
        if (close == null) return false;
        ColorPrinter.Blue($"[BattlenetPopup] closing modal {modal!.AutomationId}");
        return BattlenetControlTree.ClickControl(close);
    }
}
