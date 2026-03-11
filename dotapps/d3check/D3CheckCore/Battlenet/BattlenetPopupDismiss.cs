using System.Linq;
using FlaUI.Core.AutomationElements;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Dismiss Battle.net in-client popups or reconnect banners. When any popup/reconnect text (中英文) is present, find a clickable element and invoke to close.
/// Must exclude main window title-bar close button (AutomationId with TopLayer.buttonContainer + winCloseButton) — clicking it would close the whole client. 1:1 Python battlenet_ui_inspector filter_popup_close_controls + is_main_window_close_button.
/// </summary>
public static class BattlenetPopupDismiss
{
    /// <summary>
    /// If the Battle.net window has an element whose Name contains popup/reconnect or close-button keywords and supports Invoke, click it once.
    /// Excludes main window close (title-bar X). Returns true if such an element was found and invoked.
    /// 1:1 Python try_close_popup; called every BN-only tick when state not operable so in-client popups are auto-detected and closed.
    /// </summary>
    public static bool TryDismissPopupOrReconnect()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null)
        {
            ColorPrinter.Gray("[DEBUG][BattlenetPopupDismiss] GetWindow()=null, skip popup detection.");
            return false;
        }
        var el = FindFirstClickableWithPopupOrReconnectKeyword(window);
        if (el == null)
        {
            ColorPrinter.Gray("[DEBUG][BattlenetPopupDismiss] No clickable popup/reconnect element found in BN UI tree (keywords: PopupOrReconnectKeywords, PopupCloseButtonKeywords; main window close excluded).");
            return false;
        }
        var name = el.Properties.Name.ValueOrDefault ?? "";
        var aid = el.Properties.AutomationId.ValueOrDefault ?? "";
        ColorPrinter.Gray($"[DEBUG][BattlenetPopupDismiss] Found clickable element Name=\"{name}\" AutomationId=\"{aid}\", invoking to dismiss (main window close excluded).");
        if (UIOperations.Invoke(el))
        {
            ColorPrinter.Blue("[BattlenetPopupDismiss] Clicked to dismiss: \"" + name + "\"");
            return true;
        }
        ColorPrinter.Gray("[DEBUG][BattlenetPopupDismiss] Invoke returned false for \"" + name + "\".");
        return false;
    }

    /// <summary>True if automation_id is the main window title-bar close (X). Must not be clicked by try_close_popup. 1:1 Python is_main_window_close_button.</summary>
    public static bool IsMainWindowCloseButton(string? automationId)
    {
        if (string.IsNullOrWhiteSpace(automationId))
            return false;
        var aid = automationId.Trim();
        if (!aid.Contains("winCloseButton", StringComparison.OrdinalIgnoreCase))
            return false;
        foreach (var sub in BattlenetConstants.MainWindowCloseAutomationIdSubstrings)
        {
            if (!string.IsNullOrEmpty(sub) && aid.Contains(sub, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static AutomationElement? FindFirstClickableWithPopupOrReconnectKeyword(AutomationElement root)
    {
        return UIOperations.FindFirst(root, e =>
        {
            var name = e.Properties.Name.ValueOrDefault ?? "";
            if (string.IsNullOrEmpty(name))
                return false;
            bool nameMatch = BattlenetConstants.PopupOrReconnectKeywords.Any(kw =>
                    name.Contains(kw, StringComparison.OrdinalIgnoreCase))
                || BattlenetConstants.PopupCloseButtonKeywords.Any(kw =>
                    name.Contains(kw, StringComparison.OrdinalIgnoreCase));
            if (!nameMatch)
                return false;
            var aid = e.Properties.AutomationId.ValueOrDefault ?? "";
            if (IsMainWindowCloseButton(aid))
            {
                ColorPrinter.Gray($"[DEBUG][BattlenetPopupDismiss] Skip main window close button AutomationId=\"{aid}\" Name=\"{name}\".");
                return false;
            }
            try
            {
                return e.Patterns.Invoke.IsSupported;
            }
            catch
            {
                return false;
            }
        });
    }
}
