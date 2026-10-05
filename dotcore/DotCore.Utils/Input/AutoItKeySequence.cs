// PY-REF: none (DOT-only)
using System.Globalization;
using DotCore.Foundations;

namespace DotCore.Utils.Input;

/// <summary>
/// Sends an AutoIt Send()-style key sequence through <see cref="ClickHandler"/>: "^" Ctrl, "!" Alt, "+" Shift, "#" Win prefix the
/// next key; "{NAME}" or "{NAME n}" is a named key (F1..F24, ENTER, ESC, SPACE, TAB, BS, DEL, UP, PGDN, ...) or a literal such as "{!}";
/// other characters are typed as text.
/// </summary>
public static class AutoItKeySequence
{
    private const string LogTag = "[AutoItKeySequence]";
    private const int MaxRepeat = 100;

    private static readonly Dictionary<char, string> Modifiers = new()
    {
        ['^'] = "ctrl", ['!'] = "alt", ['+'] = "shift", ['#'] = "win"
    };

    private static readonly Dictionary<string, string> BraceAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["BS"] = "backspace", ["BACKSPACE"] = "backspace", ["DEL"] = "delete", ["DELETE"] = "delete", ["INS"] = "insert",
        ["INSERT"] = "insert", ["ESC"] = "esc", ["ESCAPE"] = "esc", ["ENTER"] = "enter", ["SPACE"] = "space", ["TAB"] = "tab",
        ["HOME"] = "home", ["END"] = "end", ["PGUP"] = "pageup", ["PGDN"] = "pagedown", ["UP"] = "up", ["DOWN"] = "down",
        ["LEFT"] = "left", ["RIGHT"] = "right", ["LWIN"] = "winleft", ["RWIN"] = "winright", ["APPSKEY"] = "apps",
        ["PRINTSCREEN"] = "printscreen", ["PAUSE"] = "pause", ["CAPSLOCK"] = "capslock", ["NUMLOCK"] = "numlock",
        ["SCROLLLOCK"] = "scrolllock", ["SHIFT"] = "shift", ["CTRL"] = "ctrl", ["ALT"] = "alt"
    };

    /// <summary>Send the sequence; false when it is empty or any key could not be resolved or sent.</summary>
    public static bool Send(string? sequence)
    {
        if (string.IsNullOrEmpty(sequence)) return false;
        var handler = ClickHandler.Instance;
        var mods = new List<string>();
        bool ok = true;
        for (int i = 0; i < sequence.Length; i++)
        {
            char c = sequence[i];
            if (Modifiers.TryGetValue(c, out var mod))
            {
                mods.Add(mod);
                continue;
            }
            string key;
            int repeat = 1;
            if (c == '{')
            {
                int close = sequence.IndexOf('}', i + 2);
                if (close < 0)
                {
                    ColorPrinter.Yellow($"{LogTag} Unclosed brace in '{sequence}'");
                    return false;
                }
                string inner = sequence.Substring(i + 1, close - i - 1);
                i = close;
                int space = inner.LastIndexOf(' ');
                if (space > 0 && int.TryParse(inner[(space + 1)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out int n))
                {
                    repeat = Math.Clamp(n, 1, MaxRepeat);
                    inner = inner[..space];
                }
                key = BraceAliases.TryGetValue(inner, out var alias) ? alias : inner.ToLowerInvariant();
            }
            else
            {
                key = c.ToString();
            }
            for (int r = 0; r < repeat; r++)
                ok &= SendOne(handler, mods, key);
            mods.Clear();
        }
        return ok;
    }

    private static bool SendOne(ClickHandler handler, List<string> mods, string key)
    {
        if (mods.Count == 0)
            return key.Length == 1 && !char.IsControl(key[0]) && key != " " ? handler.TypeText(key) : handler.PressKey(key);
        var keys = new List<string>(mods) { key.Length == 1 ? key.ToLowerInvariant() : key };
        return handler.Hotkey(keys.ToArray());
    }
}
