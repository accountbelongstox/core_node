// PY-REF: none (DOT-only)
using System.Runtime.InteropServices;
using System.Text;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core.Monitor;

/// <summary>Kinds of error popups handled by <see cref="ErrorPopupWatcher"/> (RBAssist CHECKFORERRORS).</summary>
public enum ErrorPopupKind
{
    KeyboardHook,
    LicenseInUse,
    ArithmeticOverflow,
    NotepadError,
    VaultItemMissing,
    BlizzardError
}

/// <summary>A handled popup: kind, detail text (e.g. the Notepad content) and seconds to wait before restarting.</summary>
public sealed record ErrorPopupHit(ErrorPopupKind Kind, string Detail, int RestartDelaySec);

/// <summary>
/// Scans top-level windows for ROSBOT / D3 error popups, dismisses them and reports the hit (RBAssist CHECKFORERRORS): "Keyboard hooking"
/// and "License" (Button1), the untitled arithmetic-overflow dialog (ROSBOT server down, restart after 10 minutes), Notepad with "error"
/// in the title (only that Notepad process is closed; Fixes RBAssist bug: it killed every notepad.exe), "The Vault" item-missing dialog,
/// and a running BlizzardError.exe (D3 crash reporter, killed). TeamViewer sponsored / timeout popups are closed without a restart.
/// </summary>
public static class ErrorPopupWatcher
{
    private const string LogTag = "[ErrorPopup]";
    private const string TitleKeyboardHook = "Keyboard hooking";
    private const string TitleLicense = "License";
    private const string TitleVault = "The Vault";
    private const string TextVault = "The required item is missing from your inventory or stash";
    private const string TextArithmetic = "Arithmetic operation resulted in an overflow";
    private const string ClassDialog = "#32770";
    private const string ClassNotepad = "Notepad";
    private const string ClassButton = "Button";
    private const string ClassEdit = "Edit";
    private const string NotepadErrorToken = "error";
    private const string BlizzardErrorExe = "BlizzardError.exe";
    private static readonly string[] TeamViewerTitles = { "Sponsored session", "Session timeout" };
    private const int ArithmeticRestartDelaySec = 600;
    private const int LicenseRestartDelaySec = 10;
    private const int MaxTextLength = 4096;
    private const uint BmClick = 0x00F5;
    private const uint WmClose = 0x0010;
    private const uint WmGetText = 0x000D;

    /// <summary>handleErrors: dismiss error popups and return the first hit (null when none); closeTeamViewer: close TeamViewer popups.</summary>
    public static ErrorPopupHit? Scan(bool handleErrors, bool closeTeamViewer)
    {
        if (!OperatingSystem.IsWindows() || (!handleErrors && !closeTeamViewer)) return null;
        ErrorPopupHit? hit = null;
        foreach (var w in TopLevelWindows())
        {
            if (closeTeamViewer) CloseTeamViewer(w);
            if (!handleErrors) continue;
            var found = Handle(w);
            hit ??= found;
        }
        if (handleErrors && ProcessUtil.FindProcessByExeName(BlizzardErrorExe) != null)
        {
            ProcessUtil.KillProcessByExe(BlizzardErrorExe, logPrefix: LogTag);
            hit ??= new ErrorPopupHit(ErrorPopupKind.BlizzardError, BlizzardErrorExe, 0);
        }
        return hit;
    }

    private static void CloseTeamViewer((IntPtr Hwnd, string Title, string Class) w)
    {
        if (!TeamViewerTitles.Any(t => w.Title.StartsWith(t, StringComparison.OrdinalIgnoreCase))) return;
        PostMessage(w.Hwnd, WmClose, IntPtr.Zero, IntPtr.Zero);
        ColorPrinter.Gray($"{LogTag} TeamViewer popup '{w.Title}' closed");
    }

    private static ErrorPopupHit? Handle((IntPtr Hwnd, string Title, string Class) w)
    {
        if (w.Title.StartsWith(TitleKeyboardHook, StringComparison.Ordinal))
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.KeyboardHook, w.Title, 0);
        if (w.Title.StartsWith(TitleLicense, StringComparison.Ordinal) && w.Class == ClassDialog)
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.LicenseInUse, w.Title, LicenseRestartDelaySec);
        if (w.Title.StartsWith(TitleVault, StringComparison.Ordinal) && ChildText(w.Hwnd).Contains(TextVault, StringComparison.Ordinal))
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.VaultItemMissing, TextVault, 0);
        if (w.Class == ClassDialog && w.Title.Length == 0 && ChildText(w.Hwnd).Contains(TextArithmetic, StringComparison.Ordinal))
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.ArithmeticOverflow, TextArithmetic, ArithmeticRestartDelaySec);
        if (w.Class == ClassNotepad && w.Title.Contains(NotepadErrorToken, StringComparison.OrdinalIgnoreCase))
        {
            string text = EditText(w.Hwnd);
            int? pid = ProcessUtil.GetPidFromHwnd(w.Hwnd);
            if (pid is { } p) ProcessUtil.KillProcessByPid(p, logPrefix: LogTag);
            ColorPrinter.Yellow($"{LogTag} Notepad error window '{w.Title}' closed");
            return new ErrorPopupHit(ErrorPopupKind.NotepadError, text, 0);
        }
        return null;
    }

    private static ErrorPopupHit ClickFirstButton(IntPtr hwnd, ErrorPopupKind kind, string detail, int delaySec)
    {
        IntPtr button = FindWindowEx(hwnd, IntPtr.Zero, ClassButton, null);
        if (button != IntPtr.Zero) SendMessage(button, BmClick, IntPtr.Zero, IntPtr.Zero);
        else PostMessage(hwnd, WmClose, IntPtr.Zero, IntPtr.Zero);
        ColorPrinter.Yellow($"{LogTag} {kind} popup dismissed: {detail}");
        return new ErrorPopupHit(kind, detail, delaySec);
    }

    private static List<(IntPtr Hwnd, string Title, string Class)> TopLevelWindows()
    {
        var list = new List<(IntPtr, string, string)>();
        EnumWindows((h, _) =>
        {
            if (IsWindowVisible(h)) list.Add((h, GetText(h), GetClass(h)));
            return true;
        }, IntPtr.Zero);
        return list;
    }

    private static string ChildText(IntPtr hwnd)
    {
        var sb = new StringBuilder();
        EnumChildWindows(hwnd, (h, _) =>
        {
            sb.Append(GetText(h)).Append('\n');
            return true;
        }, IntPtr.Zero);
        return sb.ToString();
    }

    private static string EditText(IntPtr hwnd)
    {
        IntPtr edit = FindWindowEx(hwnd, IntPtr.Zero, ClassEdit, null);
        if (edit == IntPtr.Zero) return "";
        var sb = new StringBuilder(MaxTextLength);
        SendMessageText(edit, WmGetText, (IntPtr)MaxTextLength, sb);
        return sb.ToString();
    }

    private static string GetText(IntPtr hwnd)
    {
        var sb = new StringBuilder(512);
        GetWindowText(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    private static string GetClass(IntPtr hwnd)
    {
        var sb = new StringBuilder(256);
        GetClassName(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    private delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumChildWindows(IntPtr hWndParent, EnumProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string? lpszClass, string? lpszWindow);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessageText(IntPtr hWnd, uint msg, IntPtr wParam, StringBuilder lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
