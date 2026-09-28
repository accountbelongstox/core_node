using System.Diagnostics;
using FlaUI.Core.AutomationElements;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Shared UI helpers for Battle.net: get main window for automation. Used by both CN and Asia operations.
/// </summary>
public static class BattlenetUiHelper
{
    /// <summary>Returns the main window AutomationElement for the current Battle.net process, or null.</summary>
    public static AutomationElement? GetWindow()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null)
        {
            ColorPrinter.Gray("[DEBUG][BattlenetUiHelper] GetProcess()=null, GetWindow returns null.");
            return null;
        }
        var window = UIOperations.GetMainWindow(process);
        if (window == null)
            ColorPrinter.Gray("[DEBUG][BattlenetUiHelper] GetMainWindow(process)=null.");
        return window;
    }
}
