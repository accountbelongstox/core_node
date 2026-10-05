// PY-REF: none (DOT-only)
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

    /// <summary>handleErrors: dismiss error popups and return the first hit (null when none); closeTeamViewer: close TeamViewer popups.</summary>
    public static ErrorPopupHit? Scan(bool handleErrors, bool closeTeamViewer)
    {
        if (!OperatingSystem.IsWindows() || (!handleErrors && !closeTeamViewer)) return null;
        ErrorPopupHit? hit = null;
        foreach (var w in WindowFinder.EnumerateTopLevelWindows())
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

    private static void CloseTeamViewer(WindowFinder.WindowInfo w)
    {
        if (!TeamViewerTitles.Any(t => w.Title.StartsWith(t, StringComparison.OrdinalIgnoreCase))) return;
        WindowInputHelper.PostClose(w.Hwnd);
        ColorPrinter.Gray($"{LogTag} TeamViewer popup '{w.Title}' closed");
    }

    private static ErrorPopupHit? Handle(WindowFinder.WindowInfo w)
    {
        if (w.Title.StartsWith(TitleKeyboardHook, StringComparison.Ordinal))
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.KeyboardHook, w.Title, 0);
        if (w.Title.StartsWith(TitleLicense, StringComparison.Ordinal) && w.ClassName == ClassDialog)
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.LicenseInUse, w.Title, LicenseRestartDelaySec);
        if (w.Title.StartsWith(TitleVault, StringComparison.Ordinal) && WindowFinder.GetChildWindowsText(w.Hwnd).Contains(TextVault, StringComparison.Ordinal))
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.VaultItemMissing, TextVault, 0);
        if (w.ClassName == ClassDialog && w.Title.Length == 0 && WindowFinder.GetChildWindowsText(w.Hwnd).Contains(TextArithmetic, StringComparison.Ordinal))
            return ClickFirstButton(w.Hwnd, ErrorPopupKind.ArithmeticOverflow, TextArithmetic, ArithmeticRestartDelaySec);
        if (w.ClassName == ClassNotepad && w.Title.Contains(NotepadErrorToken, StringComparison.OrdinalIgnoreCase))
        {
            string text = WindowFinder.GetControlText(WindowFinder.FindChildWindow(w.Hwnd, ClassEdit));
            if (ProcessUtil.GetPidFromHwnd(w.Hwnd) is { } pid) ProcessUtil.KillProcessByPid(pid, logPrefix: LogTag);
            ColorPrinter.Yellow($"{LogTag} Notepad error window '{w.Title}' closed");
            return new ErrorPopupHit(ErrorPopupKind.NotepadError, text, 0);
        }
        return null;
    }

    private static ErrorPopupHit ClickFirstButton(IntPtr hwnd, ErrorPopupKind kind, string detail, int delaySec)
    {
        IntPtr button = WindowFinder.FindChildWindow(hwnd, ClassButton);
        if (button != IntPtr.Zero) WindowInputHelper.ClickButton(button);
        else WindowInputHelper.PostClose(hwnd);
        ColorPrinter.Yellow($"{LogTag} {kind} popup dismissed: {detail}");
        return new ErrorPopupHit(kind, detail, delaySec);
    }
}
