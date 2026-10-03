// PY-REF: pyapps/d3-check/d3utils/rosbot_ui_automation.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_ui_structure.py
using System.Drawing;
using System.IO;
using System.Text;
using DotApps.d3d4tester.Core.D4;
using DotCore.Foundations;
using DotCore.UIInspect;
using DotCore.Utils;
using DotCore.Utils.Input;
using FlaUI.Core.AutomationElements;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT UI automation over UIA: main-window content validator, after-start sequence (close "D3 must be launched" dialog and
/// "No items" popup, wait window, server wait, poll main tab, then main profile tab + Start botting via run_sequence; tab-poll
/// timeout still attempts the sequence), resume, rift-mode switch, debug dump. Patterns first, mouse fallback at the control
/// rect (instant move, return to original). 1:1 Python d3utils/rosbot_ui_automation.py + rosbot_ui_structure.py.
/// </summary>
public static class RosbotUiAutomation
{
    private const string LogTag = "[ROSBOT_UI]";
    private const string DebugLogTag = "[ROSBOT_UI_DEBUG]";
    private const string ButtonTypeToken = "Button";
    private const string TextTypeToken = "Text";
    private const string TabItemControlType = "TabItemControl";
    private const string ButtonControlType = "ButtonControl";
    private const string ComboBoxControlType = "ComboBoxControl";
    private const string ListItemControlType = "ListItemControl";
    private const string DebugTimestampFormat = D3PathConstants.FileTimestampFormat;

    /// <summary>Mouse fallback: instant move + click at the rect center, then restore the cursor. 1:1 Python _ROSBOT_CLICK_PARAMS.</summary>
    public static readonly Func<Rectangle, bool> RosbotClick = rect =>
        ClickHandler.Instance.Click(rect.X + rect.Width / 2, rect.Y + rect.Height / 2, MouseButton.Left,
            duration: 0.0, returnToOriginal: true, directClick: true, pauseAfterMove: 0.0);

    private static readonly UiSelector CmbSequence = new() { Type = ComboBoxControlType, AutomationId = RosbotConstants.CmbSequenceAutomationId };
    private static readonly UiSelector ListItemRiftMode = new() { Type = ListItemControlType, NameContains = RosbotConstants.RiftModeListItemNames };
    private static readonly UiSelector BtnStart = new() { Type = ButtonControlType, AutomationId = RosbotConstants.StartButtonAutomationId };
    private static readonly UiSelector TabItemMain = new() { Type = TabItemControlType, NameCandidates = RosbotConstants.TabMainProfileNames };

    /// <summary>Built-in resume sequence: select main profile tab, invoke Start. 1:1 Python get_resume_sequence.</summary>
    public static IReadOnlyList<UiOperationSpec> GetResumeSequence() => new[]
    {
        new UiOperationSpec { Action = UiAnalysisSequence.ActionSelect, Target = TabItemMain },
        new UiOperationSpec { Action = UiAnalysisSequence.ActionInvoke, Target = BtnStart },
    };

    private static string TypeName(AutomationElement e) => UIOperations.GetControlTypeName(e).Trim();

    private static string NameOf(AutomationElement e)
    {
        try { return e.Properties.Name.ValueOrDefault ?? ""; }
        catch { return ""; }
    }

    private static string AutomationIdOf(AutomationElement e)
    {
        try { return (e.Properties.AutomationId.ValueOrDefault ?? "").Trim(); }
        catch { return ""; }
    }

    private static AutomationElement? FindInTree(AutomationElement? root, Func<AutomationElement, bool> predicate, int maxDepth) =>
        root == null ? null : UIOperations.FindFirst(root, predicate, maxDepth);

    /// <summary>True if the window has ROSBOT main content (profileTab or btnStart AutomationId). 1:1 Python window_has_rosbot_main_content.</summary>
    public static bool WindowHasRosbotMainContent(IntPtr hwnd)
    {
        if (!NativeWindowHelper.IsWindowValid(hwnd)) return false;
        return UIOperations.RunWithWindowRoot(hwnd, root =>
            FindInTree(root, e => RosbotConstants.MainContentAutomationIds.Contains(AutomationIdOf(e)), RosbotConstants.MainContentMaxDepth) != null);
    }

    /// <summary>Print every element (type, name, automation_id, rect) and write the dump to TMP/debug. 1:1 Python debug_print_operable_elements.</summary>
    public static void DebugPrintOperableElements(AutomationElement windowControl, int maxDepth = RosbotConstants.DebugDumpMaxDepth)
    {
        var lines = new List<string> { "=== ROSBOT UI structure ===", "" };
        int index = 0;
        void Walk(AutomationElement control, int depth)
        {
            if (depth > maxDepth) return;
            string name = NameOf(control);
            if (name.Length > RosbotConstants.DebugDumpNameMaxLength) name = name[..RosbotConstants.DebugDumpNameMaxLength];
            Rectangle r;
            try { r = control.BoundingRectangle; }
            catch { r = Rectangle.Empty; }
            index++;
            lines.Add($"  [{index}] {new string(' ', depth * 2)}{TypeName(control)} | name='{name}' | automation_id='{AutomationIdOf(control)}' | L{r.Left} T{r.Top} R{r.Right} B{r.Bottom}");
            AutomationElement[] children;
            try { children = control.FindAllChildren() ?? Array.Empty<AutomationElement>(); }
            catch { return; }
            foreach (var child in children) Walk(child, depth + 1);
        }
        Walk(windowControl, 0);
        lines.Add("");
        lines.Add($"=== Total {index} nodes ===");

        ColorPrinter.Blue($"{DebugLogTag} === Operable elements ===");
        foreach (string line in lines)
        {
            if (line.Trim().Length > 0) ColorPrinter.Gray(line);
        }
        ColorPrinter.Blue($"{DebugLogTag} === Total {index} nodes ===");
        try
        {
            string dir = Path.Combine(D4Constants.TmpDir, RosbotConstants.UiDebugDirName);
            Directory.CreateDirectory(dir);
            string outPath = Path.Combine(dir, $"{RosbotConstants.UiDebugFilePrefix}{DateTime.Now.ToString(DebugTimestampFormat)}.txt");
            File.WriteAllText(outPath, string.Join("\n", lines), Encoding.UTF8);
            ColorPrinter.Gray($"{DebugLogTag} UI structure written: {outPath}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray($"{DebugLogTag} write failed: {ex.Message}");
        }
    }

    /// <summary>Debug dump of the current ROSBOT window (any window incl. minimized). Returns false when none.</summary>
    public static bool DebugDumpRosbotWindow()
    {
        var w = RosbotManager.Instance.GetAnyRosbotWindowForDebug();
        if (w == null) return false;
        return UIOperations.RunWithWindowRoot(w.Hwnd, root =>
        {
            if (root == null) return false;
            DebugPrintOperableElements(root);
            return true;
        });
    }

    private static bool NameMatchesOkKeywords(string name)
    {
        string n = (name ?? "").Trim();
        if (n.Length == 0) return false;
        foreach (string kw in RosbotConstants.OkNameKeywords)
        {
            if (kw.Length > 0 && n.Contains(kw, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static AutomationElement? FindOkButton(AutomationElement root) =>
        FindInTree(root, e => TypeName(e).Contains(ButtonTypeToken, StringComparison.Ordinal) && NameMatchesOkKeywords(NameOf(e)), RosbotConstants.OkButtonSearchMaxDepth);

    private static AutomationElement? FindButtonByAutomationId(AutomationElement root, string automationId) =>
        FindInTree(root, e => TypeName(e).Contains(ButtonTypeToken, StringComparison.Ordinal) && AutomationIdOf(e) == automationId, RosbotConstants.AutomationIdSearchMaxDepth);

    private static bool HasAutomationId(AutomationElement root, string automationId) =>
        FindInTree(root, e => AutomationIdOf(e) == automationId, RosbotConstants.AutomationIdSearchMaxDepth) != null;

    /// <summary>
    /// Close ROSBOT's "D3 must be launched" message box by UI traits: ROSBOT-pid window at most 600x280, no TextBox (never the KEY
    /// dialog), OK by AutomationId else by OK name keywords. 1:1 Python try_close_d3_must_be_launched_dialog.
    /// </summary>
    public static bool TryCloseD3MustBeLaunchedDialog()
    {
        var mgr = RosbotManager.Instance;
        foreach (int pid in mgr.CollectRosbotPids())
        {
            foreach (var w in mgr.FindWindowsByPid(pid, visibleOnly: false))
            {
                var size = NativeWindowHelper.GetWindowSize(w.Hwnd);
                if (size == null) continue;
                if (size.Value.Width > RosbotConstants.MustLaunchDialogMaxWidth || size.Value.Height > RosbotConstants.MustLaunchDialogMaxHeight)
                    continue;
                bool closed = UIOperations.RunWithWindowRoot(w.Hwnd, root =>
                {
                    if (root == null) return false;
                    if (HasAutomationId(root, RosbotConstants.TextBoxAutomationId)) return false;
                    var ok = FindButtonByAutomationId(root, RosbotConstants.OkButtonAutomationId) ?? FindOkButton(root);
                    return ok != null && UIOperations.OperateButton(ok, RosbotClick);
                });
                if (closed)
                {
                    ColorPrinter.Green($"{LogTag} D3 must be launched dialog closed (OK by AutomationId)");
                    return true;
                }
            }
        }
        return false;
    }

    private static bool WindowHasNoItemsMessage(AutomationElement root) =>
        FindInTree(root, e =>
        {
            if (!TypeName(e).Contains(TextTypeToken, StringComparison.Ordinal)) return false;
            string name = NameOf(e);
            return RosbotConstants.NoItemsNameKeywords.Any(kw => kw.Length > 0 && name.Contains(kw, StringComparison.Ordinal));
        }, RosbotConstants.NoItemsSearchMaxDepth) != null;

    /// <summary>Find the visible top-level window whose TextControl contains "No items" (content, not title) and click OK. 1:1 Python try_close_no_items_popup.</summary>
    public static bool TryCloseNoItemsPopup()
    {
        IntPtr found = IntPtr.Zero;
        foreach (var hwnd in NativeWindowHelper.EnumVisibleWindows())
        {
            if (UIOperations.RunWithWindowRoot(hwnd, root => root != null && WindowHasNoItemsMessage(root)))
            {
                found = hwnd;
                break;
            }
        }
        if (found == IntPtr.Zero || !NativeWindowHelper.IsWindowValid(found)) return false;
        bool okMissing = false;
        bool closed = UIOperations.RunWithWindowRoot(found, root =>
        {
            if (root == null) return false;
            var ok = FindOkButton(root);
            if (ok == null)
            {
                okMissing = true;
                return false;
            }
            return UIOperations.OperateButton(ok, RosbotClick);
        });
        if (okMissing)
            ColorPrinter.Yellow($"{LogTag} No items popup: OK button not found");
        if (closed)
            ColorPrinter.Green($"{LogTag} No items popup closed (OK clicked)");
        return closed;
    }

    private static bool TryExpandCombo(AutomationElement control)
    {
        try
        {
            var pattern = control.Patterns.ExpandCollapse;
            if (pattern.IsSupported)
            {
                pattern.Pattern.Expand();
                return true;
            }
        }
        catch { /* fall back to click */ }
        return UIOperations.ClickAtControlRect(control, RosbotClick);
    }

    /// <summary>cmbSequence expand -> rift ListItem select -> btnStart. True if at least Start (or the rift item) was operated. 1:1 Python switch_to_rift_mode_and_start.</summary>
    public static bool SwitchToRiftModeAndStart(AutomationElement? windowControl)
    {
        if (windowControl == null) return false;
        bool ok = false;
        var cmb = UiAnalysisSequence.FindControlInWindow(windowControl, CmbSequence, RosbotConstants.SequenceFindMaxDepth);
        if (cmb != null)
        {
            if (TryExpandCombo(cmb)) Thread.Sleep(RosbotConstants.ComboExpandWaitMs);
            var item = UiAnalysisSequence.FindControlInWindow(windowControl, ListItemRiftMode, RosbotConstants.RiftItemFindMaxDepth);
            if (item != null)
            {
                if (UIOperations.OperateTabItem(item, RosbotClick)) ok = true;
                Thread.Sleep(RosbotConstants.RiftItemSelectWaitMs);
            }
        }
        var start = UiAnalysisSequence.FindControlInWindow(windowControl, BtnStart, RosbotConstants.SequenceFindMaxDepth);
        if (start != null && UIOperations.OperateButton(start, RosbotClick)) ok = true;
        return ok;
    }

    /// <summary>After the No-items OK: switch the ROSBOT window to rift mode and press Start. 1:1 Python do_after_no_items_close_switch_rift_and_start.</summary>
    public static bool DoAfterNoItemsCloseSwitchRiftAndStart()
    {
        ColorPrinter.Blue($"{LogTag} Other mode keys exhausted, switching to rift mode");
        var w = RosbotManager.Instance.GetRosbotWindow();
        if (w == null)
        {
            ColorPrinter.Yellow($"{LogTag} do_after_no_items: no ROSBOT window");
            return false;
        }
        return UIOperations.RunWithWindowRoot(w.Hwnd, SwitchToRiftModeAndStart);
    }

    private static bool RunResumeSequence(AutomationElement windowControl) =>
        UiAnalysisSequence.RunSequence(windowControl, GetResumeSequence(), RosbotClick, (int)(RosbotConstants.UiOperationDelaySec * 1000)).Any(r => r);

    /// <summary>
    /// After ROSBOT process start: close must-launch dialog / No-items popup (then rift + Start), poll window every 1 s, restore +
    /// 1 s, server wait, poll main tab (timeout still attempts tab/start), re-get window, debug dump + resume sequence.
    /// True if at least one step succeeded. 1:1 Python run_after_rosbot_start.
    /// </summary>
    public static bool RunAfterRosbotStart(int waitSec = 30, bool doDebug = true, bool doTab = true, bool doStartBotting = true)
    {
        TryCloseD3MustBeLaunchedDialog();
        if (TryCloseNoItemsPopup())
        {
            ColorPrinter.Blue($"{LogTag} No items popup closed at start; switching to rift mode and start.");
            if (DoAfterNoItemsCloseSwitchRiftAndStart()) return true;
        }

        var mgr = RosbotManager.Instance;
        RosbotWindowInfo? winfo = null;
        for (int i = 0; i < Math.Max(1, waitSec); i++)
        {
            winfo = mgr.GetRosbotWindow();
            if (winfo != null) break;
            Thread.Sleep(RosbotConstants.WindowPollIntervalMs);
        }
        if (winfo == null)
        {
            ColorPrinter.Yellow($"{LogTag} ROSBOT window not found within wait time");
            return false;
        }

        IntPtr hwnd = winfo.Hwnd;
        string exePath = ProcessUtil.GetProcessExePath(winfo.Pid) ?? "";
        ColorPrinter.Blue($"{LogTag} Found window: title='{winfo.Title.Trim()}', pid={winfo.Pid}, exe_name='{Path.GetFileName(exePath)}', exe_path='{exePath}'");
        ColorPrinter.Gray($"{LogTag} title from get_rosbot_window() -> find_window_by_pid() -> GetWindowText(hwnd)");
        if (NativeWindowHelper.ActivateWindow(hwnd))
            Thread.Sleep(RosbotConstants.RestoreAfterActivateMs);

        ColorPrinter.Blue($"{LogTag} Waiting {RosbotConstants.ServerWaitSeconds}s for server connection (original SERVER_WAIT)...");
        Thread.Sleep(RosbotConstants.ServerWaitSeconds * 1000);

        int pollCount = RosbotConstants.MainUiPollTimeoutSeconds / RosbotConstants.MainUiPollIntervalSeconds;
        bool mainTabSeen = false;
        for (int i = 0; i < pollCount; i++)
        {
            bool seen = UIOperations.RunWithWindowRoot(hwnd, root =>
                root != null && UIOperations.FindFirstTabItemByNameContainsAny(root, RosbotConstants.TabMainProfileNames, RosbotConstants.ControlSearchMaxDepth) != null);
            if (seen)
            {
                ColorPrinter.Green($"{LogTag} Main UI ready (main profile tab visible)");
                mainTabSeen = true;
                break;
            }
            Thread.Sleep(RosbotConstants.MainUiPollIntervalSeconds * 1000);
        }
        if (!mainTabSeen)
            ColorPrinter.Yellow($"{LogTag} Main profile tab not seen within timeout, attempting tab/start anyway (E5a->E6->F3 on skip)");

        var fresh = mgr.GetRosbotWindow();
        if (fresh != null)
        {
            hwnd = fresh.Hwnd;
            ColorPrinter.Gray($"{LogTag} Re-got window (get_rosbot_window -> find_window_by_pid -> GetWindowText) before ControlFromHandle");
        }

        bool controlMissing = false;
        bool didClick = UIOperations.RunWithWindowRoot(hwnd, root =>
        {
            if (root == null)
            {
                controlMissing = true;
                return false;
            }
            bool ok = false;
            if (doDebug)
            {
                DebugPrintOperableElements(root);
                ok = true;
            }
            if (doTab || doStartBotting)
                ok = RunResumeSequence(root) || ok;
            return ok;
        });
        if (controlMissing)
            ColorPrinter.Red($"{LogTag} Window control not available");
        if (!mainTabSeen && !didClick)
            ColorPrinter.Gray($"{LogTag} E5a: timeout path, UI controls not available; completing E5a without click -> E6 -> F3 only");
        return didClick;
    }

    /// <summary>Resume a paused ROSBOT: activate, wait, run the resume sequence. 1:1 Python resume_rosbot_ui.</summary>
    public static bool ResumeRosbotUi(bool doTab = true, bool doStartBotting = true)
    {
        var w = RosbotManager.Instance.GetRosbotWindow();
        if (w == null)
        {
            ColorPrinter.Yellow($"{LogTag} resume_rosbot_ui: no visible ROSBOT window");
            return false;
        }
        if (NativeWindowHelper.ActivateWindow(w.Hwnd))
            Thread.Sleep((int)(RosbotConstants.UiOperationDelaySec * 1000));
        bool controlMissing = false;
        bool ok = UIOperations.RunWithWindowRoot(w.Hwnd, root =>
        {
            if (root == null)
            {
                controlMissing = true;
                return false;
            }
            return (doTab || doStartBotting) && RunResumeSequence(root);
        });
        if (controlMissing)
            ColorPrinter.Red($"{LogTag} Window control not available");
        return ok;
    }
}
