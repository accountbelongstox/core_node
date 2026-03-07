using System.Runtime.InteropServices;
using System.Text;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3check.Core;

/// <summary>
/// ROSBOT operation: get window, activate window, run after-start automation, resume, get UI state (need key).
/// 1:1 with Python d3utils.rosbot_operation.RosbotOperation. Config (ros_directory, main exe) via constructor delegates.
/// </summary>
public sealed class RosbotOperation : IRosbotOperation
{
    private readonly Func<string?>? _getRosDirectory;
    private readonly Func<string?>? _getMainExeName;

    /// <summary>Create with optional config providers. When null, GetWindow/ActivateWindow will not find a window.</summary>
    public RosbotOperation(Func<string?>? getRosDirectory = null, Func<string?>? getMainExeName = null)
    {
        _getRosDirectory = getRosDirectory;
        _getMainExeName = getMainExeName;
    }

    /// <inheritdoc />
    public RosbotWindowInfo? GetWindow()
    {
        string? ros = _getRosDirectory?.Invoke();
        string? exe = _getMainExeName?.Invoke();
        return RosbotDetection.GetRosbotWindow(ros, exe);
    }

    /// <inheritdoc />
    public bool ActivateWindow()
    {
        var win = GetWindow();
        if (win == null)
        {
            ColorPrinter.Yellow("[RosbotOperation] No ROSBOT window to activate");
            return false;
        }
        if (!NativeWindowHelper.ActivateWindow(win.Hwnd))
        {
            ColorPrinter.Yellow("[RosbotOperation] Activate failed");
            return false;
        }
        ColorPrinter.Blue("[RosbotOperation] ROSBOT window activated");
        return true;
    }

    /// <inheritdoc />
    /// <remarks>1:1 Python run_after_rosbot_start: wait for window, activate, SERVER_WAIT sleep, poll main tab, then tab select + Start invoke.</remarks>
    public bool RunAfterRosbotStart(int waitSec = 30, bool doDebug = true, bool doTab = true, bool doStartBotting = true)
    {
        if (doDebug)
            ColorPrinter.Gray($"[DEBUG][E5a] RunAfterRosbotStart: waitSec={waitSec} doTab={doTab} doStartBotting={doStartBotting}.");
        var win = this.PollForWindow(waitSec);
        if (win == null)
        {
            if (doDebug)
                ColorPrinter.Gray("[DEBUG][E5a] PollForWindow returned null.");
            ColorPrinter.Yellow("[RosbotOperation] RunAfterRosbotStart: ROSBOT window not found within " + waitSec + "s");
            return false;
        }
        if (doDebug)
            ColorPrinter.Gray("[DEBUG][E5a] ROSBOT window found, activating.");
        if (!NativeWindowHelper.ActivateWindow(win.Hwnd))
        {
            ColorPrinter.Yellow("[RosbotOperation] RunAfterRosbotStart: activate failed");
            return false;
        }
        if (doDebug)
            ColorPrinter.Gray("[DEBUG][E5a] SERVER_WAIT " + RosbotConstants.ServerWaitSeconds + "s.");
        Thread.Sleep(RosbotConstants.ServerWaitSeconds * 1000);
        if (!PollForMainProfileTab(win.Hwnd))
        {
            if (doDebug)
                ColorPrinter.Gray("[DEBUG][E5a] PollForMainProfileTab returned false.");
            ColorPrinter.Yellow("[RosbotOperation] RunAfterRosbotStart: main profile tab not visible within " + RosbotConstants.MainUiPollTimeoutSeconds + "s");
            return false;
        }
        if (doDebug)
            ColorPrinter.Gray("[DEBUG][E5a] RunResumeSequence (tab + Start botting).");
        return RunResumeSequence(win.Hwnd, doTab, doStartBotting);
    }

    /// <inheritdoc />
    /// <remarks>1:1 Python resume_rosbot: activate window, then tab select + Start invoke.</remarks>
    public bool ResumeRosbot(bool doTab = true, bool doStartBotting = true)
    {
        var win = GetWindow();
        if (win == null)
        {
            ColorPrinter.Yellow("[RosbotOperation] ResumeRosbot: no ROSBOT window");
            return false;
        }
        if (!NativeWindowHelper.ActivateWindow(win.Hwnd))
        {
            ColorPrinter.Yellow("[RosbotOperation] ResumeRosbot: activate failed");
            return false;
        }
        return RunResumeSequence(win.Hwnd, doTab, doStartBotting);
    }

    /// <summary>1:1 Python sequence: select main profile tab (TabMainProfileNames), then invoke Start button (btnStart).</summary>
    private static bool RunResumeSequence(IntPtr hwnd, bool doTab, bool doStartBotting)
    {
        return UIOperations.RunWithWindowRoot(hwnd, root =>
        {
            if (root == null)
            {
                ColorPrinter.Gray("[DEBUG][E5a] RunResumeSequence: root null.");
                return false;
            }
            const int depth = 12;
            if (doTab)
            {
                var tab = UIOperations.FindFirstTabItemByNameContainsAny(root, RosbotConstants.TabMainProfileNames, depth);
                if (tab != null)
                {
                    UIOperations.SelectSelectionItem(tab);
                    Thread.Sleep((int)(RosbotConstants.UiOperationDelaySec * 1000));
                    ColorPrinter.Gray("[DEBUG][E5a] RunResumeSequence: main profile tab selected.");
                }
                else
                    ColorPrinter.Gray("[DEBUG][E5a] RunResumeSequence: main profile tab not found.");
            }
            if (!doStartBotting) return true;
            var btn = UIOperations.FindFirstByAutomationId(root, RosbotConstants.StartButtonAutomationId, depth);
            bool invoked = UIOperations.Invoke(btn);
            ColorPrinter.Gray($"[DEBUG][E5a] RunResumeSequence: Start button Invoke={invoked}.");
            return invoked;
        });
    }

    private RosbotWindowInfo? PollForWindow(int waitSec)
    {
        for (int elapsed = 0; elapsed < waitSec; elapsed += 2)
        {
            var win = GetWindow();
            if (win != null)
            {
                ColorPrinter.Gray($"[DEBUG][E5a] PollForWindow: found at elapsed={elapsed}s.");
                return win;
            }
            Thread.Sleep(2000);
        }
        return null;
    }

    private static bool PollForMainProfileTab(IntPtr hwnd)
    {
        int timeoutSec = RosbotConstants.MainUiPollTimeoutSeconds;
        int intervalSec = RosbotConstants.MainUiPollIntervalSeconds;
        for (int elapsed = 0; elapsed < timeoutSec; elapsed += intervalSec)
        {
            bool found = UIOperations.RunWithWindowRoot(hwnd, root =>
            {
                if (root == null) return false;
                var tab = UIOperations.FindFirstTabItemByNameContainsAny(root, RosbotConstants.TabMainProfileNames, 12);
                return tab != null;
            });
            if (found)
            {
                ColorPrinter.Gray($"[DEBUG][E5a] PollForMainProfileTab: main profile tab visible at elapsed={elapsed}s.");
                return true;
            }
            Thread.Sleep(intervalSec * 1000);
        }
        return false;
    }

    /// <inheritdoc />
    public RosbotUiState GetUiState(IReadOnlyList<int>? pids = null)
    {
        var state = new RosbotUiState();
        IReadOnlyList<int>? pidsToScan = pids;
        if (pidsToScan == null || pidsToScan.Count == 0)
        {
            string? ros = _getRosDirectory?.Invoke();
            string? exe = _getMainExeName?.Invoke();
            var det = RosbotDetection.GetDetection(ros, exe);
            pidsToScan = det.Pids;
        }
        if (pidsToScan == null || pidsToScan.Count == 0)
            return state;

        string keyTitle = RosbotConstants.KeyDialogWindowTitleDefault;
        foreach (int pid in pidsToScan)
        {
            var titles = GetWindowTitlesByPid(pid);
            foreach (string title in titles)
            {
                if (string.Equals(title.Trim(), keyTitle, StringComparison.Ordinal))
                {
                    state = new RosbotUiState
                    {
                        NeedKeyInput = true,
                        Message = RosbotConstants.RosbotNeedKeyMessageFallback
                    };
                    return state;
                }
            }
        }
        return state;
    }

    /// <summary>Enumerate top-level window titles for a process. 1:1 Python find_windows_by_pid(pid) then w.get("title").</summary>
    private static List<string> GetWindowTitlesByPid(int pid)
    {
        var list = new List<string>();
        var seen = new HashSet<IntPtr>();
        EnumWindows((hWnd, _) =>
        {
            if (GetWindowThreadProcessId(hWnd, out uint procId) != 0 && (int)procId == pid)
            {
                if (seen.Add(hWnd))
                {
                    var sb = new StringBuilder(512);
                    if (GetWindowText(hWnd, sb, sb.Capacity) > 0)
                        list.Add(sb.ToString());
                }
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
}
