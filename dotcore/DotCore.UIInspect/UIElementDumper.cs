using System.Diagnostics;
using System.Text;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;

namespace DotCore.UIInspect;

/// <summary>
/// Dump all UI elements from a process main window (tree: ControlType, Name, AutomationId, text/value, etc.).
/// Used by DEBUG Battle.net UI: write to temp file, open in Notepad, show in log.
/// </summary>
public static class UIElementDumper
{
    /// <summary>Max tree depth to avoid hang on huge trees. 0 = no limit.</summary>
    public const int DefaultMaxDepth = 50;

    /// <summary>Dump full UI tree to a string. Each line: indent + ControlType | Name | AutomationId | Value/ClassName/HelpText.</summary>
    public static string DumpAllElements(Process? process, int maxDepth = DefaultMaxDepth)
    {
        var sb = new StringBuilder();
        if (process == null || process.HasExited)
        {
            sb.AppendLine("Process is null or has exited.");
            return sb.ToString();
        }

        try
        {
            using var automation = new UIA3Automation();
            var app = Application.Attach(process.Id);
            var mainWindow = app.GetMainWindow(automation);
            if (mainWindow == null)
            {
                sb.AppendLine("Main window not found.");
                return sb.ToString();
            }

            sb.AppendLine("--- UI tree (ControlType | Name | AutomationId | Value/ClassName/HelpText) ---");
            DumpElement(mainWindow, 0, maxDepth, sb);
        }
        catch (Exception ex)
        {
            sb.AppendLine("Error: " + ex.Message);
        }

        return sb.ToString();
    }

    private static void DumpElement(AutomationElement element, int depth, int maxDepth, StringBuilder sb)
    {
        if (maxDepth > 0 && depth >= maxDepth)
            return;

        string indent = new string(' ', depth * 2);
        string controlType = element.Properties.ControlType.ValueOrDefault.ToString();
        string name = element.Properties.Name.ValueOrDefault ?? "";
        string automationId = element.Properties.AutomationId.ValueOrDefault ?? "";
        string className = element.Properties.ClassName.ValueOrDefault ?? "";
        string helpText = element.Properties.HelpText.ValueOrDefault ?? "";
        string value = "";
        try
        {
            if (element.Patterns.Value.IsSupported)
                value = element.Patterns.Value.Pattern.Value.Value ?? "";
        }
        catch
        {
            // ignore
        }

        var parts = new List<string> { controlType };
        if (!string.IsNullOrEmpty(name)) parts.Add("Name=\"" + TruncateLine(name, 200) + "\"");
        if (!string.IsNullOrEmpty(automationId)) parts.Add("AutomationId=\"" + automationId + "\"");
        if (!string.IsNullOrEmpty(value)) parts.Add("Value=\"" + TruncateLine(value, 80) + "\"");
        if (!string.IsNullOrEmpty(className)) parts.Add("ClassName=\"" + className + "\"");
        if (!string.IsNullOrEmpty(helpText)) parts.Add("HelpText=\"" + TruncateLine(helpText, 120) + "\"");

        sb.AppendLine(indent + string.Join(" | ", parts));

        try
        {
            var children = element.FindAllChildren();
            if (children != null)
            {
                foreach (var child in children)
                {
                    try
                    {
                        DumpElement(child, depth + 1, maxDepth, sb);
                    }
                    catch
                    {
                        sb.AppendLine(new string(' ', (depth + 1) * 2) + "[error reading child]");
                    }
                }
            }
        }
        catch
        {
            sb.AppendLine(indent + "  [error enumerating children]");
        }
    }

    private static string TruncateLine(string s, int maxLen)
    {
        s = (s ?? "").Replace("\r", "").Replace("\n", " ");
        return s.Length <= maxLen ? s : s.Substring(0, maxLen) + "...";
    }
}
