using DotCore.Foundations;

namespace DotCore.Utils.Input;

/// <summary>Clear mode before typing. 1:1 Python CLEAR_MODE_REPLACE / CLEAR_MODE_APPEND / CLEAR_MODE_NONE.</summary>
public enum FieldClearMode
{
    /// <summary>Ctrl+A then type.</summary>
    Replace,
    /// <summary>End then type.</summary>
    Append,
    /// <summary>Type only.</summary>
    None
}

/// <summary>Typing options. Defaults 1:1 Python type_into_field keyword defaults.</summary>
public sealed record FieldInputOptions
{
    public FieldClearMode ClearMode { get; init; } = FieldClearMode.Replace;
    public double IntervalMinSec { get; init; } = 0.1;
    public double IntervalMaxSec { get; init; } = 0.3;
    public double AfterFocusDelaySec { get; init; } = 0.2;
    public double AfterClearDelaySec { get; init; } = 0.05;
    public bool UseClipboardForUnicode { get; init; } = true;
    public bool EnsureImeEnglish { get; init; } = true;
}

/// <summary>
/// Generic field input: focus, clear, type (clipboard paste for non-ASCII), IME switch, set-value fallback.
/// 1:1 Python pycore/pyutils/input/field_input.py (type_into_field, fill_field_with_fallback, FieldInputSimulator).
/// </summary>
public static class FieldInput
{
    private const string LogTag = "[field_input]";
    private const double ClipboardSettleSec = 0.05;

    private static readonly Random Rng = new();

    /// <summary>
    /// Focus (focusCallable, else click focusXy), clear by mode, then type text. If typing fails and setValueFallback
    /// is given, returns setValueFallback(text). 1:1 Python type_into_field.
    /// </summary>
    public static bool TypeIntoField(
        string text,
        FieldInputOptions? options = null,
        (int X, int Y)? focusXy = null,
        Func<bool>? focusCallable = null,
        Func<string, bool>? setValueFallback = null)
    {
        var o = options ?? new FieldInputOptions();
        var input = ClickHandler.Instance;

        if (focusCallable != null)
        {
            if (!focusCallable()) return false;
            SleepSec(o.AfterFocusDelaySec);
        }
        else if (focusXy != null)
        {
            input.Click(focusXy.Value.X, focusXy.Value.Y, returnToOriginal: false, directClick: true, pauseAfterMove: 0);
            SleepSec(o.AfterFocusDelaySec);
        }

        if (o.ClearMode == FieldClearMode.Replace)
        {
            input.Hotkey("ctrl", "a");
            SleepSec(o.AfterClearDelaySec);
        }
        else if (o.ClearMode == FieldClearMode.Append)
        {
            input.PressKey("end");
            SleepSec(o.AfterClearDelaySec);
        }

        if (string.IsNullOrEmpty(text)) return true;

        bool DoType()
        {
            if (o.UseClipboardForUnicode && !IsAsciiOnly(text))
                return PasteViaClipboard(text);
            foreach (char c in text)
            {
                if (c < 128)
                    input.TypeText(c.ToString());
                else if (!PasteViaClipboard(c.ToString()))
                    return false;
                double delay = o.IntervalMinSec + Rng.NextDouble() * (o.IntervalMaxSec - o.IntervalMinSec);
                if (delay > 0) SleepSec(delay);
            }
            return true;
        }

        bool ok = ImeWrapTyping(o.EnsureImeEnglish, DoType);
        if (!ok && setValueFallback != null)
            return setValueFallback(text);
        return ok;
    }

    /// <summary>
    /// preferSetValue: setValueCallable first, keyboard on failure; otherwise keyboard first with setValueCallable as fallback.
    /// 1:1 Python fill_field_with_fallback.
    /// </summary>
    public static bool FillFieldWithFallback(
        string text,
        Func<string, bool> setValueCallable,
        Func<bool>? focusCallable = null,
        (int X, int Y)? focusXy = null,
        bool preferSetValue = true,
        FieldInputOptions? options = null)
    {
        if (string.IsNullOrEmpty(text)) return true;
        if (preferSetValue)
        {
            if (setValueCallable(text)) return true;
            return TypeIntoField(text, options, focusXy, focusCallable);
        }
        return TypeIntoField(text, options, focusXy, focusCallable, setValueCallable);
    }

    private static bool IsAsciiOnly(string text) => text.All(c => c < 128);

    /// <summary>Set clipboard, Ctrl+V, restore previous clipboard. 1:1 Python _paste_via_clipboard.</summary>
    private static bool PasteViaClipboard(string text)
    {
        string? backup = ClipboardText.GetText();
        if (!ClipboardText.SetText(text)) return false;
        SleepSec(ClipboardSettleSec);
        try
        {
            if (!ClickHandler.Instance.Hotkey("ctrl", "v"))
            {
                ColorPrinter.Yellow($"{LogTag} Ctrl+V paste failed chars={text.Length}");
                return false;
            }
        }
        finally
        {
            SleepSec(ClipboardSettleSec);
            if (backup != null) ClipboardText.SetText(backup);
        }
        return true;
    }

    private static bool ImeWrapTyping(bool ensureImeEnglish, Func<bool> doType)
    {
        if (!ensureImeEnglish) return doType();
        var saved = ImeSwitch.SaveAndSwitchToEnglish();
        try
        {
            return doType();
        }
        finally
        {
            if (saved != null) ImeSwitch.Restore(saved);
        }
    }

    private static void SleepSec(double seconds)
    {
        if (seconds > 0) Thread.Sleep(TimeSpan.FromSeconds(seconds));
    }
}

/// <summary>Reusable typing options with InputText. 1:1 Python FieldInputSimulator.</summary>
public sealed class FieldInputSimulator
{
    public FieldInputSimulator(FieldInputOptions? options = null)
    {
        Options = options ?? new FieldInputOptions();
    }

    public FieldInputOptions Options { get; }

    /// <summary>Type text with this simulator's options. 1:1 Python input_text.</summary>
    public bool InputText(string text, (int X, int Y)? focusXy = null, Func<bool>? focusCallable = null, Func<string, bool>? setValueFallback = null)
        => FieldInput.TypeIntoField(text, Options, focusXy, focusCallable, setValueFallback);
}
