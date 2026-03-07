using System.Diagnostics;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;

namespace DotCore.UIInspect;

/// <summary>
/// UI operations on a process main window: find elements by name/automationId, Invoke (click), Get/Set Value.
/// Based on FlaUI official API: Application.Attach, GetMainWindow, Patterns.Invoke, Patterns.Value.
/// See https://github.com/FlaUI/FlaUI and FlaUI wiki for patterns and automation elements.
/// </summary>
public static class UIOperations
{
    /// <summary>Default max depth when searching the UI tree. 0 = no limit.</summary>
    public const int DefaultMaxDepth = 100;

    /// <summary>Run an action with the window root obtained from a window handle. Automation is created and disposed inside. 1:1 Python ControlFromHandle(hwnd).</summary>
    public static bool RunWithWindowRoot(IntPtr hwnd, Func<AutomationElement?, bool> action)
    {
        if (hwnd == IntPtr.Zero || action == null)
            return false;
        try
        {
            using var automation = new UIA3Automation();
            var root = automation.FromHandle(hwnd);
            return action(root);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Get the main window AutomationElement for the process. Returns null if process has no main window or attach failed.</summary>
    public static AutomationElement? GetMainWindow(Process? process)
    {
        if (process == null || process.HasExited)
            return null;
        try
        {
            using var automation = new UIA3Automation();
            var app = Application.Attach(process.Id);
            return app.GetMainWindow(automation);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Find first descendant where Name equals or contains <paramref name="text"/> (case-insensitive).</summary>
    public static AutomationElement? FindFirstByName(AutomationElement root, string text, bool exactMatch = false, int maxDepth = DefaultMaxDepth)
    {
        return FindFirst(root, e =>
        {
            var name = e.Properties.Name.ValueOrDefault ?? "";
            return exactMatch
                ? name.Equals(text, StringComparison.OrdinalIgnoreCase)
                : name.Contains(text, StringComparison.OrdinalIgnoreCase);
        }, maxDepth);
    }

    /// <summary>Find first descendant with given AutomationId.</summary>
    public static AutomationElement? FindFirstByAutomationId(AutomationElement root, string automationId, int maxDepth = DefaultMaxDepth)
    {
        if (string.IsNullOrEmpty(automationId))
            return null;
        return FindFirst(root, e =>
            (e.Properties.AutomationId.ValueOrDefault ?? "").Equals(automationId, StringComparison.OrdinalIgnoreCase), maxDepth);
    }

    /// <summary>Find first descendant whose AutomationId contains <paramref name="substring"/> (case-insensitive).</summary>
    public static AutomationElement? FindFirstByAutomationIdContains(AutomationElement root, string substring, int maxDepth = DefaultMaxDepth)
    {
        if (string.IsNullOrEmpty(substring))
            return null;
        return FindFirst(root, e =>
            (e.Properties.AutomationId.ValueOrDefault ?? "").Contains(substring, StringComparison.OrdinalIgnoreCase), maxDepth);
    }

    /// <summary>Find first descendant whose Name contains any of the given keywords (case-insensitive).</summary>
    public static AutomationElement? FindFirstByNameContainsAny(AutomationElement root, string[] keywords, int maxDepth = DefaultMaxDepth)
    {
        if (keywords == null || keywords.Length == 0)
            return null;
        return FindFirst(root, e =>
        {
            var name = e.Properties.Name.ValueOrDefault ?? "";
            foreach (var kw in keywords)
            {
                if (!string.IsNullOrEmpty(kw) && name.Contains(kw, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }, maxDepth);
    }

    /// <summary>Find first TabItem (or ListItem) whose Name contains any of the given keywords. 1:1 Python main profile tab selection.</summary>
    public static AutomationElement? FindFirstTabItemByNameContainsAny(AutomationElement root, string[] keywords, int maxDepth = DefaultMaxDepth)
    {
        if (keywords == null || keywords.Length == 0)
            return null;
        return FindFirst(root, e =>
        {
            var ct = e.Properties.ControlType.ValueOrDefault;
            if (ct != ControlType.TabItem && ct != ControlType.ListItem)
                return false;
            var name = e.Properties.Name.ValueOrDefault ?? "";
            foreach (var kw in keywords)
            {
                if (!string.IsNullOrEmpty(kw) && name.Contains(kw, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }, maxDepth);
    }

    /// <summary>Returns true if any descendant's Name contains any of the given keywords (case-insensitive). Used e.g. for Battle.net sleep-mode detection.</summary>
    public static bool ContainsAnyKeywordInTree(Process? process, string[] keywords, int maxDepth = DefaultMaxDepth)
    {
        if (process == null || process.HasExited || keywords == null || keywords.Length == 0)
            return false;
        var root = GetMainWindow(process);
        if (root == null)
            return false;
        return ContainsAnyKeywordCore(root, keywords, 0, maxDepth);
    }

    /// <summary>Returns true if any descendant's AutomationId contains any of the given substrings (case-insensitive).</summary>
    public static bool ContainsAnyAutomationIdInTree(Process? process, string[] automationIdSubstrings, int maxDepth = DefaultMaxDepth)
    {
        if (process == null || process.HasExited || automationIdSubstrings == null || automationIdSubstrings.Length == 0)
            return false;
        var root = GetMainWindow(process);
        if (root == null)
            return false;
        return ContainsAnyAutomationIdCore(root, automationIdSubstrings, 0, maxDepth);
    }

    private static bool ContainsAnyAutomationIdCore(AutomationElement element, string[] substrings, int depth, int maxDepth)
    {
        if (maxDepth > 0 && depth > maxDepth)
            return false;
        try
        {
            var aid = element.Properties.AutomationId.ValueOrDefault ?? "";
            foreach (var sub in substrings)
            {
                if (!string.IsNullOrEmpty(sub) && aid.Contains(sub, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            var children = element.FindAllChildren();
            if (children == null)
                return false;
            foreach (var child in children)
            {
                try
                {
                    if (ContainsAnyAutomationIdCore(child, substrings, depth + 1, maxDepth))
                        return true;
                }
                catch { /* skip */ }
            }
        }
        catch { /* ignore */ }
        return false;
    }

    private static bool ContainsAnyKeywordCore(AutomationElement element, string[] keywords, int depth, int maxDepth)
    {
        if (maxDepth > 0 && depth > maxDepth)
            return false;
        try
        {
            var name = element.Properties.Name.ValueOrDefault ?? "";
            foreach (var kw in keywords)
            {
                if (!string.IsNullOrEmpty(kw) && name.Contains(kw, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            var children = element.FindAllChildren();
            if (children == null)
                return false;
            foreach (var child in children)
            {
                try
                {
                    if (ContainsAnyKeywordCore(child, keywords, depth + 1, maxDepth))
                        return true;
                }
                catch { /* skip */ }
            }
        }
        catch { /* ignore */ }
        return false;
    }

    /// <summary>Find first descendant matching the predicate (depth-first).</summary>
    public static AutomationElement? FindFirst(AutomationElement root, Func<AutomationElement, bool> predicate, int maxDepth = DefaultMaxDepth)
    {
        if (root == null || predicate == null)
            return null;
        return FindFirstCore(root, predicate, 0, maxDepth);
    }

    private static AutomationElement? FindFirstCore(AutomationElement element, Func<AutomationElement, bool> predicate, int depth, int maxDepth)
    {
        if (maxDepth > 0 && depth > maxDepth)
            return null;
        if (predicate(element))
            return element;
        try
        {
            var children = element.FindAllChildren();
            if (children == null)
                return null;
            foreach (var child in children)
            {
                try
                {
                    var found = FindFirstCore(child, predicate, depth + 1, maxDepth);
                    if (found != null)
                        return found;
                }
                catch
                {
                    // skip
                }
            }
        }
        catch
        {
            // ignore
        }
        return null;
    }

    /// <summary>Toggle the element if it supports the Toggle pattern (e.g. CheckBox). Returns true if toggled.</summary>
    public static bool Toggle(AutomationElement? element)
    {
        if (element == null)
            return false;
        try
        {
            if (!element.Patterns.Toggle.IsSupported)
                return false;
            element.Patterns.Toggle.Pattern.Toggle();
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Get Toggle state (On=checked, Off=unchecked). Returns null if not supported.</summary>
    public static bool? GetToggleState(AutomationElement? element)
    {
        if (element == null)
            return null;
        try
        {
            if (!element.Patterns.Toggle.IsSupported)
                return null;
            var state = element.Patterns.Toggle.Pattern.ToggleState;
            return state == FlaUI.Core.Definitions.ToggleState.On;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Select the element if it supports the SelectionItem pattern (e.g. TabItem). Returns true if selected. 1:1 Python operate_tab_item / SelectionItemPattern.</summary>
    public static bool SelectSelectionItem(AutomationElement? element)
    {
        if (element == null)
            return false;
        try
        {
            if (!element.Patterns.SelectionItem.IsSupported)
                return false;
            element.Patterns.SelectionItem.Pattern.Select();
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Invoke (click) the element if it supports the Invoke pattern. Returns true if invoked.</summary>
    /// <remarks>FlaUI: InvokePattern.Invoke() — see https://github.com/FlaUI/FlaUI</remarks>
    public static bool Invoke(AutomationElement? element)
    {
        if (element == null)
            return false;
        try
        {
            if (!element.Patterns.Invoke.IsSupported)
                return false;
            element.Patterns.Invoke.Pattern.Invoke();
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Get the value of the element if it supports the Value pattern.</summary>
    /// <remarks>FlaUI: ValuePattern.Value — for edit boxes, etc.</remarks>
    public static string? GetValue(AutomationElement? element)
    {
        if (element == null)
            return null;
        try
        {
            if (!element.Patterns.Value.IsSupported)
                return null;
            return element.Patterns.Value.Pattern.Value.Value;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Set the value of the element if it supports the Value pattern. Returns true if set.</summary>
    /// <remarks>FlaUI: ValuePattern.SetValue(string)</remarks>
    public static bool SetValue(AutomationElement? element, string? value)
    {
        if (element == null)
            return false;
        try
        {
            if (!element.Patterns.Value.IsSupported)
                return false;
            element.Patterns.Value.Pattern.SetValue(value ?? "");
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>High-level: find button/link by name and invoke. Returns true if found and invoked.</summary>
    public static bool InvokeByName(Process? process, string name, bool exactMatch = false)
    {
        var window = GetMainWindow(process);
        if (window == null)
            return false;
        var el = FindFirstByName(window, name, exactMatch);
        return Invoke(el);
    }

    /// <summary>High-level: find by AutomationId and invoke. Returns true if found and invoked.</summary>
    public static bool InvokeByAutomationId(Process? process, string automationId)
    {
        var window = GetMainWindow(process);
        if (window == null)
            return false;
        var el = FindFirstByAutomationId(window, automationId);
        return Invoke(el);
    }

    /// <summary>High-level: find edit by AutomationId and set value. Returns true if found and set.</summary>
    public static bool SetValueByAutomationId(Process? process, string automationId, string? value)
    {
        var window = GetMainWindow(process);
        if (window == null)
            return false;
        var el = FindFirstByAutomationId(window, automationId);
        return SetValue(el, value);
    }

    /// <summary>High-level: find edit by AutomationId and get value. Returns null if not found or no Value pattern.</summary>
    public static string? GetValueByAutomationId(Process? process, string automationId)
    {
        var window = GetMainWindow(process);
        if (window == null)
            return null;
        var el = FindFirstByAutomationId(window, automationId);
        return GetValue(el);
    }
}
