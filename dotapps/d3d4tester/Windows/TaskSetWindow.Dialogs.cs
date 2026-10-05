// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.VocAnnotator;
using DotCore.VocAnnotatorUI;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

public enum TaskSetPickTargets { None, Single, Multiple }

/// <summary>Modal picker of a task set and (optionally) one or more of its targets; built in code on the theme styles.</summary>
public sealed class TaskSetPickerDialog : Window
{
    private const double DialogWidth = 460;
    private const double DialogHeight = 520;
    private const double ListHeight = 260;

    private readonly ComboBox _sets = new() { DisplayMemberPath = nameof(TaskSet.Name), Margin = new Thickness(0, 0, 0, 12) };
    private readonly ListBox _targets = new() { DisplayMemberPath = nameof(TaskTarget.Name), Height = ListHeight };
    private readonly ComboBox _options = new() { Margin = new Thickness(0, 12, 0, 0) };
    private readonly Button _ok = new();
    private readonly TaskSetPickTargets _mode;

    private TaskSetPickerDialog(string title, string prompt, IReadOnlyList<TaskSet> sets, TaskSetPickTargets mode, string? selectId,
        string? optionsLabelKey, IReadOnlyList<string>? optionKeys)
    {
        _mode = mode;
        Title = title;
        Width = DialogWidth;
        Height = DialogHeight;
        ResizeMode = ResizeMode.CanResize;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        SetResourceReference(StyleProperty, "DialogWindowStyle");
        var root = new DockPanel { Margin = new Thickness(16, 4, 16, 16) };
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
        _ok.Content = T(I18nKeys.YoloTaskSetDialogOk);
        _ok.IsDefault = true;
        _ok.SetResourceReference(StyleProperty, "PrimaryButtonStyle");
        _ok.Margin = new Thickness(0, 0, 8, 0);
        _ok.Click += (_, _) => DialogResult = true;
        var cancel = new Button { Content = T(I18nKeys.YoloTaskSetCancel), IsCancel = true };
        cancel.SetResourceReference(StyleProperty, "SecondaryButtonStyle");
        buttons.Children.Add(_ok);
        buttons.Children.Add(cancel);
        DockPanel.SetDock(buttons, Dock.Bottom);
        root.Children.Add(buttons);
        var body = new StackPanel();
        var promptText = new TextBlock { Text = prompt, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) };
        promptText.SetResourceReference(StyleProperty, "SecondaryTextStyle");
        body.Children.Add(promptText);
        body.Children.Add(Label(I18nKeys.YoloTaskSetDialogSet));
        AutomationProperties.SetName(_sets, T(I18nKeys.YoloTaskSetDialogSet));
        _sets.ItemsSource = sets;
        body.Children.Add(_sets);
        if (mode != TaskSetPickTargets.None)
        {
            body.Children.Add(Label(mode == TaskSetPickTargets.Multiple ? I18nKeys.YoloTaskSetDialogTargets : I18nKeys.YoloTaskSetDialogTarget));
            _targets.SelectionMode = mode == TaskSetPickTargets.Multiple ? SelectionMode.Extended : SelectionMode.Single;
            AutomationProperties.SetName(_targets, T(I18nKeys.YoloTaskSetDialogTargets));
            body.Children.Add(_targets);
        }
        if (optionsLabelKey != null && optionKeys is { Count: > 0 })
        {
            var label = Label(optionsLabelKey);
            label.Margin = new Thickness(0, 12, 0, 4);
            body.Children.Add(label);
            _options.Margin = new Thickness(0);
            _options.ItemsSource = optionKeys.Select(T).ToList();
            _options.SelectedIndex = 0;
            AutomationProperties.SetName(_options, T(optionsLabelKey));
            body.Children.Add(_options);
        }
        root.Children.Add(body);
        Content = root;
        _sets.SelectionChanged += (_, _) =>
        {
            _targets.ItemsSource = (_sets.SelectedItem as TaskSet)?.Targets;
            if (_mode == TaskSetPickTargets.Multiple) _targets.SelectAll();
            else if (_targets.Items.Count > 0) _targets.SelectedIndex = 0;
            UpdateOk();
        };
        _targets.SelectionChanged += (_, _) => UpdateOk();
        _sets.SelectedItem = sets.FirstOrDefault(s => s.Id == selectId) ?? sets.FirstOrDefault();
        UpdateOk();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static TextBlock Label(string key)
    {
        var label = new TextBlock { Text = T(key), Margin = new Thickness(0, 0, 0, 4) };
        label.SetResourceReference(StyleProperty, "FieldLabelTextStyle");
        return label;
    }

    private void UpdateOk() =>
        _ok.IsEnabled = _sets.SelectedItem != null && (_mode == TaskSetPickTargets.None || _targets.SelectedItems.Count > 0);

    /// <summary>
    /// Selected set, targets (empty for TaskSetPickTargets.None) and option index (-1 without options), or null when cancelled.
    /// Options are i18n keys shown in a combo under optionsLabelKey.
    /// </summary>
    public static (TaskSet Set, IReadOnlyList<TaskTarget> Targets, int Option)? Show(Window? owner, string title, string prompt,
        IReadOnlyList<TaskSet> sets, TaskSetPickTargets mode, string? selectId = null, string? optionsLabelKey = null, IReadOnlyList<string>? optionKeys = null)
    {
        if (sets.Count == 0) return null;
        var dlg = new TaskSetPickerDialog(title, prompt, sets, mode, selectId, optionsLabelKey, optionKeys) { Owner = owner };
        if (dlg.ShowDialog() != true || dlg._sets.SelectedItem is not TaskSet set) return null;
        var targets = mode == TaskSetPickTargets.None ? new List<TaskTarget>()
            : set.Targets.Where(t => dlg._targets.SelectedItems.Contains(t)).ToList();
        return (set, targets, optionKeys is { Count: > 0 } ? dlg._options.SelectedIndex : -1);
    }
}

/// <summary>
/// Modal rectangle editor over a background image (placement regions of a scene / common resource): drag to draw, drag a box to
/// move or resize it, Delete removes the selected one, Ctrl+Z / Ctrl+Y undo / redo; regions are image-pixel boxes.
/// </summary>
public sealed class TaskSetRegionEditor : Window
{
    private const double EditorWidth = 1100;
    private const double EditorHeight = 760;
    private const double PitchBoxWidth = 64;

    private readonly AnnotationCanvas _canvas = new() { IsDrawMode = true, ShowLabels = false, Focusable = true };
    private readonly ObservableCollection<AnnotationBox> _boxes = new();
    private readonly UndoHistory _history = new();
    private readonly string _label;
    private readonly TextBox? _pitchX;
    private readonly TextBox? _pitchY;

    private TaskSetRegionEditor(string title, string hint, BitmapSource image, IEnumerable<AnnotationBox> regions, string label, bool readOnly,
        (int X, int Y)? snapPitch = null)
    {
        _label = label;
        Title = title;
        Width = EditorWidth;
        Height = EditorHeight;
        ResizeMode = ResizeMode.CanResize;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        SetResourceReference(StyleProperty, "DialogWindowStyle");
        foreach (var r in regions) _boxes.Add(r with { Label = label });
        _canvas.ImageSource = image;
        _canvas.Boxes = _boxes;
        _canvas.CurrentLabel = label;
        _canvas.IsDrawMode = !readOnly;
        if (!readOnly) _canvas.BoxDrawn += (_, box) => Edit(() => _boxes.Add(box.ClampTo(image.PixelWidth, image.PixelHeight).RoundToPixels() with { Label = _label }));
        if (!readOnly) _canvas.BoxEdited += (_, e) => Edit(() => _boxes[e.Index] = e.Box.ClampTo(image.PixelWidth, image.PixelHeight).RoundToPixels() with { Label = _label });
        AnnotationCanvasKeys.Attach(this, new AnnotationCanvasKeys(_canvas)
        {
            Delete = new RelayCommand(DeleteSelected),
            Undo = new RelayCommand(() => Restore(_history.Undo(_boxes))),
            Redo = new RelayCommand(() => Restore(_history.Redo(_boxes))),
        });

        var root = new DockPanel { Margin = new Thickness(16, 4, 16, 16) };
        var bar = new DockPanel { Margin = new Thickness(0, 12, 0, 0) };
        var buttons = new StackPanel { Orientation = Orientation.Horizontal };
        var ok = NewButton(I18nKeys.YoloTaskSetDialogOk, "PrimaryButtonStyle", () => DialogResult = true);
        ok.IsDefault = true;
        buttons.Children.Add(ok);
        if (!readOnly) buttons.Children.Add(NewButton(I18nKeys.YoloTaskSetCancel, "SecondaryButtonStyle", () => DialogResult = false));
        DockPanel.SetDock(buttons, Dock.Right);
        bar.Children.Add(buttons);
        var tools = new StackPanel { Orientation = Orientation.Horizontal };
        if (!readOnly)
        {
            tools.Children.Add(NewButton(I18nKeys.YoloTaskSetRegionsDeleteSelected, "SecondaryButtonStyle", DeleteSelected));
            tools.Children.Add(NewButton(I18nKeys.YoloTaskSetRegionsClear, "DangerButtonStyle", () => Edit(_boxes.Clear)));
        }
        tools.Children.Add(NewButton(I18nKeys.YoloTaskSetExtractFit, "SecondaryButtonStyle", _canvas.FitToView));
        if (snapPitch is { } pitch && !readOnly)
        {
            _pitchX = PitchBox(tools, I18nKeys.YoloTaskSetRegionsPitchX, pitch.X);
            _pitchY = PitchBox(tools, I18nKeys.YoloTaskSetRegionsPitchY, pitch.Y);
        }
        bar.Children.Add(tools);
        DockPanel.SetDock(bar, Dock.Bottom);
        root.Children.Add(bar);
        var hintText = new TextBlock { Text = hint, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) };
        hintText.SetResourceReference(StyleProperty, "SecondaryTextStyle");
        DockPanel.SetDock(hintText, Dock.Top);
        root.Children.Add(hintText);
        var frame = new Border { Padding = new Thickness(0), Child = _canvas, ClipToBounds = true };
        frame.SetResourceReference(StyleProperty, "InsetBorderStyle");
        root.Children.Add(frame);
        Content = root;
        Loaded += (_, _) => _canvas.Focus();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static TextBox PitchBox(Panel host, string labelKey, int value)
    {
        var label = new TextBlock { Text = T(labelKey), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 8, 0) };
        label.SetResourceReference(StyleProperty, "FieldLabelTextStyle");
        var box = new TextBox { Text = value.ToString(System.Globalization.CultureInfo.InvariantCulture), Width = PitchBoxWidth, TextAlignment = TextAlignment.Right };
        AutomationProperties.SetName(box, label.Text);
        host.Children.Add(label);
        host.Children.Add(box);
        return box;
    }

    private static int ParsePitch(TextBox? box) =>
        int.TryParse(box?.Text.Trim(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var v) ? Math.Max(0, v) : 0;

    private Button NewButton(string key, string style, Action click)
    {
        var button = new Button { Content = T(key), Margin = new Thickness(0, 0, 8, 0) };
        button.SetResourceReference(StyleProperty, style);
        button.Click += (_, _) => click();
        return button;
    }

    private void Edit(Action change)
    {
        _history.Push(_boxes);
        change();
    }

    private void Restore(List<AnnotationBox>? boxes)
    {
        if (boxes == null) return;
        _boxes.Clear();
        foreach (var b in boxes) _boxes.Add(b);
        _canvas.SelectedIndex = -1;
    }

    private void DeleteSelected()
    {
        int index = _canvas.SelectedIndex;
        if (index < 0 || index >= _boxes.Count) return;
        Edit(() => _boxes.RemoveAt(index));
        _canvas.SelectedIndex = -1;
    }

    /// <summary>Edited regions (image pixels), or null when cancelled.</summary>
    public static IReadOnlyList<AnnotationBox>? Show(Window? owner, string title, string hint, BitmapSource image, IEnumerable<AnnotationBox> regions, string label)
    {
        var dlg = new TaskSetRegionEditor(title, hint, image, regions, label, readOnly: false) { Owner = owner };
        return dlg.ShowDialog() == true ? dlg._boxes.ToList() : null;
    }

    /// <summary>Read-only view of boxes over an image (e.g. a contamination hit).</summary>
    /// <summary>Placement regions plus the slot-grid pitch shared by them (0 = no grid), or null when cancelled.</summary>
    public static (IReadOnlyList<AnnotationBox> Regions, int PitchX, int PitchY)? ShowRegions(Window? owner, string title, string hint, BitmapSource image,
        IEnumerable<AnnotationBox> regions, string label, int pitchX, int pitchY)
    {
        var dlg = new TaskSetRegionEditor(title, hint, image, regions, label, readOnly: false, (pitchX, pitchY)) { Owner = owner };
        return dlg.ShowDialog() == true ? (dlg._boxes.ToList(), ParsePitch(dlg._pitchX), ParsePitch(dlg._pitchY)) : null;
    }

    public static void View(Window? owner, string title, string hint, BitmapSource image, IEnumerable<AnnotationBox> boxes)
    {
        var list = boxes.ToList();
        var dlg = new TaskSetRegionEditor(title, hint, image, list, list.FirstOrDefault()?.Label ?? "", readOnly: true) { Owner = owner };
        dlg.ShowDialog();
    }
}
