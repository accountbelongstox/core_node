using System.Diagnostics;
using DotCore.Foundations;

namespace DotCore.UIInspect;

/// <summary>Print UI inspect results via ColorPrinter (DOT log pipeline).</summary>
public static class UIInspectPrinter
{
    public static void PrintClickableButtons(Process process)
    {
        if (process == null || process.HasExited)
        {
            ColorPrinter.Yellow("[UIInspect] Process is null or has exited.");
            return;
        }

        var isElectron = ElectronDetector.IsElectron(process);
        ColorPrinter.Gray("[UIInspect] Is Electron: " + isElectron);

        var buttons = UIButtonEnumerator.GetClickableButtons(process);
        ColorPrinter.Blue("[UIInspect] Clickable buttons (" + buttons.Count + "):");
        foreach (var item in buttons)
        {
            var line = string.IsNullOrEmpty(item.Name)
                ? "  [" + item.ControlType + "] AutomationId=" + item.AutomationId
                : "  \"" + item.Name + "\" [" + item.ControlType + "]";
            ColorPrinter.Gray("[UIInspect] " + line);
        }
    }

    public static void PrintClickableButtonsByProcessId(int processId)
    {
        Process? process;
        try
        {
            process = Process.GetProcessById(processId);
        }
        catch
        {
            ColorPrinter.Yellow("[UIInspect] Process not found: " + processId);
            return;
        }

        PrintClickableButtons(process);
    }
}
