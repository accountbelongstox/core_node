// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace DotCore.UIInspect;

/// <summary>
/// Drive a Windows "Choose a Folder" common dialog (#32770) opened by another process: type the path into the folder box
/// (control id 1152) and press Select Folder (id 1). UI Automation exposes these Win32 children only as panes, so they are
/// driven with WM_SETTEXT / BM_CLICK. Windows only.
/// </summary>
public static class CommonFolderDialog
{
    private const string DialogClass = "#32770";
    private const string EditClass = "Edit";
    private const string ButtonClass = "Button";
    private const int FolderEditId = 1152;
    private const int OkButtonId = 1;
    private const int WmSetText = 0x000C;
    private const int BmClick = 0x00F5;
    private const int PollMs = 200;

    /// <summary>Wait for a folder dialog of one of the processes, choose the path; false on timeout or missing controls.</summary>
    public static bool Choose(IReadOnlyCollection<int> processIds, string path, TimeSpan timeout)
    {
        if (!OperatingSystem.IsWindows()) return false;
        var sw = Stopwatch.StartNew();
        while (sw.Elapsed < timeout)
        {
            var dialog = FindDialog(processIds);
            if (dialog != IntPtr.Zero)
            {
                var edit = FindChild(dialog, FolderEditId, EditClass);
                var ok = FindChild(dialog, OkButtonId, ButtonClass);
                if (edit == IntPtr.Zero || ok == IntPtr.Zero) return false;
                SendMessage(edit, WmSetText, IntPtr.Zero, path);
                Thread.Sleep(PollMs);
                SendMessage(ok, BmClick, IntPtr.Zero, IntPtr.Zero);
                return true;
            }
            Thread.Sleep(PollMs);
        }
        return false;
    }

    private static IntPtr FindDialog(IReadOnlyCollection<int> processIds)
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, _) =>
        {
            if (!IsWindowVisible(h) || ClassOf(h) != DialogClass) return true;
            GetWindowThreadProcessId(h, out uint pid);
            if (!processIds.Contains((int)pid) || FindChild(h, FolderEditId, EditClass) == IntPtr.Zero) return true;
            found = h;
            return false;
        }, IntPtr.Zero);
        return found;
    }

    private static IntPtr FindChild(IntPtr parent, int id, string cls)
    {
        IntPtr found = IntPtr.Zero;
        EnumChildWindows(parent, (h, _) =>
        {
            if (GetDlgCtrlID(h) != id || ClassOf(h) != cls) return true;
            found = h;
            return false;
        }, IntPtr.Zero);
        return found;
    }

    private static string ClassOf(IntPtr h)
    {
        var sb = new StringBuilder(64);
        GetClassName(h, sb, sb.Capacity);
        return sb.ToString();
    }

    private delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr hwnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr SendMessage(IntPtr hwnd, int msg, IntPtr wParam, string lParam);
    [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam);
}
