// PY-REF: pyapps/d3-check/ui/utils/config_binding.py
// PY-REF: pyapps/d3-check/ui/components/auxiliary_options_block.py
using System.Globalization;
using System.Windows.Controls;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// Single implementation for UI control to config key binding: load initial value, save on change (async write + change-hub notify),
/// and keep every control bound to the same key in sync. Pages call Bind* or the Save* helpers instead of private copies.
/// 1:1 Python ui/utils/config_binding.py ConfigBinding.
/// </summary>
public static class ConfigBinding
{
    private static readonly Dictionary<string, List<Binding>> _bindings = new(StringComparer.Ordinal);
    private static bool _updating;

    public static T? GetValue<T>(string keyPath, T? defaultValue = default) =>
        D3D4TesterConfigService.Instance.GetValueSafe(keyPath, defaultValue);

    /// <summary>Set value (async save), sync other bound controls, notify change hub on direct writes. 1:1 Python set_config_value.</summary>
    public static bool SetValue(string keyPath, object? value)
    {
        var svc = D3D4TesterConfigService.Instance;
        if (_updating)
        {
            svc.SetValueAsync(keyPath, value);
            UpdateBindings(keyPath, value);
            return true;
        }
        svc.SetValueAsync(keyPath, value);
        ColorPrinter.Green($"[ConfigBinding] Updated config '{keyPath}' = {value}");
        UpdateBindings(keyPath, value);
        D3D4TesterConfigChangeHub.Notify(keyPath);
        return true;
    }

    public static void SaveCheckbox(string keyPath, bool value) => SetValue(keyPath, value);

    public static void SaveString(string keyPath, string? value) => SetValue(keyPath, value ?? "");

    /// <summary>Combo value; null (no selection) is ignored.</summary>
    public static void SaveComboBox(string keyPath, string? value)
    {
        if (value == null) return;
        SetValue(keyPath, value);
    }

    /// <summary>Integer from text: non-numeric -> defaultValue, then clamped to [min, max]. Returns the saved value.</summary>
    public static int SaveInt(string keyPath, string? text, int min, int max, int defaultValue)
    {
        int v = ParseInt(text, min, max, defaultValue);
        SetValue(keyPath, v);
        return v;
    }

    /// <summary>Float from text: invalid -> defaultValue, then clamped to [min, max]. Returns the saved value.</summary>
    public static double SaveDouble(string keyPath, string? text, double min, double max, double defaultValue)
    {
        double v = ParseDouble(text, min, max, defaultValue);
        SetValue(keyPath, v);
        return v;
    }

    /// <summary>Int at key whether stored as JSON number or string; invalid -> defaultValue, then clamped to [min, max].</summary>
    public static int GetIntValue(string keyPath, int min, int max, int defaultValue) => ParseInt(GetRawScalar(keyPath), min, max, defaultValue);

    public static int ParseInt(string? text, int min, int max, int defaultValue)
    {
        var s = (text ?? "").Trim();
        int v = int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : defaultValue;
        return Math.Max(min, Math.Min(max, v));
    }

    /// <summary>1:1 Python _parse_float_safe plus range clamp.</summary>
    public static double ParseDouble(string? text, double min, double max, double defaultValue)
    {
        var s = (text ?? "").Trim();
        double v = double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : defaultValue;
        return Math.Max(min, Math.Min(max, v));
    }

    /// <summary>Bind CheckBox: load bool, save on Checked/Unchecked. 1:1 Python create_checkbox_binding.</summary>
    public static void BindCheckBox(CheckBox checkBox, string keyPath, bool defaultValue = false)
    {
        if (!TryRegister(checkBox, keyPath, v => checkBox.IsChecked = ToBool(v, defaultValue))) return;
        checkBox.IsChecked = GetValue<bool?>(keyPath, defaultValue) ?? defaultValue;
        checkBox.Checked += (_, _) => OnControlChanged(keyPath, true);
        checkBox.Unchecked += (_, _) => OnControlChanged(keyPath, false);
    }

    /// <summary>Bind TextBox to a string key: load, save on LostFocus. 1:1 Python create_input_binding.</summary>
    public static void BindTextBox(TextBox textBox, string keyPath, string defaultValue = "")
    {
        if (!TryRegister(textBox, keyPath, v => textBox.Text = v?.ToString() ?? "")) return;
        textBox.Text = GetValue<string>(keyPath, defaultValue) ?? defaultValue;
        textBox.LostFocus += (_, _) => OnControlChanged(keyPath, textBox.Text ?? "");
    }

    /// <summary>Bind TextBox to an int key with range validation: invalid -> defaultValue, clamp to [min, max], normalized text. 1:1 Python create_spinbox_binding (int increment).</summary>
    public static void BindIntTextBox(TextBox textBox, string keyPath, int min, int max, int defaultValue)
    {
        if (!TryRegister(textBox, keyPath, v => textBox.Text = v?.ToString() ?? "")) return;
        textBox.Text = ParseInt(GetRawScalar(keyPath), min, max, defaultValue).ToString(CultureInfo.InvariantCulture);
        textBox.LostFocus += (_, _) =>
        {
            int v = ParseInt(textBox.Text, min, max, defaultValue);
            textBox.Text = v.ToString(CultureInfo.InvariantCulture);
            OnControlChanged(keyPath, v);
        };
    }

    /// <summary>
    /// Bind ComboBox whose items (display text, e.g. i18n) are in the same order as values (config values).
    /// Selects the stored value (unknown -> defaultValue) and saves the value of the selected index. 1:1 Python create_combobox_binding.
    /// </summary>
    public static void BindComboBox(ComboBox comboBox, string keyPath, IReadOnlyList<string> values, string defaultValue)
    {
        void Select(object? v)
        {
            int idx = IndexOf(values, v?.ToString());
            if (idx < 0) idx = IndexOf(values, defaultValue);
            comboBox.SelectedIndex = idx;
        }
        if (!TryRegister(comboBox, keyPath, Select)) return;
        Select(GetValue<string>(keyPath, defaultValue));
        comboBox.SelectionChanged += (_, _) =>
        {
            int idx = comboBox.SelectedIndex;
            if (idx >= 0 && idx < values.Count) OnControlChanged(keyPath, values[idx]);
        };
    }

    /// <summary>
    /// Bind one TextBox to four int keys (top, left, bottom, right) as "t,l,b,r"; on LostFocus or Enter normalize the text and save all four.
    /// 1:1 Python auxiliary_options_block _create_bag_offset_row.
    /// </summary>
    public static void BindOffsetTextBox(TextBox textBox, OffsetInputHelper helper, string topKey, string leftKey, string bottomKey, string rightKey)
    {
        if (!TryRegister(textBox, topKey, _ => LoadOffset(textBox, topKey, leftKey, bottomKey, rightKey))) return;
        LoadOffset(textBox, topKey, leftKey, bottomKey, rightKey);
        void Commit()
        {
            var (t, l, b, r) = helper.Parse(textBox.Text);
            SetValue(leftKey, l);
            SetValue(bottomKey, b);
            SetValue(rightKey, r);
            SetValue(topKey, t);
            textBox.Text = OffsetInputHelper.Format(t, l, b, r);
        }
        textBox.LostFocus += (_, _) => Commit();
        textBox.KeyDown += (_, e) => { if (e.Key == System.Windows.Input.Key.Enter) Commit(); };
    }

    private static void LoadOffset(TextBox textBox, string topKey, string leftKey, string bottomKey, string rightKey)
    {
        textBox.Text = OffsetInputHelper.Format(
            GetValue(topKey, 0), GetValue(leftKey, 0), GetValue(bottomKey, 0), GetValue(rightKey, 0));
    }

    /// <summary>Log one line with the number of bound keys. Call once after all pages are built.</summary>
    public static void LogRegistrationSummary()
    {
        int n;
        lock (_bindings) n = _bindings.Count;
        if (n == 0) return;
        ColorPrinter.Debug($"[ConfigBinding] Registered {n} bindings");
    }

    private static void OnControlChanged(string keyPath, object value)
    {
        if (_updating) return;
        SetValue(keyPath, value);
    }

    /// <summary>Register control setter; false when this control is already bound to the key (page re-load), so handlers are not attached twice.</summary>
    private static bool TryRegister(Control control, string keyPath, Action<object?> setter)
    {
        lock (_bindings)
        {
            if (!_bindings.TryGetValue(keyPath, out var list))
            {
                list = new List<Binding>();
                _bindings[keyPath] = list;
            }
            list.RemoveAll(b => !b.Control.TryGetTarget(out _));
            if (list.Exists(b => b.Control.TryGetTarget(out var c) && ReferenceEquals(c, control)))
                return false;
            list.Add(new Binding(new WeakReference<Control>(control), setter));
            return true;
        }
    }

    private static void UpdateBindings(string keyPath, object? newValue)
    {
        if (_updating) return;
        List<Binding> copy;
        lock (_bindings)
        {
            if (!_bindings.TryGetValue(keyPath, out var list)) return;
            copy = new List<Binding>(list);
        }
        _updating = true;
        try
        {
            foreach (var b in copy)
            {
                if (!b.Control.TryGetTarget(out var control)) continue;
                if (control.Dispatcher.CheckAccess()) b.Setter(newValue);
                else control.Dispatcher.BeginInvoke(() =>
                {
                    _updating = true;
                    try { b.Setter(newValue); }
                    finally { _updating = false; }
                });
            }
        }
        finally
        {
            _updating = false;
        }
    }

    /// <summary>Scalar at key as text whether stored as JSON number or string; null when missing.</summary>
    private static string? GetRawScalar(string keyPath) =>
        D3D4TesterConfigService.Instance.GetRawText(keyPath)?.Trim().Trim('"');

    private static bool ToBool(object? v, bool defaultValue) => v switch
    {
        bool b => b,
        null => defaultValue,
        _ => v.ToString()?.Trim().ToLowerInvariant() is "1" or "true" or "yes"
    };

    private static int IndexOf(IReadOnlyList<string> values, string? value)
    {
        if (value == null) return -1;
        for (int i = 0; i < values.Count; i++)
            if (string.Equals(values[i], value, StringComparison.Ordinal)) return i;
        return -1;
    }

    private sealed record Binding(WeakReference<Control> Control, Action<object?> Setter);
}
