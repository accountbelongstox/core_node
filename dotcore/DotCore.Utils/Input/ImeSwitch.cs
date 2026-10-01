using System.Runtime.InteropServices;

namespace DotCore.Utils.Input;

/// <summary>
/// Save IME conversion status, switch the foreground window to English (alphanumeric), restore later.
/// 1:1 Python pycore/pyutils/input/ime_switch.py (Imm32). No-ops on non-Windows.
/// </summary>
public static class ImeSwitch
{
    private const string Imm32 = "imm32.dll";
    private const uint IME_CMODE_ALPHANUMERIC = 0x0000;
    private const uint IME_SMODE_NONE = 0;

    /// <summary>True if IME save/restore is available (Windows). 1:1 Python is_ime_switch_available.</summary>
    public static bool IsAvailable => OperatingSystem.IsWindows();

    /// <summary>Save (conversion, sentence) and switch to alphanumeric; null if unsupported. 1:1 Python save_and_switch_ime_to_english.</summary>
    public static (uint Conversion, uint Sentence)? SaveAndSwitchToEnglish()
    {
        if (!IsAvailable) return null;
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return null;
        IntPtr himc = ImmGetContext(hwnd);
        if (himc == IntPtr.Zero) return null;
        (uint, uint)? saved = null;
        if (ImmGetConversionStatus(himc, out uint conv, out uint sent))
        {
            saved = (conv, sent);
            ImmSetConversionStatus(himc, IME_CMODE_ALPHANUMERIC, IME_SMODE_NONE);
        }
        ImmReleaseContext(hwnd, himc);
        return saved;
    }

    /// <summary>Restore status from SaveAndSwitchToEnglish. 1:1 Python restore_ime.</summary>
    public static bool Restore((uint Conversion, uint Sentence)? saved)
    {
        if (saved == null || !IsAvailable) return false;
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return false;
        IntPtr himc = ImmGetContext(hwnd);
        if (himc == IntPtr.Zero) return false;
        bool ok = ImmSetConversionStatus(himc, saved.Value.Conversion, saved.Value.Sentence);
        ImmReleaseContext(hwnd, himc);
        return ok;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport(Imm32)]
    private static extern IntPtr ImmGetContext(IntPtr hWnd);

    [DllImport(Imm32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ImmReleaseContext(IntPtr hWnd, IntPtr hIMC);

    [DllImport(Imm32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ImmGetConversionStatus(IntPtr hIMC, out uint lpfdwConversion, out uint lpfdwSentence);

    [DllImport(Imm32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ImmSetConversionStatus(IntPtr hIMC, uint fdwConversion, uint fdwSentence);
}
