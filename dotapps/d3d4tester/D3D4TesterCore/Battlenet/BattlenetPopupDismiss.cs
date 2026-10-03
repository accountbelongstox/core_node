// PY-REF: pyapps/d3-check/d3utils/battlenet_ui_inspector.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Classify and close in-UI floating popups. Only ButtonControls whose AutomationId contains winCloseButton (not the main
/// title bar) or whose name is a close keyword are clicked; the main window X is never clicked.
/// 1:1 Python d3utils/battlenet_ui_inspector.py + battlenet_operation_base.try_close_popup.
/// Fixes Python-port bug: the previous C# version invoked any element named Retry/Cancel/Yes/OK (could cancel login or retry).
/// </summary>
public static class BattlenetPopupDismiss
{
    /// <summary>True if automation_id is the main window title-bar close (X). 1:1 Python is_main_window_close_button.</summary>
    public static bool IsMainWindowCloseButton(string? automationId)
    {
        var aid = (automationId ?? "").Trim();
        if (aid.Length == 0) return false;
        foreach (var sub in BattlenetConstants.MainWindowCloseAutomationIdSubstrings)
        {
            if (!string.IsNullOrEmpty(sub) && aid.Contains(sub, StringComparison.Ordinal) && aid.Contains("winCloseButton", StringComparison.Ordinal))
                return true;
        }
        return false;
    }

    /// <summary>1:1 Python is_popup_close_button_by_automation_id.</summary>
    public static bool IsPopupCloseButtonByAutomationId(string? automationId)
    {
        var aid = (automationId ?? "").Trim();
        if (aid.Length == 0 || IsMainWindowCloseButton(aid)) return false;
        return BattlenetConstants.PopupCloseAutomationIds.Any(s => !string.IsNullOrEmpty(s) && aid.Contains(s, StringComparison.Ordinal));
    }

    /// <summary>1:1 Python is_popup_close_button_by_name.</summary>
    public static bool IsPopupCloseButtonByName(string? name)
    {
        var n = (name ?? "").Trim();
        if (n.Length == 0) return false;
        return BattlenetConstants.PopupCloseNameKeywords.Any(k => !string.IsNullOrEmpty(k) && n.Contains(k, StringComparison.Ordinal));
    }

    /// <summary>Popup close ButtonControls (automation_id match first, then name), main window close excluded. 1:1 Python filter_popup_close_controls.</summary>
    public static List<BattlenetControl> FilterPopupCloseControls(IReadOnlyList<BattlenetControl> controls)
    {
        var output = new List<BattlenetControl>();
        foreach (var c in controls)
        {
            if (c.Type != BattlenetConstants.ButtonControlType) continue;
            if (IsPopupCloseButtonByAutomationId(c.AutomationId))
            {
                output.Add(c);
                continue;
            }
            if (IsPopupCloseButtonByName(c.Name) && !IsMainWindowCloseButton(c.AutomationId))
                output.Add(c);
        }
        return output;
    }

    /// <summary>Click the first popup close button (automation_id pass, then name pass). 1:1 Python try_close_popup.</summary>
    public static bool TryClosePopup(IReadOnlyList<BattlenetControl> controls)
    {
        foreach (var c in controls)
        {
            if (c.Type != BattlenetConstants.ButtonControlType || IsMainWindowCloseButton(c.AutomationId)) continue;
            if (IsPopupCloseButtonByAutomationId(c.AutomationId))
            {
                ColorPrinter.Blue($"[BattlenetOperation] Closing in-UI popup: automation_id={c.AutomationId}");
                return BattlenetControlTree.ClickControl(c);
            }
        }
        foreach (var c in controls)
        {
            if (c.Type != BattlenetConstants.ButtonControlType || IsMainWindowCloseButton(c.AutomationId)) continue;
            if (IsPopupCloseButtonByName(c.Name))
            {
                ColorPrinter.Blue($"[BattlenetOperation] Closing in-UI popup: name={c.Name}");
                return BattlenetControlTree.ClickControl(c);
            }
        }
        return false;
    }

    /// <summary>Enumerate the current Battle.net UI and close an in-UI popup if present.</summary>
    public static bool TryDismissPopupOrReconnect() => TryClosePopup(BattlenetControlTree.Enumerate());

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
