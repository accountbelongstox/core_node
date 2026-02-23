using System.Diagnostics;

namespace DotCore.UIInspect;

public static class UIInspectPrinter
{
    public static void PrintClickableButtons(Process process)
    {
        if (process == null || process.HasExited)
        {
            Console.WriteLine("Process is null or has exited.");
            return;
        }

        var isElectron = ElectronDetector.IsElectron(process);
        Console.WriteLine("Is Electron: " + isElectron);

        var buttons = UIButtonEnumerator.GetClickableButtons(process);
        Console.WriteLine($"Clickable buttons ({buttons.Count}):");
        foreach (var item in buttons)
        {
            var line = string.IsNullOrEmpty(item.Name)
                ? $"  [{item.ControlType}] AutomationId={item.AutomationId}"
                : $"  \"{item.Name}\" [{item.ControlType}]";
            Console.WriteLine(line);
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
            Console.WriteLine("Process not found: " + processId);
            return;
        }

        PrintClickableButtons(process);
    }
}
