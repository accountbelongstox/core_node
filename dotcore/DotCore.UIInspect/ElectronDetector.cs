using System.Diagnostics;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;

namespace DotCore.UIInspect;

public static class ElectronDetector
{
    private static readonly string[] ElectronWindowClassPrefixes = ["Chrome_WidgetWin", "Chrome_RenderWidgetHostHWND", "Electron"];
    private static readonly string[] ElectronFrameworkIds = ["Chrome", "Electron"];

    public static bool IsElectron(Process process)
    {
        if (process == null || process.HasExited)
            return false;

        try
        {
            using var automation = new UIA3Automation();
            var app = Application.Attach(process.Id);
            var mainWindow = app.GetMainWindow(automation);
            if (mainWindow == null)
                return false;

            var className = mainWindow.Properties.ClassName.ValueOrDefault;
            if (!string.IsNullOrEmpty(className))
            {
                foreach (var prefix in ElectronWindowClassPrefixes)
                    if (className.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        return true;
            }

            var frameworkId = mainWindow.Properties.FrameworkId.ValueOrDefault;
            if (!string.IsNullOrEmpty(frameworkId))
            {
                foreach (var id in ElectronFrameworkIds)
                    if (frameworkId.Equals(id, StringComparison.OrdinalIgnoreCase))
                        return true;
            }

            return IsElectronByTree(mainWindow);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsElectronByTree(AutomationElement root)
    {
        try
        {
            var walker = root.Automation.TreeWalkerFactory.GetControlViewWalker();
            var child = walker.GetFirstChild(root);
            while (child != null)
            {
                var frameworkId = child.Properties.FrameworkId.ValueOrDefault;
                if (!string.IsNullOrEmpty(frameworkId) && frameworkId.Equals("Chrome", StringComparison.OrdinalIgnoreCase))
                    return true;
                child = walker.GetNextSibling(child);
            }
        }
        catch
        {
            // ignore
        }

        return false;
    }
}
