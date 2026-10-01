using System.Drawing;
using System.Text;
using System.Text.Json;
using DotCore.Foundations;
using FlaUI.Core.AutomationElements;

namespace DotCore.UIInspect;

/// <summary>
/// Analysis-driven UI operations: load window analysis JSON, find live controls by selector, run actions
/// (invoke/select/click) with pattern-first + mouse fallback, and run sequences with a per-step delay.
/// 1:1 Python pyapps/d3-check/d3utils/ui_analysis_operations.py (generic parts; the ROSBOT resume sequence stays in the app).
/// </summary>
public static class UiAnalysisSequence
{
    public const int DefaultFindMaxDepth = 12;
    public const int DefaultStepDelayMs = 300;
    public const string ActionInvoke = "invoke";
    public const string ActionSelect = "select";
    public const string ActionClick = "click";

    /// <summary>Load window analysis JSON (timestamp, program_name, window_info, controls, files); null if missing/invalid.</summary>
    public static UiAnalysisDocument? LoadAnalysisJson(string path)
    {
        try
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
                return null;
            return JsonSerializer.Deserialize<UiAnalysisDocument>(File.ReadAllText(path, Encoding.UTF8), WindowAnalyzer.SerializerOptions);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[UI_ANALYSIS] Load failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>Controls list of the analysis (empty if none).</summary>
    public static IReadOnlyList<UiAnalysisControl> GetControls(UiAnalysisDocument? analysis)
    {
        return analysis?.Controls ?? new List<UiAnalysisControl>();
    }

    /// <summary>Control descriptor by analysis snapshot id.</summary>
    public static UiAnalysisControl? GetControlBySnapshotId(UiAnalysisDocument? analysis, int snapshotId)
    {
        return GetControls(analysis).FirstOrDefault(c => c.Id == snapshotId);
    }

    /// <summary>Selector (type + name + automation_id) from an analysis snapshot id.</summary>
    public static UiSelector? SelectorFromAnalysisId(UiAnalysisDocument? analysis, int snapshotId)
    {
        var c = GetControlBySnapshotId(analysis, snapshotId);
        if (c == null)
            return null;
        return new UiSelector
        {
            Type = c.Type ?? "",
            Name = string.IsNullOrEmpty(c.Name) ? null : c.Name,
            AutomationId = string.IsNullOrEmpty(c.AutomationId) ? null : c.AutomationId,
        };
    }

    /// <summary>
    /// Match a live control against the selector. Non-empty AutomationId: match only by automation id (and type).
    /// Else type + name (exact), NameCandidates (any), NameContains (any substring). Type matches if either contains the other.
    /// </summary>
    public static bool ControlMatches(AutomationElement control, UiSelector selector)
    {
        string ctype, name, aid;
        try
        {
            ctype = UIOperations.GetControlTypeName(control).Trim();
            name = control.Properties.Name.ValueOrDefault ?? "";
            aid = control.Properties.AutomationId.ValueOrDefault ?? "";
        }
        catch
        {
            return false;
        }

        var selId = selector.AutomationId?.Trim();
        if (!string.IsNullOrEmpty(selId))
        {
            if (aid != selId)
                return false;
            return TypeMatches(selector.Type, ctype);
        }

        if (!TypeMatches(selector.Type, ctype))
            return false;
        if (selector.NameCandidates != null)
        {
            if (!selector.NameCandidates.Where(s => !string.IsNullOrEmpty(s)).Select(s => s.Trim()).Contains(name))
                return false;
        }
        else if (selector.Name != null && name != selector.Name)
        {
            return false;
        }
        if (selector.NameContains != null && !selector.NameContains.Any(s => name.Contains(s ?? "", StringComparison.Ordinal)))
            return false;
        return true;
    }

    /// <summary>Walk the window tree and return the foundIndex-th (clamped) control matching the selector. 1:1 Python find_control_in_window.</summary>
    public static AutomationElement? FindControlInWindow(AutomationElement? windowControl, UiSelector selector, int maxDepth = DefaultFindMaxDepth, int foundIndex = 0)
    {
        if (windowControl == null || selector == null)
            return null;
        var collected = new List<AutomationElement>();
        Walk(windowControl, 0, maxDepth, selector, collected);
        if (collected.Count == 0)
            return null;
        int idx = Math.Min(Math.Max(0, foundIndex), collected.Count - 1);
        return collected[idx];
    }

    /// <summary>Find control by spec.Target and run spec.Action (invoke | select | click | other = by type hint). 1:1 Python operate_by_spec.</summary>
    public static bool OperateBySpec(AutomationElement? windowControl, UiOperationSpec spec, Func<Rectangle, bool>? click = null)
    {
        var target = spec?.Target;
        if (spec == null || target == null)
        {
            ColorPrinter.Yellow("[UI_ANALYSIS] operate_by_spec: missing target/selector");
            return false;
        }
        var action = (string.IsNullOrWhiteSpace(spec.Action) ? ActionInvoke : spec.Action).Trim().ToLowerInvariant();

        var control = FindControlInWindow(windowControl, target, DefaultFindMaxDepth, spec.TargetIndex);
        if (control == null)
        {
            ColorPrinter.Yellow($"[UI_ANALYSIS] operate_by_spec: no control found for target {target}");
            return false;
        }

        return action switch
        {
            ActionInvoke => UIOperations.OperateButton(control, click),
            ActionSelect => UIOperations.OperateTabItem(control, click),
            ActionClick => UIOperations.ClickAtControlRect(control, click),
            _ => UIOperations.OperateControl(control, (target.Type ?? "").Trim(), click),
        };
    }

    /// <summary>Run specs in order with a delay between steps; returns per-step success. 1:1 Python run_sequence.</summary>
    public static IReadOnlyList<bool> RunSequence(AutomationElement? windowControl, IReadOnlyList<UiOperationSpec> sequence, Func<Rectangle, bool>? click = null, int delayAfterStepMs = DefaultStepDelayMs)
    {
        var results = new List<bool>();
        if (sequence == null)
            return results;
        for (int i = 0; i < sequence.Count; i++)
        {
            results.Add(OperateBySpec(windowControl, sequence[i], click));
            if (i < sequence.Count - 1 && delayAfterStepMs > 0)
                Thread.Sleep(delayAfterStepMs);
        }
        return results;
    }

    private static bool TypeMatches(string? selectorType, string ctype)
    {
        if (string.IsNullOrEmpty(selectorType))
            return true;
        return selectorType.Contains(ctype, StringComparison.Ordinal) || ctype.Contains(selectorType, StringComparison.Ordinal);
    }

    private static void Walk(AutomationElement control, int depth, int maxDepth, UiSelector selector, List<AutomationElement> collected)
    {
        if (depth > maxDepth)
            return;
        if (ControlMatches(control, selector))
            collected.Add(control);
        AutomationElement[] children;
        try
        {
            children = control.FindAllChildren() ?? Array.Empty<AutomationElement>();
        }
        catch
        {
            return;
        }
        foreach (var child in children)
            Walk(child, depth + 1, maxDepth, selector, collected);
    }
}

/// <summary>
/// Control selector. AutomationId (non-empty) matches only by automation id + type; otherwise Type + Name (exact),
/// NameCandidates (any, e.g. localized) and NameContains (any substring).
/// </summary>
public sealed class UiSelector
{
    public string? Type { get; set; }
    public string? Name { get; set; }
    public IReadOnlyList<string>? NameCandidates { get; set; }
    public IReadOnlyList<string>? NameContains { get; set; }
    public string? AutomationId { get; set; }

    public override string ToString()
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(Type)) parts.Add($"type={Type}");
        if (Name != null) parts.Add($"name={Name}");
        if (NameCandidates != null) parts.Add($"name_candidates=[{string.Join(", ", NameCandidates)}]");
        if (NameContains != null) parts.Add($"name_contains=[{string.Join(", ", NameContains)}]");
        if (!string.IsNullOrEmpty(AutomationId)) parts.Add($"automation_id={AutomationId}");
        return "{" + string.Join(", ", parts) + "}";
    }
}

/// <summary>One sequence step: action (invoke | select | click), target selector, and match index.</summary>
public sealed class UiOperationSpec
{
    public string Action { get; set; } = UiAnalysisSequence.ActionInvoke;
    public UiSelector? Target { get; set; }
    public int TargetIndex { get; set; }
}
