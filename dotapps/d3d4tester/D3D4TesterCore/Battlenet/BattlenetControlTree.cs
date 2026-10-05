// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
using System.Drawing;
using System.IO;
using System.Text.Encodings.Web;
using System.Text.Json;
using DotCore.Foundations;
using DotCore.UIInspect;
using DotCore.Utils;
using DotCore.Utils.Input;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>One enumerated Battle.net control. Light entries have no Type/Rect. 1:1 Python _safe_control_dict(_light).</summary>
public sealed record BattlenetControl(
    string Name,
    string AutomationId,
    string Type,
    Rectangle? Rect,
    bool? IsEnabled,
    bool? IsOffscreen,
    int Level,
    bool? IsSelected = null)
{
    /// <summary>enabled is not False, offscreen is not True, rect width/height &gt; 0.</summary>
    public bool IsClickable => IsEnabled != false && IsOffscreen != true && Rect is { Width: > 0, Height: > 0 };
}

/// <summary>
/// Battle.net UI tree access: full enumeration, light enumeration with a 2 s TTL cache per hwnd, raw element lookup,
/// click (Invoke first, rect-centre mouse click fallback with return-to-original), focus, set value, snapshots.
/// 1:1 Python battlenet_operation_base (_enumerate_controls, _enumerate_controls_light, _find_raw_control_*, click_control,
/// focus_control, set_control_value, find_control_by_*, get_clickable_buttons, save_ui_elements_snapshot).
/// </summary>
public static class BattlenetControlTree
{
    private static readonly object CacheLock = new();
    private static readonly Lazy<UIA3Automation> Automation = new(() => new UIA3Automation(), LazyThreadSafetyMode.ExecutionAndPublication);
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private static List<BattlenetControl>? _lightCache;
    private static long _lightCacheTimeMs;
    private static IntPtr _lightCacheHwnd;

    /// <summary>First Battle.net window handle or zero.</summary>
    public static IntPtr GetHwnd() => BattlenetManager.Instance.FindBattlenetWindow()?.Hwnd ?? IntPtr.Zero;

    /// <summary>Root element of the first Battle.net window, or null. 1:1 Python _get_root_control.</summary>
    public static AutomationElement? GetRoot()
    {
        var hwnd = GetHwnd();
        if (hwnd == IntPtr.Zero) return null;
        try
        {
            return Automation.Value.FromHandle(hwnd);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[BattlenetOperation] ControlFromHandle failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>Full walk (name, automation_id, type, rect, enabled, offscreen, level). 1:1 Python _enumerate_controls.</summary>
    public static List<BattlenetControl> Enumerate()
    {
        var root = GetRoot();
        var collected = new List<BattlenetControl>();
        if (root == null) return collected;
        Walk(root, 0, (el, depth) =>
        {
            var info = ToControl(el, depth, light: false);
            if (info != null) collected.Add(info);
            return false;
        });
        return collected;
    }

    /// <summary>Light walk (name, automation_id, type, enabled, offscreen) cached 2 s per hwnd. 1:1 Python _enumerate_controls_light.</summary>
    public static List<BattlenetControl> EnumerateLight(bool forceRefresh = false)
    {
        var hwnd = GetHwnd();
        if (hwnd == IntPtr.Zero) return new List<BattlenetControl>();
        long now = Environment.TickCount64;
        lock (CacheLock)
        {
            if (!forceRefresh && _lightCacheHwnd == hwnd && _lightCache != null
                && (now - _lightCacheTimeMs) < BattlenetConstants.ControlsLightCacheTtlSec * 1000)
                return _lightCache;
        }
        var collected = EnumerateLightForWindow(hwnd);
        lock (CacheLock)
        {
            _lightCache = collected;
            _lightCacheTimeMs = now;
            _lightCacheHwnd = hwnd;
        }
        return collected;
    }

    /// <summary>Uncached light walk of one window (e.g. each visible Battle.net window: main, login, login popup).</summary>
    public static List<BattlenetControl> EnumerateLightForWindow(IntPtr hwnd)
    {
        var collected = new List<BattlenetControl>();
        if (hwnd == IntPtr.Zero) return collected;
        AutomationElement root;
        try
        {
            root = Automation.Value.FromHandle(hwnd);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[BattlenetOperation] ControlFromHandle failed: {ex.Message}");
            return collected;
        }
        Walk(root, 0, (el, depth) =>
        {
            var info = ToControl(el, depth, light: true);
            if (info != null) collected.Add(info);
            return false;
        });
        return collected;
    }

    /// <summary>Drop the light cache (after clicks that change the UI).</summary>
    public static void InvalidateLightCache()
    {
        lock (CacheLock) _lightCache = null;
    }

    /// <summary>First element matching predicate in a depth-limited walk (stops on first match).</summary>
    public static AutomationElement? FindRaw(Func<AutomationElement, bool> predicate)
    {
        var root = GetRoot();
        if (root == null) return null;
        AutomationElement? found = null;
        Walk(root, 0, (el, _) =>
        {
            if (!predicate(el)) return false;
            found = el;
            return true;
        });
        return found;
    }

    /// <summary>1:1 Python _find_raw_control_by_automation_id (substring).</summary>
    public static AutomationElement? FindRawByAutomationId(string automationIdSubstr)
    {
        if (string.IsNullOrEmpty(automationIdSubstr)) return null;
        return FindRaw(el => AutomationIdOf(el).Contains(automationIdSubstr, StringComparison.Ordinal));
    }

    /// <summary>1:1 Python _find_raw_control_by_name_and_type.</summary>
    public static AutomationElement? FindRawByNameAndType(string[] nameSubstrings, string controlTypeName)
    {
        if (nameSubstrings.Length == 0) return null;
        return FindRaw(el =>
        {
            if (!UIOperations.GetControlTypeName(el).Contains(controlTypeName, StringComparison.OrdinalIgnoreCase)) return false;
            var name = NameOf(el);
            return nameSubstrings.Any(s => !string.IsNullOrEmpty(s) && name.Contains(s, StringComparison.Ordinal));
        });
    }

    /// <summary>Exact automation_id (+ name contains) or name contains when no automation_id. 1:1 Python _find_raw_control_matching.</summary>
    public static AutomationElement? FindRawMatching(BattlenetControl control)
    {
        string wantAid = control.AutomationId;
        string wantName = control.Name;
        if (string.IsNullOrEmpty(wantAid) && string.IsNullOrEmpty(wantName)) return null;
        return FindRaw(el =>
        {
            var aid = AutomationIdOf(el);
            var name = NameOf(el);
            if (!string.IsNullOrEmpty(wantAid) && aid == wantAid && (string.IsNullOrEmpty(wantName) || name.Contains(wantName, StringComparison.Ordinal)))
                return true;
            return string.IsNullOrEmpty(wantAid) && !string.IsNullOrEmpty(wantName) && name.Contains(wantName, StringComparison.Ordinal);
        });
    }

    /// <summary>UIA Invoke of the live control without activating the window or moving the mouse; false when it cannot be invoked.</summary>
    public static bool InvokeControl(BattlenetControl control)
    {
        var raw = FindRawMatching(control);
        bool ok = raw != null && UIOperations.OperateButton(raw, _ => false, preferInvoke: true);
        if (ok) InvalidateLightCache();
        return ok;
    }

    /// <summary>Activate, Invoke the live control, else mouse click at rect centre. 1:1 Python click_control.</summary>
    public static bool ClickControl(BattlenetControl control, bool requireClickable = false)
    {
        if (requireClickable && !control.IsClickable)
        {
            ColorPrinter.Gray("[BattlenetOperation] click_control: control not clickable, skip");
            return false;
        }
        BattlenetManager.Instance.ActivateWindow();
        Thread.Sleep(BattlenetConstants.ActivateSettleMs);
        InvalidateLightCache();
        var raw = FindRawMatching(control);
        if (raw != null && UIOperations.OperateButton(raw, ClickRectCenter, preferInvoke: true))
            return true;
        if (control.Rect is not { } rect)
            return false;
        if ((rect.X + rect.Width / 2 <= 0 && rect.Y + rect.Height / 2 <= 0) || rect.Width <= 0 || rect.Height <= 0)
        {
            ColorPrinter.Gray("[BattlenetOperation] click_control: rect invalid, skip");
            return false;
        }
        return ClickRectCenter(rect);
    }

    /// <summary>1:1 Python focus_control: UIA focus, else click.</summary>
    public static bool FocusControl(BattlenetControl control)
    {
        BattlenetManager.Instance.ActivateWindow();
        Thread.Sleep(BattlenetConstants.ActivateSettleMs);
        var raw = FindRawMatching(control);
        if (raw != null && UIOperations.SetFocus(raw))
            return true;
        return ClickControl(control);
    }

    /// <summary>1:1 Python set_control_value (ValuePattern).</summary>
    public static bool SetControlValue(BattlenetControl control, string value)
    {
        if (string.IsNullOrEmpty(value)) return true;
        var raw = FindRawMatching(control);
        return raw != null && UIOperations.SetValue(raw, value);
    }

    /// <summary>1:1 Python find_control_by_name (substring, first control order).</summary>
    public static BattlenetControl? FindByName(IReadOnlyList<BattlenetControl> controls, IEnumerable<string> nameSubstrings)
    {
        var subs = nameSubstrings.Where(s => !string.IsNullOrEmpty(s)).ToArray();
        foreach (var c in controls)
        {
            foreach (var sub in subs)
            {
                if (c.Name.Contains(sub, StringComparison.Ordinal))
                    return c;
            }
        }
        return null;
    }

    /// <summary>1:1 Python find_control_by_automation_id (substring or exact).</summary>
    public static BattlenetControl? FindByAutomationId(IReadOnlyList<BattlenetControl> controls, string automationIdSubstr, bool exactMatch = false)
    {
        if (string.IsNullOrEmpty(automationIdSubstr)) return null;
        foreach (var c in controls)
        {
            if (exactMatch ? c.AutomationId == automationIdSubstr : c.AutomationId.Contains(automationIdSubstr, StringComparison.Ordinal))
                return c;
        }
        return null;
    }

    /// <summary>First control whose automation_id contains any id (ids outer loop). 1:1 Python region_judge._find_by_automation_id.</summary>
    public static BattlenetControl? FindByAnyAutomationId(IReadOnlyList<BattlenetControl> controls, IEnumerable<string> ids)
    {
        foreach (var sub in ids)
        {
            if (string.IsNullOrEmpty(sub)) continue;
            foreach (var c in controls)
            {
                if (c.AutomationId.Contains(sub, StringComparison.Ordinal))
                    return c;
            }
        }
        return null;
    }

    /// <summary>1:1 Python _has_control_automation_id_containing_any.</summary>
    public static bool HasAutomationIdContainingAny(IReadOnlyList<BattlenetControl> controls, IEnumerable<string> substrings)
    {
        var subs = substrings.Where(s => !string.IsNullOrEmpty(s)).ToArray();
        return subs.Length > 0 && controls.Any(c => subs.Any(s => c.AutomationId.Contains(s, StringComparison.Ordinal)));
    }

    /// <summary>1:1 Python get_clickable_buttons.</summary>
    public static List<BattlenetControl> GetClickableButtons(IReadOnlyList<BattlenetControl> controls)
        => controls.Where(c => c.Type.Contains("button", StringComparison.OrdinalIgnoreCase) && c.IsClickable).ToList();

    /// <summary>Snapshot directory (.cache/bn_flow_snapshots under the app base directory).</summary>
    public static string SnapshotsDir => Path.Combine(AppContext.BaseDirectory, BattlenetConstants.CacheDirName, BattlenetConstants.BnFlowSnapshotsDirName);

    /// <summary>Write bn_flow_&lt;node&gt;.json when DebugSaveBnFlowUiSnapshots. 1:1 Python save_ui_elements_snapshot.</summary>
    public static string? SaveUiElementsSnapshot(string nodeName, string reason)
    {
        if (!BattlenetConstants.DebugSaveBnFlowUiSnapshots)
            return null;
        var controls = Enumerate();
        string dir = SnapshotsDir;
        try
        {
            Directory.CreateDirectory(dir);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[BattlenetOperation] save_ui_elements_snapshot mkdir: {ex.Message}");
            return null;
        }
        string safeNode = (string.IsNullOrEmpty(nodeName) ? "unknown" : nodeName).Replace(" ", "_");
        string path = Path.Combine(dir, BattlenetConstants.BnFlowSnapshotFilePrefix + safeNode + ".json");
        var payload = new
        {
            meta = new { node = nodeName, reason },
            controls = controls.Select(c => new
            {
                name = c.Name,
                automation_id = c.AutomationId,
                type = c.Type,
                rect = c.Rect is { } r ? new { left = r.Left, top = r.Top, right = r.Right, bottom = r.Bottom, width = r.Width, height = r.Height } : null,
                level = c.Level
            })
        };
        try
        {
            File.WriteAllText(path, JsonSerializer.Serialize(payload, SnapshotJsonOptions));
            ColorPrinter.Gray($"[BNFlow] UI snapshot saved: {Path.GetFileName(path)} | reason: {reason}");
            return path;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[BattlenetOperation] save_ui_elements_snapshot write: {ex.Message}");
            return null;
        }
    }

    internal static bool ClickRectCenter(Rectangle rect)
    {
        int cx = rect.Left + rect.Width / 2;
        int cy = rect.Top + rect.Height / 2;
        return ClickHandler.Instance.Click(cx, cy, MouseButton.Left, BattlenetConstants.ClickMoveDurationSec,
            returnToOriginal: true, directClick: true, pauseAfterMove: BattlenetConstants.ClickPauseAfterMoveSec);
    }

    /// <summary>Depth-limited walk (depth &gt; 25 stops). visit returns true to stop.</summary>
    private static bool Walk(AutomationElement el, int depth, Func<AutomationElement, int, bool> visit)
    {
        if (depth > BattlenetConstants.ControlTreeMaxDepth) return false;
        try
        {
            if (visit(el, depth)) return true;
            foreach (var child in el.FindAllChildren())
            {
                if (Walk(child, depth + 1, visit)) return true;
            }
        }
        catch
        {
            // Element vanished while walking; continue with siblings.
        }
        return false;
    }

    private static BattlenetControl? ToControl(AutomationElement el, int depth, bool light)
    {
        try
        {
            bool? enabled = TryGet(() => el.Properties.IsEnabled.ValueOrDefault);
            bool? offscreen = TryGet(() => el.Properties.IsOffscreen.ValueOrDefault);
            Rectangle? rect = light ? null : TryGet(() => el.Properties.BoundingRectangle.ValueOrDefault);
            string type = UIOperations.GetControlTypeName(el);
            bool? selected = type == BattlenetConstants.TabItemControlType
                ? TryGet(() => el.Patterns.SelectionItem.PatternOrDefault is { } sel && sel.IsSelected.ValueOrDefault)
                : null;
            return new BattlenetControl(NameOf(el), AutomationIdOf(el), type, rect, enabled, offscreen, depth, selected);
        }
        catch
        {
            return null;
        }
    }

    private static T? TryGet<T>(Func<T> getter) where T : struct
    {
        try
        {
            return getter();
        }
        catch
        {
            return null;
        }
    }

    internal static string NameOf(AutomationElement el)
    {
        try
        {
            return (el.Properties.Name.ValueOrDefault ?? "").Trim();
        }
        catch
        {
            return "";
        }
    }

    internal static string AutomationIdOf(AutomationElement el)
    {
        try
        {
            return (el.Properties.AutomationId.ValueOrDefault ?? "").Trim();
        }
        catch
        {
            return "";
        }
    }
}
