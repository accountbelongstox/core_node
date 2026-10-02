// PY-REF: none (DOT-only)
using System.Windows;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// D3D4Tester-specific center message window: inherits from DotCore.UITheme.Controls.CenterMessageWindow.
/// Use for ROSBOT no-update toast and other in-app centered toasts.
/// </summary>
public sealed class D3D4TesterCenterMessageWindow : DotCore.UITheme.Controls.CenterMessageWindow
{
    /// <summary>Show a non-modal "no update" style message centered on owner; auto-close after 8 seconds.</summary>
    public static void ShowNoUpdate(Window? owner, string message, string title = "ROSBOT Update", int autoCloseSeconds = 8)
    {
        Show(owner, message, title, autoCloseSeconds);
    }
}
