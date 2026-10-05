// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.ViewModels;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>Task-set manager view: augmentation, override, synthesis and ROI editors and the augmentation preview grids.</summary>
public partial class TaskSetWindow
{
    // ---------- augmentation and synthesis editors ----------

    private TextBlock AddLabel(Grid grid, int row, string key)
    {
        var label = new TextBlock { Style = (Style)FindResource("Label") };
        Grid.SetRow(label, row);
        grid.Children.Add(label);
        _fieldLabels.Add((label, key));
        return label;
    }

    private TextBox NewNumberBox() => new() { Style = (Style)FindResource("NumberBox") };

    private CheckBox NewCheck() => new() { Style = (Style)FindResource("Check") };

    private static void Place(Grid grid, UIElement element, int row, int column)
    {
        Grid.SetRow(element, row);
        Grid.SetColumn(element, column);
        grid.Children.Add(element);
    }

    private static void OnCommit(TextBox box, Action commit)
    {
        box.LostFocus += (_, _) => commit();
        box.KeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter) commit();
        };
    }

    private void BuildGlobalAugEditor()
    {
        for (int i = 0; i < TaskSetFields.Augmentation.Count; i++)
        {
            var field = TaskSetFields.Augmentation[i];
            GridGlobalAug.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            AddLabel(GridGlobalAug, i, field.LabelKey);
            Control editor;
            if (field.Kind == TaskSetFieldKind.Bool)
            {
                var check = NewCheck();
                check.Checked += (_, _) => CommitGlobalAug(field, true);
                check.Unchecked += (_, _) => CommitGlobalAug(field, false);
                editor = check;
            }
            else
            {
                var box = NewNumberBox();
                OnCommit(box, () => CommitGlobalAug(field, TaskSetFields.Parse(field.Kind, box.Text)));
                editor = box;
            }
            AutomationProperties.SetName(editor, T(field.LabelKey));
            Place(GridGlobalAug, editor, i, 1);
            _globalAugEditors.Add(editor);
        }
    }

    private void CommitGlobalAug(TaskSetAugField field, object? value)
    {
        if (_rendering) return;
        if (value != null) _vm.CommitGlobalAug(field, value);
        RenderGlobalAug();
        RenderOverride();
        ScheduleAugPreview();
    }

    private void RenderGlobalAug()
    {
        _rendering = true;
        var p = _vm.Set?.Augmentation ?? new AugmentationProfile();
        for (int i = 0; i < TaskSetFields.Augmentation.Count; i++)
            SetEditorValue(_globalAugEditors[i], TaskSetFields.Augmentation[i].Get(p));
        _rendering = false;
    }

    private void BuildOverrideEditor()
    {
        for (int i = 0; i < TaskSetFields.Augmentation.Count; i++)
        {
            var field = TaskSetFields.Augmentation[i];
            GridOverride.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            AddLabel(GridOverride, i, field.LabelKey);
            var inherit = NewCheck();
            Control editor = field.Kind == TaskSetFieldKind.Bool ? NewCheck() : NewNumberBox();
            AutomationProperties.SetName(editor, T(field.LabelKey));
            var global = new TextBlock { Style = (Style)FindResource("Hint") };
            var row = new OverrideRow(field, inherit, editor, global);
            inherit.Checked += (_, _) => SetOverrideInherit(row, true);
            inherit.Unchecked += (_, _) => SetOverrideInherit(row, false);
            if (editor is CheckBox check)
            {
                check.Checked += (_, _) => CommitOverride(row, true);
                check.Unchecked += (_, _) => CommitOverride(row, false);
            }
            else if (editor is TextBox box)
            {
                OnCommit(box, () => CommitOverride(row, TaskSetFields.Parse(field.Kind, box.Text)));
            }
            Place(GridOverride, inherit, i, 1);
            Place(GridOverride, editor, i, 2);
            Place(GridOverride, global, i, 3);
            _overrideRows.Add(row);
        }
    }

    private void SetOverrideInherit(OverrideRow row, bool inherit)
    {
        if (_rendering) return;
        _vm.SetOverrideInherit(row.Field, inherit);
        RenderOverride();
        ScheduleAugPreview();
    }

    private void CommitOverride(OverrideRow row, object? value)
    {
        if (_rendering) return;
        if (value != null) _vm.CommitOverride(row.Field, value);
        RenderOverride();
        ScheduleAugPreview();
    }

    private void RenderOverride()
    {
        _rendering = true;
        var global = _vm.Set?.Augmentation ?? new AugmentationProfile();
        var o = _vm.Target?.Augmentation;
        foreach (var row in _overrideRows)
        {
            var own = o == null ? null : row.Field.GetOverride(o);
            var globalValue = row.Field.Get(global);
            row.Inherit.IsChecked = own == null;
            row.Editor.IsEnabled = own != null;
            SetEditorValue(row.Editor, own ?? globalValue);
            row.Global.Text = T(I18nKeys.YoloTaskSetGlobalValue).Replace("{value}", TaskSetFields.Format(globalValue));
        }
        _rendering = false;
        RenderIpt();
    }

    private void BuildSynthesisEditor()
    {
        for (int i = 0; i < TaskSetFields.Synthesis.Count; i++)
        {
            var field = TaskSetFields.Synthesis[i];
            GridSynthesis.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            AddLabel(GridSynthesis, i, field.LabelKey);
            Control editor;
            if (field.Kind == TaskSetFieldKind.Choice && field.Choices is { } choices)
            {
                var combo = new ComboBox { Style = (Style)FindResource("ChoiceBox") };
                combo.SelectionChanged += (_, _) =>
                {
                    int idx = combo.SelectedIndex;
                    if (idx >= 0 && idx < choices.Count) CommitSynthesis(field, choices[idx].Value);
                };
                editor = combo;
            }
            else if (field.Kind == TaskSetFieldKind.Bool)
            {
                var check = NewCheck();
                check.Checked += (_, _) => CommitSynthesis(field, true);
                check.Unchecked += (_, _) => CommitSynthesis(field, false);
                editor = check;
            }
            else
            {
                var box = field.Kind == TaskSetFieldKind.NumberList ? new TextBox { Style = (Style)FindResource("WideBox") } : NewNumberBox();
                OnCommit(box, () => CommitSynthesis(field, TaskSetFields.Parse(field.Kind, box.Text)));
                editor = box;
            }
            AutomationProperties.SetName(editor, T(field.LabelKey));
            Place(GridSynthesis, editor, i, 1);
            _synEditors.Add(editor);
        }
    }

    private void CommitSynthesis(TaskSetSynField field, object? value)
    {
        if (_rendering) return;
        if (value != null && _vm.CommitSynthesis(field, value)) ScheduleAugPreview();
        RenderSynthesis();
        RenderIpt();
    }

    private void RenderSynthesis()
    {
        _rendering = true;
        var s = _vm.Set?.Synthesis ?? new SynthesisSettings();
        for (int i = 0; i < TaskSetFields.Synthesis.Count; i++)
        {
            var field = TaskSetFields.Synthesis[i];
            var value = field.Get(s);
            if (_synEditors[i] is ComboBox combo && field.Choices is { } choices)
            {
                combo.ItemsSource ??= choices.Select(c => T(c.TextKey)).ToArray();
                combo.SelectedIndex = Math.Max(0, choices.ToList().FindIndex(c => Equals(c.Value, value)));
            }
            else
            {
                SetEditorValue(_synEditors[i], value);
            }
        }
        var roi = _vm.Set?.InferenceRoiHint;
        CboRoiAnchor.SelectedIndex = Math.Max(0, TaskSetFields.RoiAnchors.ToList().FindIndex(a => a.Value == roi?.Anchor));
        TxtRoiBand.Text = TaskSetFields.Format(roi?.BandPixels ?? new InferenceRoiHint().BandPixels);
        TxtRoiRect.Text = TaskSetFields.FormatRect(roi?.Rect);
        TxtRoiBand.IsEnabled = roi != null && roi.Anchor != InferenceRoiHint.AnchorRect;
        TxtRoiRect.IsEnabled = roi?.Anchor == InferenceRoiHint.AnchorRect;
        _rendering = false;
    }

    private void BuildRoiEditor()
    {
        CboRoiAnchor.SelectionChanged += (_, _) => CommitRoi();
        OnCommit(TxtRoiBand, CommitRoi);
        OnCommit(TxtRoiRect, CommitRoi);
    }

    private void CommitRoi()
    {
        if (_rendering || _vm.Set == null) return;
        int idx = CboRoiAnchor.SelectedIndex;
        var anchor = idx >= 0 && idx < TaskSetFields.RoiAnchors.Count ? TaskSetFields.RoiAnchors[idx].Value : null;
        int band = TaskSetFields.Parse(TaskSetFieldKind.Int, TxtRoiBand.Text) is int b ? b : new InferenceRoiHint().BandPixels;
        _vm.SetRoiHint(anchor, band, TaskSetFields.ParseRect(TxtRoiRect.Text) ?? _vm.Set.InferenceRoiHint?.Rect);
        RenderSynthesis();
    }

    // ---------- augmentation preview grids (U5) ----------

    /// <summary>Header, shuffle button and image of one augmentation grid, built in code into a host ContentControl.</summary>
    private sealed class AugPreview
    {
        public TextBlock Title { get; } = new();

        public TextBlock Info { get; } = new() { TextWrapping = TextWrapping.Wrap };

        public Button Shuffle { get; } = new() { Content = "\uE8B1" };

        public Image Image { get; } = new() { Stretch = Stretch.Uniform, MaxHeight = AugPreviewMaxHeight, HorizontalAlignment = HorizontalAlignment.Left };

        public void ApplyTexts()
        {
            Title.Text = T(I18nKeys.YoloTaskSetAugPreviewTitle);
            Shuffle.ToolTip = T(I18nKeys.YoloTaskSetAugPreviewShuffle);
            AutomationProperties.SetName(Shuffle, T(I18nKeys.YoloTaskSetAugPreviewShuffle));
        }

        public FrameworkElement Build(Window owner)
        {
            Title.Style = (Style)owner.FindResource("SectionHeaderTextStyle");
            Info.Style = (Style)owner.FindResource("Hint");
            Shuffle.Style = (Style)owner.FindResource("IconBtn");
            RenderOptions.SetBitmapScalingMode(Image, BitmapScalingMode.NearestNeighbor);
            var header = new DockPanel { Margin = new Thickness(0, 12, 0, 4) };
            DockPanel.SetDock(Shuffle, Dock.Right);
            header.Children.Add(Shuffle);
            header.Children.Add(Title);
            var frame = new Border { Child = Image, HorizontalAlignment = HorizontalAlignment.Left };
            frame.SetResourceReference(FrameworkElement.StyleProperty, "InsetBorderStyle");
            var panel = new StackPanel();
            panel.Children.Add(header);
            panel.Children.Add(Info);
            panel.Children.Add(frame);
            return panel;
        }
    }

    private void BuildAugPreviews()
    {
        HostTargetAugPreview.Content = _targetAug.Build(this);
        HostGlobalAugPreview.Content = _globalAug.Build(this);
        foreach (var preview in new[] { _targetAug, _globalAug })
            preview.Shuffle.Click += (_, _) =>
            {
                _augSeed++;
                ScheduleAugPreview();
            };
    }

    private void ScheduleAugPreview()
    {
        _augTimer.Stop();
        _augTimer.Start();
    }

    /// <summary>Only the visible grid is rendered; stale results (newer request started) are dropped.</summary>
    private async Task RenderAugPreviewsAsync()
    {
        _augTimer.Stop();
        int version = ++_augVersion;
        bool targetVisible = TabOverride.IsSelected;
        bool globalVisible = TabGlobalAug.IsSelected;
        var target = _vm.Target is { Variants.Count: > 0 } t ? t : _vm.Set?.Targets.FirstOrDefault(x => x.Variants.Count > 0);
        if (targetVisible) await RenderAugPreviewAsync(_targetAug, _vm.Target, global: false, version);
        if (globalVisible) await RenderAugPreviewAsync(_globalAug, target, global: true, version);
    }

    private async Task RenderAugPreviewAsync(AugPreview preview, TaskTarget? target, bool global, int version)
    {
        var image = target == null ? null : await _vm.RenderAugmentationGridAsync(target, global, _augSeed);
        if (version != _augVersion) return;
        preview.Image.Source = image;
        preview.Info.Text = image == null || target == null ? T(I18nKeys.YoloTaskSetAugPreviewNone)
            : T(I18nKeys.YoloTaskSetAugPreviewTarget).Replace("{name}", target.Name);
    }

    private static void SetEditorValue(Control editor, object value)
    {
        switch (editor)
        {
            case CheckBox check:
                check.IsChecked = value is true;
                break;
            case TextBox box:
                box.Text = TaskSetFields.Format(value);
                break;
        }
    }

    private sealed record OverrideRow(TaskSetAugField Field, CheckBox Inherit, Control Editor, TextBlock Global);
}
