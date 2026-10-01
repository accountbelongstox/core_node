using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.UITheme;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Read-only text box that captures one key or key combination as a canonical hotkey ("ctrl+shift+f2").
/// Escape or Delete clears the hotkey. Placeholder text is i18n. 1:1 Python ui/widgets/hotkey_input.py HotkeyInput.
/// </summary>
public class HotkeyInputBox : TextBox
{
    private const string ModifierCtrl = "ctrl";
    private const string ModifierShift = "shift";
    private const string ModifierAlt = "alt";
    private const string ModifierWin = "win";
    private const string Separator = "+";
    private const string FocusBorderBrushKey = "AccentBrush";

    public static readonly DependencyProperty HotkeyProperty = DependencyProperty.Register(
        nameof(Hotkey), typeof(string), typeof(HotkeyInputBox),
        new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, OnHotkeyPropertyChanged));

    /// <summary>Raised only when the user captures or clears a hotkey (not on programmatic set). Argument is the canonical hotkey or "".</summary>
    public event EventHandler<string>? HotkeyCaptured;

    public HotkeyInputBox()
    {
        IsReadOnly = true;
        IsReadOnlyCaretVisible = false;
        IsUndoEnabled = false;
        Cursor = Cursors.Hand;
        InputMethod.SetIsInputMethodEnabled(this, false);
        SetResourceReference(StyleProperty, typeof(TextBox));
        GotKeyboardFocus += (_, _) => SetResourceReference(BorderBrushProperty, FocusBorderBrushKey);
        LostKeyboardFocus += (_, _) => ClearValue(BorderBrushProperty);
        Loaded += (_, _) => RefreshI18n();
    }

    public string Hotkey
    {
        get => (string)GetValue(HotkeyProperty);
        set => SetValue(HotkeyProperty, value ?? "");
    }

    /// <summary>Re-read the placeholder text (call when the UI language changes).</summary>
    public void RefreshI18n() => ControlAssist.SetPlaceholder(this, D3D4TesterI18n.Provider.GetUiText(I18nKeys.HotkeyInputPlaceholder));

    protected override void OnPreviewKeyDown(KeyEventArgs e)
    {
        e.Handled = true;
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key == Key.Escape || key == Key.Delete)
        {
            Commit("");
            return;
        }
        if (IsModifierKey(key) || key == Key.ImeProcessed || key == Key.DeadCharProcessed) return;
        Commit(BuildCanonical(key, Keyboard.Modifiers));
    }

    private void Commit(string canonical)
    {
        Hotkey = canonical;
        HotkeyCaptured?.Invoke(this, canonical);
    }

    private static void OnHotkeyPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is HotkeyInputBox box) box.Text = e.NewValue as string ?? "";
    }

    private static bool IsModifierKey(Key key) =>
        key is Key.LeftCtrl or Key.RightCtrl or Key.LeftShift or Key.RightShift
            or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin;

    /// <summary>Modifiers in fixed order ctrl, shift, alt, win, then the main key segment. 1:1 Python _on_key_press.</summary>
    public static string BuildCanonical(Key key, ModifierKeys modifiers)
    {
        var parts = new List<string>(5);
        if ((modifiers & ModifierKeys.Control) != 0) parts.Add(ModifierCtrl);
        if ((modifiers & ModifierKeys.Shift) != 0) parts.Add(ModifierShift);
        if ((modifiers & ModifierKeys.Alt) != 0) parts.Add(ModifierAlt);
        if ((modifiers & ModifierKeys.Windows) != 0) parts.Add(ModifierWin);
        parts.Add(MainKeyCanonical(key));
        return HotkeyUtil.NormalizeCanonical(string.Join(Separator, parts));
    }

    /// <summary>Main key segment. 1:1 Python KEY_NAME_CANONICAL_MAP / _main_key_canonical.</summary>
    private static string MainKeyCanonical(Key key) => key switch
    {
        Key.Space => "space",
        Key.Enter => "enter",
        Key.Back => "backspace",
        Key.Tab => "tab",
        Key.Insert => "ins",
        Key.Home => "home",
        Key.End => "end",
        Key.PageUp => "pageup",
        Key.PageDown => "pagedown",
        Key.Up => "up",
        Key.Down => "down",
        Key.Left => "left",
        Key.Right => "right",
        >= Key.A and <= Key.Z => ((char)('a' + (key - Key.A))).ToString(),
        >= Key.D0 and <= Key.D9 => ((char)('0' + (key - Key.D0))).ToString(),
        >= Key.NumPad0 and <= Key.NumPad9 => ((char)('0' + (key - Key.NumPad0))).ToString(),
        _ => key.ToString().ToLowerInvariant(),
    };
}
