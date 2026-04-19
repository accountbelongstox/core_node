using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;

namespace DotCore.UIInspect;

public static class UIButtonEnumerator
{
    public static IReadOnlyList<ClickableItem> GetClickableButtons(Process process)
    {
        var list = new List<ClickableItem>();
        if (process == null || process.HasExited)
            return list;

        try
        {
            using var automation = new UIA3Automation();
            var app = Application.Attach(process.Id);
            var mainWindow = app.GetMainWindow(automation);
            if (mainWindow == null)
                return list;

            CollectClickables(mainWindow, list);
        }
        catch
        {
            // return partial list or empty
        }

        return list;
    }

    private static void CollectClickables(AutomationElement root, List<ClickableItem> list)
    {
        var children = root.FindAllChildren();
        if (children == null)
            return;

        foreach (var child in children)
        {
            try
            {
                var controlType = child.Properties.ControlType.ValueOrDefault;
                var name = child.Properties.Name.ValueOrDefault ?? "";
                var automationId = child.Properties.AutomationId.ValueOrDefault ?? "";
                var isButton = controlType == ControlType.Button;
                var hasInvoke = child.Patterns.Invoke.IsSupported;

                if (isButton || hasInvoke)
                {
                    var item = new ClickableItem(
                        name,
                        controlType.ToString(),
                        automationId
                    );
                    if (!list.Any(x => x.Name == item.Name && x.ControlType == item.ControlType && x.AutomationId == item.AutomationId))
                        list.Add(item);
                }

                CollectClickables(child, list);
            }
            catch
            {
                // skip element
            }
        }
    }
}

public sealed record ClickableItem(string Name, string ControlType, string AutomationId);
