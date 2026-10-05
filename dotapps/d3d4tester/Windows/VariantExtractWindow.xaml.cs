// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotCore.Common;
using DotCore.VocAnnotator;
using DotCore.VocAnnotatorUI;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Extracts variants ("1.x") from large images or video frames: pick a source (target scenes, common resources or any file),
/// draw boxes, track a box through a video or repeat it over a frame range, refine cutouts per crop (rectangle, GrabCut with
/// foreground / background brush strokes, border colour key), review crops in a filmstrip and add the checked ones to a target
/// through the owner's callback. Each source is decoded through one VideoFrameReader.
/// </summary>
public partial class VariantExtractWindow : Window
{
    private const int FrameDebounceMs = 150;
    private const int RecutDebounceMs = 250;
    private const int FrameBigStep = 10;
    private const int MinRegionSide = 2;
    private const int CutConcurrency = 2;
    private const int ThumbnailSide = 128;
    private const int DefaultTrackStep = 5;
    private const int DefaultTrackCount = 20;
    private const int DefaultFixedEvery = 10;
    private const int EditSourceMissingTolerance = 0;
    private const string TimeFormat = @"hh\:mm\:ss\.fff";
    private const string ConfidenceFormat = "0.00";

    private readonly TaskSetStore _store;
    private readonly Func<TaskTarget, IReadOnlyList<ExtractedVariant>, Task<int>> _addVariants;
    private readonly Func<IReadOnlyList<ExtractedVariant>, Task<int>>? _addDistractors;
    private readonly ObservableCollection<ExtractCrop> _crops = new();
    private readonly ObservableCollection<AnnotationBox> _boxes = new();
    private readonly List<ExtractCrop> _frameCrops = new();
    private readonly List<string> _externalSources = new();
    private readonly Dictionary<string, VideoFrameReader> _readers = new(StringComparer.OrdinalIgnoreCase);
    private readonly UndoHistory<CropState> _history = new();
    private readonly SemaphoreSlim _cutGate = new(CutConcurrency);
    private readonly DispatcherTimer _frameTimer;
    private readonly DispatcherTimer _recutTimer;
    private readonly ListCollectionView _film;
    private TaskSet _set;
    private string? _sourcePath;
    private bool _sourceIsVideo;
    private VideoInfo? _video;
    private int _frame;
    private int _sourceVersion;
    private int _loadVersion;
    private bool _imageLoaded;
    private bool _rendering;
    private bool _syncing;
    private bool _adding;
    private bool _addBlocked;
    private double _sourcePixelScale = 1.0;
    private bool _closeConfirmed;
    private bool _closed;
    private CancellationTokenSource? _workCts;
    private Func<string> _status = () => "";

    /// <param name="addDistractors">When set, the destination list also offers the task set's distractor pool (unlabeled look-alikes).</param>
    public VariantExtractWindow(TaskSet set, TaskSetStore store, Func<TaskTarget, IReadOnlyList<ExtractedVariant>, Task<int>> addVariants,
        Func<IReadOnlyList<ExtractedVariant>, Task<int>>? addDistractors = null)
    {
        _set = set;
        _store = store;
        _addVariants = addVariants;
        _addDistractors = addDistractors;
        InitializeComponent();
        _frameTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(FrameDebounceMs) };
        _frameTimer.Tick += async (_, _) =>
        {
            _frameTimer.Stop();
            await LoadFrameAsync(fit: false);
        };
        _recutTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(RecutDebounceMs) };
        _recutTimer.Tick += (_, _) =>
        {
            _recutTimer.Stop();
            ApplyToleranceToSelection();
        };
        _film = new ListCollectionView(_crops) { Filter = o => o is ExtractCrop c && PathEquals(c.SourcePath, _sourcePath) };
        _film.SortDescriptions.Add(new SortDescription(nameof(ExtractCrop.Frame), ListSortDirection.Ascending));
        LstCrops.ItemsSource = _crops;
        LstFilm.ItemsSource = _film;
        Canvas.Boxes = _boxes;
        Canvas.BrushRadius = SldBrush.Value;
        _crops.CollectionChanged += OnCropsChanged;
        TxtStep.Text = DefaultTrackStep.ToString(CultureInfo.InvariantCulture);
        TxtCount.Text = DefaultTrackCount.ToString(CultureInfo.InvariantCulture);
        TxtFixedEvery.Text = DefaultFixedEvery.ToString(CultureInfo.InvariantCulture);
        TxtDedupe.Text = VariantExtractor.DefaultDedupeDistance.ToString(CultureInfo.InvariantCulture);
        _rendering = true;
        SldTolerance.Value = VariantCutOptions.DefaultColorKeyTolerance;
        _rendering = false;
        ApplyTexts();
        BindEvents();
        PanelVideo.Visibility = Visibility.Collapsed;
        UpdateModePanel();
        UpdateEnabled();
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string N(int value) => value.ToString(CultureInfo.InvariantCulture);

    /// <summary>Unadded crops exist (checked or not).</summary>
    public bool HasPendingCrops => _crops.Count > 0;

    private VariantCutout Mode => RadioGrabCut.IsChecked == true ? VariantCutout.GrabCut
        : RadioColorKey.IsChecked == true ? VariantCutout.ColorKey
        : VariantCutout.Rectangle;

    private int Tolerance => (int)Math.Round(SldTolerance.Value);

    private bool Holes => ChkHoles.IsChecked == true;

    private CanvasStrokeKind? Tool => RadioToolForeground.IsChecked == true ? CanvasStrokeKind.Foreground
        : RadioToolBackground.IsChecked == true ? CanvasStrokeKind.Background
        : RadioToolErase.IsChecked == true ? CanvasStrokeKind.Erase
        : null;

    private TaskTarget? SelectedTarget => (CboTarget.SelectedItem as TargetItem)?.Target;

    private bool DistractorsSelected => CboTarget.SelectedItem is TargetItem { Target: null };

    /// <summary>Name of the destination (target name or the distractor pool) for status texts.</summary>
    private string DestinationName => SelectedTarget?.Name ?? (DistractorsSelected ? T(I18nKeys.VariantExtractDistractorPool) : "");

    /// <summary>Select the target and optionally a source (resource or external file) to extract from.</summary>
    public void Open(TaskTarget? target, string? sourcePath)
    {
        RefreshTargets(target);
        if (sourcePath != null) _ = SelectSourceAsync(sourcePath);
        Activate();
    }

    /// <summary>Select the distractor pool as destination (requires the addDistractors callback) and optionally a source.</summary>
    public void OpenForDistractors(string? sourcePath)
    {
        RebuildTargets(null, selectDistractors: true);
        if (sourcePath != null) _ = SelectSourceAsync(sourcePath);
        Activate();
    }

    /// <summary>Rebuild targets and sources after the owner changed the task set.</summary>
    public void RefreshTargets(TaskTarget? select = null) => RebuildTargets(select, selectDistractors: false);

    private void RebuildTargets(TaskTarget? select, bool selectDistractors)
    {
        selectDistractors |= select == null && DistractorsSelected;
        select ??= SelectedTarget;
        _rendering = true;
        var items = _set.Targets.Select((t, i) => new TargetItem($"{i + 1}. {t.Name}", t)).ToList();
        if (_addDistractors != null) items.Add(new TargetItem(T(I18nKeys.VariantExtractDistractorPool), null));
        CboTarget.ItemsSource = items;
        CboTarget.SelectedItem = selectDistractors && _addDistractors != null
            ? items[^1]
            : items.FirstOrDefault(i => i.Target != null && ReferenceEquals(i.Target, select)) ?? items.FirstOrDefault();
        _rendering = false;
        RebuildSources();
        UpdateEnabled();
    }

    /// <summary>Keep the pending crops when the owner reloaded the same task set (new instances, same ids).</summary>
    public void Rebind(TaskSet set)
    {
        var targetId = SelectedTarget?.Id;
        bool distractors = DistractorsSelected;
        _set = set;
        var variants = set.Targets.SelectMany(t => t.Variants).ToList();
        foreach (var crop in _crops)
            if (crop.Replaces is { } old) crop.Replaces = variants.FirstOrDefault(v => v.Id == old.Id);
        RebuildTargets(set.Targets.FirstOrDefault(t => t.Id == targetId), distractors);
        foreach (var crop in _crops) DescribeCrop(crop);
    }

    /// <summary>Block adding while the owner works on the task set (e.g. dataset generation snapshots it).</summary>
    public void SetAddBlocked(bool blocked)
    {
        _addBlocked = blocked;
        UpdateEnabled();
    }

    /// <summary>Close through the pending-crop guard; false when the window stays open (cancelled, or adding first).</summary>
    public bool RequestClose()
    {
        Close();
        return _closed;
    }

    /// <summary>Re-cut a stored variant: opens its original source region ("path#frame=N@x,y,w,h"), else the stored image itself; adding replaces it.</summary>
    public void EditVariant(TaskTarget target, TaskResource variant) => _ = EditVariantAsync(target, variant);

    protected override void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        if (e.Cancel || _closeConfirmed) return;
        if (_adding)
        {
            e.Cancel = true;
            return;
        }
        int pending = _crops.Count(c => c.IsChecked);
        if (pending == 0) return;
        var text = T(I18nKeys.VariantExtractCloseConfirm)
            .Replace("{count}", N(pending))
            .Replace("{target}", DestinationName);
        var answer = MessageBox.Show(this, text, Title, MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (answer == MessageBoxResult.No) return;
        e.Cancel = true;
        if (answer == MessageBoxResult.Yes) _ = AddThenCloseAsync();
    }

    protected override void OnClosed(EventArgs e)
    {
        _closed = true;
        _workCts?.Cancel();
        _frameTimer.Stop();
        _recutTimer.Stop();
        D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        foreach (var reader in _readers.Values) reader.Dispose();
        _readers.Clear();
        base.OnClosed(e);
    }

    private async Task AddThenCloseAsync()
    {
        if (!await AddAsync() || _crops.Any(c => c.IsChecked)) return;
        _closeConfirmed = true;
        Close();
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        RebuildSources();
        foreach (var crop in _crops) DescribeCrop(crop);
        RenderFrameInfo();
        UpdateEnabled();
        TxtStatus.Text = _status();
    });

    private void ApplyTexts()
    {
        Title = T(I18nKeys.YoloTaskSetExtractWindowTitle);
        LblSource.Text = T(I18nKeys.YoloTaskSetExtractSectionSource);
        LblTarget.Text = T(I18nKeys.YoloTaskSetExtractTargetLabel);
        LblSourcePick.Text = T(I18nKeys.YoloTaskSetExtractSourceLabel);
        BtnBrowse.Content = T(I18nKeys.YoloTaskSetExtractBrowse);
        LblMode.Text = T(I18nKeys.YoloTaskSetExtractModeLabel);
        RadioRectangle.Content = T(I18nKeys.YoloTaskSetExtractModeRectangle);
        RadioGrabCut.Content = T(I18nKeys.YoloTaskSetExtractModeGrabCut);
        RadioColorKey.Content = T(I18nKeys.VariantExtractModeColorKey);
        ChkHoles.Content = T(I18nKeys.VariantExtractColorKeyHoles);
        TxtModeHint.Text = T(I18nKeys.VariantExtractModeHint);
        LblTool.Text = T(I18nKeys.VariantExtractToolLabel);
        RadioToolBox.Content = T(I18nKeys.VariantExtractToolBox);
        RadioToolForeground.Content = T(I18nKeys.VariantExtractToolForeground);
        RadioToolBackground.Content = T(I18nKeys.VariantExtractToolBackground);
        RadioToolErase.Content = T(I18nKeys.VariantExtractToolErase);
        RenderSliderTexts();
        LblTrack.Text = T(I18nKeys.VariantExtractSectionTrack);
        LblStep.Text = T(I18nKeys.VariantExtractStep);
        LblCount.Text = T(I18nKeys.VariantExtractCount);
        BtnTrackForward.Content = T(I18nKeys.VariantExtractTrackForward);
        BtnTrackBackward.Content = T(I18nKeys.VariantExtractTrackBackward);
        LblFixedFrom.Text = T(I18nKeys.VariantExtractFixedFrom);
        LblFixedTo.Text = T(I18nKeys.VariantExtractFixedTo);
        LblFixedEvery.Text = T(I18nKeys.VariantExtractFixedEvery);
        BtnFixedBox.Content = T(I18nKeys.VariantExtractFixedBox);
        ChkDedupe.Content = T(I18nKeys.VariantExtractDedupeLabel);
        BtnCancel.Content = T(I18nKeys.VariantExtractCancel);
        LblPending.Text = T(I18nKeys.YoloTaskSetExtractSectionPending);
        BtnAdd.Content = T(I18nKeys.YoloTaskSetExtractAdd);
        BtnClear.Content = T(I18nKeys.YoloTaskSetExtractClear);
        BtnFit.Content = T(I18nKeys.YoloTaskSetExtractFit);
        TxtHint.Text = T(I18nKeys.VariantExtractViewerHint);
        BtnCheckAll.Content = T(I18nKeys.VariantExtractCheckAll);
        BtnUncheckAll.Content = T(I18nKeys.VariantExtractUncheckAll);
        BtnDedupe.Content = T(I18nKeys.VariantExtractDedupe);
        BtnRemoveUnchecked.Content = T(I18nKeys.VariantExtractRemoveUnchecked);
        Tip(BtnUndo, I18nKeys.VariantExtractUndo);
        Tip(BtnRedo, I18nKeys.VariantExtractRedo);
        Tip(BtnFixedFromCurrent, I18nKeys.VariantExtractUseCurrentFrame);
        Tip(BtnFixedToCurrent, I18nKeys.VariantExtractUseCurrentFrame);
        Tip(BtnFrameBack, I18nKeys.YoloTaskSetExtractFrameBack);
        Tip(BtnFramePrev, I18nKeys.YoloTaskSetExtractFramePrev);
        Tip(BtnFrameNext, I18nKeys.YoloTaskSetExtractFrameNext);
        Tip(BtnFrameForward, I18nKeys.YoloTaskSetExtractFrameForward);
    }

    private static void Tip(FrameworkElement element, string key)
    {
        var text = T(key);
        element.ToolTip = text;
        AutomationProperties.SetName(element, text);
    }

    private void RenderSliderTexts()
    {
        TxtTolerance.Text = T(I18nKeys.VariantExtractTolerance).Replace("{value}", N(Tolerance));
        TxtBrush.Text = T(I18nKeys.VariantExtractBrushRadius).Replace("{value}", N((int)Math.Round(SldBrush.Value)));
    }

    private void RemoveCropButton_Loaded(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement element) Tip(element, I18nKeys.VariantExtractRemoveCrop);
    }

    private void BindEvents()
    {
        CboTarget.SelectionChanged += (_, _) =>
        {
            if (_rendering) return;
            RebuildSources();
            RenderBoxes(-1);
            UpdateEnabled();
        };
        CboSource.SelectionChanged += async (_, _) =>
        {
            if (!_rendering && CboSource.SelectedItem is SourceItem item && !PathEquals(item.Path, _sourcePath)) await LoadSourceAsync(item.Path);
        };
        BtnBrowse.Click += async (_, _) => await BrowseAsync();
        foreach (var radio in new[] { RadioRectangle, RadioGrabCut, RadioColorKey })
            radio.Checked += (_, _) => OnModeChosen();
        SldTolerance.ValueChanged += (_, _) =>
        {
            RenderSliderTexts();
            if (_rendering) return;
            _recutTimer.Stop();
            _recutTimer.Start();
        };
        ChkHoles.Checked += (_, _) => ApplyHolesToSelection();
        ChkHoles.Unchecked += (_, _) => ApplyHolesToSelection();
        foreach (var radio in new[] { RadioToolBox, RadioToolForeground, RadioToolBackground, RadioToolErase })
            radio.Checked += (_, _) =>
            {
                Canvas.StrokeTool = Tool;
                Canvas.IsDrawMode = Tool == null;
            };
        SldBrush.ValueChanged += (_, _) =>
        {
            Canvas.BrushRadius = SldBrush.Value;
            RenderSliderTexts();
        };
        BtnAdd.Click += async (_, _) => await AddAsync();
        BtnClear.Click += (_, _) => RemoveCrops(_crops.ToList());
        BtnFit.Click += (_, _) => Canvas.FitToView();
        BtnUndo.Click += (_, _) => Undo();
        BtnRedo.Click += (_, _) => Redo();
        BtnFrameBack.Click += (_, _) => StepFrame(-FrameBigStep);
        BtnFramePrev.Click += (_, _) => StepFrame(-1);
        BtnFrameNext.Click += (_, _) => StepFrame(1);
        BtnFrameForward.Click += (_, _) => StepFrame(FrameBigStep);
        SldFrame.ValueChanged += (_, _) =>
        {
            if (_rendering) return;
            _frame = (int)SldFrame.Value;
            OnFrameChanged();
        };
        BtnTrackForward.Click += async (_, _) => await TrackAsync(TrackDirection.Forward);
        BtnTrackBackward.Click += async (_, _) => await TrackAsync(TrackDirection.Backward);
        BtnFixedFromCurrent.Click += (_, _) => TxtFixedFrom.Text = N(_frame);
        BtnFixedToCurrent.Click += (_, _) => TxtFixedTo.Text = N(_frame);
        BtnFixedBox.Click += async (_, _) => await FixedBoxAsync();
        BtnCancel.Click += (_, _) => _workCts?.Cancel();
        BtnCheckAll.Click += (_, _) => SetChecked(FilmCrops(), true);
        BtnUncheckAll.Click += (_, _) => SetChecked(FilmCrops(), false);
        BtnDedupe.Click += (_, _) => DedupeFilm();
        BtnRemoveUnchecked.Click += (_, _) => RemoveCrops(FilmCrops().Where(c => !c.IsChecked).ToList());
        LstCrops.SelectionChanged += (_, _) => OnListSelectionChanged();
        LstFilm.SelectionChanged += (_, _) =>
        {
            if (!_syncing && LstFilm.SelectedItem is ExtractCrop crop) _ = NavigateToAsync(crop);
        };
        Canvas.BoxDrawn += (_, box) => OnBoxDrawn(box);
        Canvas.BoxEdited += (_, e) => OnBoxEdited(e.Index, e.Box);
        Canvas.StrokeDrawn += (_, stroke) => OnStrokeDrawn(stroke);
        Canvas.PreviewMouseDown += (_, _) => Canvas.Focus();
        DependencyPropertyDescriptor.FromProperty(AnnotationCanvas.SelectedIndexProperty, typeof(AnnotationCanvas))
            .AddValueChanged(Canvas, (_, _) => SyncSelectionFromCanvas());
        Canvas.DragOver += (_, e) =>
        {
            e.Effects = DroppedSource(e) != null ? DragDropEffects.Copy : DragDropEffects.None;
            e.Handled = true;
        };
        Canvas.Drop += async (_, e) =>
        {
            if (DroppedSource(e) is { } path) await SelectSourceAsync(path);
        };
        AnnotationCanvasKeys.Attach(this, new AnnotationCanvasKeys(Canvas)
        {
            Delete = new AnnotatorCommand(() => RemoveCrops(SelectedCrops())),
            Undo = new AnnotatorCommand(Undo, () => _history.CanUndo),
            Redo = new AnnotatorCommand(Redo, () => _history.CanRedo),
            Escape = new AnnotatorCommand(Escape),
        }, OnHostKeyDown);
    }

    private void OnHostKeyDown(object sender, KeyEventArgs e)
    {
        if (Keyboard.FocusedElement is TextBox or ComboBox or ComboBoxItem) return;
        bool ctrl = (Keyboard.Modifiers & ModifierKeys.Control) != 0, shift = (Keyboard.Modifiers & ModifierKeys.Shift) != 0;
        switch (e.Key)
        {
            case Key.Enter when ctrl:
                _ = AddAsync();
                e.Handled = true;
                return;
            case Key.Left when !ctrl && _video != null:
                StepFrame(shift ? -FrameBigStep : -1);
                e.Handled = true;
                return;
            case Key.Right when !ctrl && _video != null:
                StepFrame(shift ? FrameBigStep : 1);
                e.Handled = true;
                return;
        }
    }

    private void Escape()
    {
        if (_workCts != null) _workCts.Cancel();
        else if (Canvas.SelectedIndex >= 0) RenderBoxes(-1);
        else RadioToolBox.IsChecked = true;
    }

    private static string? DroppedSource(DragEventArgs e) =>
        e.Data.GetData(DataFormats.FileDrop) is string[] files
            ? files.FirstOrDefault(f => TaskSetStore.IsSupportedImage(f) || TaskSetStore.IsSupportedVideo(f))
            : null;

    private void OnCropsChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        foreach (var crop in e.NewItems?.OfType<ExtractCrop>() ?? Enumerable.Empty<ExtractCrop>())
        {
            crop.PropertyChanged -= OnCropPropertyChanged;
            crop.PropertyChanged += OnCropPropertyChanged;
        }
        UpdateEnabled();
    }

    private void OnCropPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(ExtractCrop.IsChecked)) UpdateEnabled();
    }

    private void UpdateEnabled()
    {
        bool busy = _adding || _workCts != null;
        int checkedCount = _crops.Count(c => c.IsChecked);
        BtnAdd.IsEnabled = !busy && !_addBlocked && checkedCount > 0 && (SelectedTarget != null || DistractorsSelected);
        BtnClear.IsEnabled = !busy && _crops.Count > 0;
        BtnUndo.IsEnabled = !busy && _history.CanUndo;
        BtnRedo.IsEnabled = !busy && _history.CanRedo;
        bool canSeries = !busy && _video != null;
        BtnTrackForward.IsEnabled = canSeries;
        BtnTrackBackward.IsEnabled = canSeries;
        BtnFixedBox.IsEnabled = canSeries;
        BtnFixedFromCurrent.IsEnabled = _video != null;
        BtnFixedToCurrent.IsEnabled = _video != null;
        var film = FilmCrops();
        TxtFilm.Text = T(I18nKeys.VariantExtractSectionFilmstrip)
            .Replace("{checked}", N(film.Count(c => c.IsChecked)))
            .Replace("{total}", N(film.Count));
        BtnCheckAll.IsEnabled = BtnUncheckAll.IsEnabled = BtnDedupe.IsEnabled = !busy && film.Count > 0;
        BtnRemoveUnchecked.IsEnabled = !busy && film.Any(c => !c.IsChecked);
    }

    private void SetStatus(Func<string> status)
    {
        _status = status;
        TxtStatus.Text = status();
    }

    // ---------- sources ----------

    private void RebuildSources()
    {
        var items = new List<SourceItem>();
        if (SelectedTarget is { } target)
            foreach (var r in target.Scenes)
                items.Add(new SourceItem(T(I18nKeys.YoloTaskSetExtractSourceScene).Replace("{name}", Path.GetFileName(r.File)), _store.ResourcePath(_set, r)));
        foreach (var r in _set.CommonResources)
            items.Add(new SourceItem(T(I18nKeys.YoloTaskSetExtractSourceCommon).Replace("{name}", Path.GetFileName(r.File)), _store.ResourcePath(_set, r)));
        foreach (var path in _externalSources)
            items.Add(new SourceItem(T(I18nKeys.YoloTaskSetExtractSourceExternal).Replace("{name}", Path.GetFileName(path)), path));
        _rendering = true;
        CboSource.ItemsSource = items;
        CboSource.SelectedItem = items.FirstOrDefault(i => PathEquals(i.Path, _sourcePath));
        _rendering = false;
        if (_sourcePath == null) SetStatus(() => T(I18nKeys.YoloTaskSetExtractNoSource));
    }

    private async Task SelectSourceAsync(string path)
    {
        var full = Path.GetFullPath(path);
        if (CboSource.ItemsSource is not IEnumerable<SourceItem> items || !items.Any(i => PathEquals(i.Path, full)))
        {
            _externalSources.Add(full);
            RebuildSources();
        }
        var item = ((IEnumerable<SourceItem>)CboSource.ItemsSource).First(i => PathEquals(i.Path, full));
        _rendering = true;
        CboSource.SelectedItem = item;
        _rendering = false;
        if (!PathEquals(item.Path, _sourcePath)) await LoadSourceAsync(item.Path);
    }

    /// <summary>PixelScale of the task-set resource stored at path (scenes of any target, common resources); 1 for external files.</summary>
    private double PixelScaleOf(string path) =>
        _set.Targets.SelectMany(t => t.Scenes).Concat(_set.CommonResources)
            .FirstOrDefault(r => PathEquals(_store.ResourcePath(_set, r), path))?.PixelScale ?? 1.0;

    private static bool PathEquals(string? a, string? b) => a != null && b != null && string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private async Task BrowseAsync()
    {
        var images = string.Join(";", TaskSetStore.ImageExtensions.Select(e => "*" + e));
        var videos = string.Join(";", TaskSetStore.VideoExtensions.Select(e => "*" + e));
        var dlg = new Microsoft.Win32.OpenFileDialog
        {
            Filter = $"{T(I18nKeys.YoloTaskSetMediaFilter)}|{images};{videos}|{T(I18nKeys.YoloTaskSetImageFilter)}|{images}",
        };
        if (dlg.ShowDialog(this) == true) await SelectSourceAsync(dlg.FileName);
    }

    /// <summary>Open (or reuse) the reader of a source; null when the window closed meanwhile.</summary>
    private async Task<VideoFrameReader?> GetReaderAsync(string path)
    {
        if (_readers.TryGetValue(path, out var reader)) return reader;
        var created = await Task.Run(() => new VideoFrameReader(path));
        if (_closed || _readers.TryGetValue(path, out reader))
        {
            created.Dispose();
            return _closed ? null : reader;
        }
        _readers[path] = created;
        return created;
    }

    /// <summary>Dispose readers of sources that are neither shown nor referenced by a pending crop.</summary>
    private void ReleaseUnusedReaders()
    {
        foreach (var path in _readers.Keys.ToList())
        {
            if (PathEquals(path, _sourcePath) || _crops.Any(c => PathEquals(c.SourcePath, path))) continue;
            _readers[path].Dispose();
            _readers.Remove(path);
        }
    }

    private async Task LoadSourceAsync(string path)
    {
        int version = ++_sourceVersion;
        _sourcePath = path;
        _sourceIsVideo = VariantExtractor.IsVideo(path);
        _sourcePixelScale = PixelScaleOf(path);
        _video = null;
        _frame = 0;
        _imageLoaded = false;
        Canvas.ImageSource = null;
        PanelVideo.Visibility = Visibility.Collapsed;
        _film.Refresh();
        RenderBoxes(-1);
        UpdateEnabled();
        SetStatus(() => T(I18nKeys.YoloTaskSetExtractLoading));
        VideoFrameReader? reader;
        try
        {
            reader = await GetReaderAsync(path);
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            reader = null;
        }
        if (version != _sourceVersion) return;
        ReleaseUnusedReaders();
        if (reader?.Info is not { FrameCount: > 0 } info)
        {
            SetStatus(() => T(I18nKeys.YoloTaskSetExtractLoadFailed));
            RenderFrameInfo();
            return;
        }
        if (_sourceIsVideo)
        {
            _video = info;
            _rendering = true;
            SldFrame.Maximum = info.FrameCount - 1;
            SldFrame.Value = 0;
            _rendering = false;
            TxtFixedFrom.Text = N(0);
            TxtFixedTo.Text = N(info.FrameCount - 1);
            PanelVideo.Visibility = Visibility.Visible;
        }
        UpdateEnabled();
        await LoadFrameAsync(fit: true);
    }

    private void StepFrame(int delta)
    {
        if (_video == null) return;
        SetFrame(_frame + delta);
        OnFrameChanged();
    }

    private void SetFrame(int frame)
    {
        _frame = Math.Clamp(frame, 0, Math.Max(0, (_video?.FrameCount ?? 1) - 1));
        _rendering = true;
        SldFrame.Value = _frame;
        _rendering = false;
    }

    private void OnFrameChanged()
    {
        _imageLoaded = false;
        RenderFrameInfo();
        RenderBoxes(-1);
        _frameTimer.Stop();
        _frameTimer.Start();
    }

    private async Task GoToFrameAsync(int frame)
    {
        _frameTimer.Stop();
        SetFrame(frame);
        _imageLoaded = false;
        RenderFrameInfo();
        await LoadFrameAsync(fit: false);
    }

    private async Task LoadFrameAsync(bool fit)
    {
        if (_sourcePath is not { } path || !_readers.TryGetValue(path, out var reader)) return;
        int version = ++_loadVersion;
        int frame = _frame;
        BitmapSource? image;
        try
        {
            image = await Task.Run(() =>
            {
                using var bgra = reader.ReadBgra(frame);
                return bgra == null ? null : BitmapDecode.FromMat(bgra);
            });
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            image = null;
        }
        if (version != _loadVersion) return;
        _imageLoaded = image != null;
        if (image == null)
        {
            Canvas.ImageSource = null;
            SetStatus(() => T(I18nKeys.YoloTaskSetExtractLoadFailed));
        }
        else
        {
            Canvas.FitOnOpen = fit;
            Canvas.ImageSource = image;
            if (_workCts == null) SetStatus(() => "");
        }
        RenderBoxes(-1);
        RenderFrameInfo();
    }

    private void RenderFrameInfo()
    {
        if (_video is { } v)
        {
            var time = v.Fps > 0 ? TimeSpan.FromSeconds(_frame / v.Fps).ToString(TimeFormat, CultureInfo.InvariantCulture) : "-";
            TxtFrameInfo.Text = T(I18nKeys.YoloTaskSetExtractFrameInfo)
                .Replace("{frame}", N(_frame))
                .Replace("{total}", N(v.FrameCount - 1))
                .Replace("{time}", time)
                .Replace("{width}", N(v.Width))
                .Replace("{height}", N(v.Height));
        }
        else if (Canvas.ImageSource is { } img)
        {
            TxtFrameInfo.Text = T(I18nKeys.YoloTaskSetExtractImageInfo)
                .Replace("{width}", N(img.PixelWidth))
                .Replace("{height}", N(img.PixelHeight));
        }
        else
        {
            TxtFrameInfo.Text = "";
        }
    }

    // ---------- selection ----------

    private void RenderBoxes(int select)
    {
        _frameCrops.Clear();
        _boxes.Clear();
        if (_imageLoaded && _sourcePath != null)
        {
            var label = DestinationName;
            foreach (var crop in _crops.Where(c => PathEquals(c.SourcePath, _sourcePath) && (!c.IsVideo || c.Frame == _frame)))
            {
                _frameCrops.Add(crop);
                var r = crop.Region;
                _boxes.Add(new AnnotationBox(label, r.X, r.Y, r.X + r.Width, r.Y + r.Height));
            }
        }
        Canvas.SelectedIndex = select < _boxes.Count ? select : -1;
        Canvas.Refresh();
        SyncSelectionFromCanvas();
    }

    private ExtractCrop? SelectedFrameCrop() =>
        Canvas.SelectedIndex >= 0 && Canvas.SelectedIndex < _frameCrops.Count ? _frameCrops[Canvas.SelectedIndex] : null;

    /// <summary>Crops selected in the pending list (kept in sync with the canvas selection).</summary>
    private List<ExtractCrop> SelectedCrops()
    {
        var list = LstCrops.SelectedItems.OfType<ExtractCrop>().ToList();
        if (list.Count == 0 && SelectedFrameCrop() is { } crop) list.Add(crop);
        return list;
    }

    private List<ExtractCrop> FilmCrops() => _film.OfType<ExtractCrop>().ToList();

    private void SyncSelectionFromCanvas()
    {
        if (_syncing) return;
        _syncing = true;
        try
        {
            var crop = SelectedFrameCrop();
            if (crop != null)
            {
                if (!LstCrops.SelectedItems.Contains(crop))
                {
                    LstCrops.SelectedItems.Clear();
                    LstCrops.SelectedItems.Add(crop);
                }
                LstCrops.ScrollIntoView(crop);
                LstFilm.SelectedItem = crop;
                LstFilm.ScrollIntoView(crop);
                SyncModeControls(crop);
            }
            Canvas.Strokes = crop?.Strokes.ToList();
        }
        finally
        {
            _syncing = false;
        }
    }

    private void OnListSelectionChanged()
    {
        if (_syncing) return;
        var selected = LstCrops.SelectedItems.OfType<ExtractCrop>().ToList();
        if (selected.Count == 1) _ = NavigateToAsync(selected[0]);
        else if (selected.Count > 1) SyncModeControls(selected[0]);
    }

    private async Task NavigateToAsync(ExtractCrop crop)
    {
        if (!PathEquals(crop.SourcePath, _sourcePath)) await SelectSourceAsync(crop.SourcePath);
        if (crop.IsVideo && (crop.Frame != _frame || !_imageLoaded)) await GoToFrameAsync(crop.Frame);
        int index = _frameCrops.IndexOf(crop);
        if (index < 0) return;
        RenderBoxes(index);
        Canvas.BringIntoView(_boxes[index]);
    }

    // ---------- cutout mode and brush ----------

    private void SyncModeControls(ExtractCrop crop)
    {
        _rendering = true;
        (crop.Mode switch
        {
            VariantCutout.GrabCut => RadioGrabCut,
            VariantCutout.ColorKey => RadioColorKey,
            _ => RadioRectangle,
        }).IsChecked = true;
        SldTolerance.Value = crop.Tolerance;
        ChkHoles.IsChecked = crop.Holes;
        _rendering = false;
        UpdateModePanel();
    }

    private void UpdateModePanel() => PanelTolerance.Visibility = Mode == VariantCutout.ColorKey ? Visibility.Visible : Visibility.Collapsed;

    private void OnModeChosen()
    {
        UpdateModePanel();
        if (_rendering) return;
        var mode = Mode;
        var targets = SelectedCrops().Where(c => c.Mode != mode).ToList();
        if (targets.Count == 0) return;
        PushHistory();
        foreach (var crop in targets) crop.Mode = mode;
        foreach (var crop in targets) _ = CutAsync(crop);
    }

    private void ApplyToleranceToSelection()
    {
        int tolerance = Tolerance;
        var targets = SelectedCrops().Where(c => c.Mode == VariantCutout.ColorKey && c.Tolerance != tolerance).ToList();
        if (targets.Count == 0) return;
        PushHistory();
        foreach (var crop in targets) crop.Tolerance = tolerance;
        foreach (var crop in targets) _ = CutAsync(crop);
    }

    private void ApplyHolesToSelection()
    {
        if (_rendering) return;
        bool holes = Holes;
        var targets = SelectedCrops().Where(c => c.Mode == VariantCutout.ColorKey && c.Holes != holes).ToList();
        if (targets.Count == 0) return;
        PushHistory();
        foreach (var crop in targets) crop.Holes = holes;
        foreach (var crop in targets) _ = CutAsync(crop);
    }

    private void OnStrokeDrawn(CanvasStroke stroke)
    {
        var crop = SelectedFrameCrop() ?? _frameCrops.LastOrDefault(c => Contains(c.Region, stroke.Points[0]));
        if (crop == null)
        {
            SetStatus(() => T(I18nKeys.VariantExtractBrushNeedCrop));
            return;
        }
        PushHistory();
        crop.Strokes = crop.Strokes.Append(stroke).ToList();
        if (crop.Mode == VariantCutout.Rectangle && stroke.Kind != CanvasStrokeKind.Erase) crop.Mode = VariantCutout.GrabCut;
        RenderBoxes(_frameCrops.IndexOf(crop));
        _ = CutAsync(crop);
    }

    private static bool Contains(VariantRegion r, Point p) => p.X >= r.X && p.Y >= r.Y && p.X <= r.X + r.Width && p.Y <= r.Y + r.Height;

    // ---------- crops ----------

    private VariantRegion? ToRegion(AnnotationBox box)
    {
        if (Canvas.ImageSource is not { } img) return null;
        int x0 = (int)Math.Floor(Math.Clamp(box.XMin, 0, img.PixelWidth));
        int y0 = (int)Math.Floor(Math.Clamp(box.YMin, 0, img.PixelHeight));
        int x1 = (int)Math.Ceiling(Math.Clamp(box.XMax, 0, img.PixelWidth));
        int y1 = (int)Math.Ceiling(Math.Clamp(box.YMax, 0, img.PixelHeight));
        return x1 - x0 < MinRegionSide || y1 - y0 < MinRegionSide ? null : new VariantRegion(x0, y0, x1 - x0, y1 - y0);
    }

    private ExtractCrop AddCrop(int frame, VariantRegion region, VariantCutout mode, int tolerance, bool holes, double? confidence = null,
        TaskResource? replaces = null)
    {
        var crop = new ExtractCrop(_sourcePath!, _sourceIsVideo, _sourceIsVideo ? frame : 0, region, mode, tolerance)
        {
            Holes = holes,
            Confidence = confidence,
            Replaces = replaces,
            PixelScale = replaces?.PixelScale ?? _sourcePixelScale,
        };
        _crops.Add(crop);
        DescribeCrop(crop);
        return crop;
    }

    private void OnBoxDrawn(AnnotationBox box)
    {
        if (!_imageLoaded || _sourcePath == null || ToRegion(box) is not { } region) return;
        PushHistory();
        var crop = AddCrop(_frame, region, Mode, Tolerance, Holes);
        RenderBoxes(_frameCrops.Count);
        _ = CutAsync(crop);
    }

    private void OnBoxEdited(int index, AnnotationBox box)
    {
        if (index < 0 || index >= _frameCrops.Count || ToRegion(box) is not { } region) return;
        var crop = _frameCrops[index];
        PushHistory();
        crop.Region = region;
        DescribeCrop(crop);
        RenderBoxes(index);
        _ = CutAsync(crop);
    }

    private void RemoveCrop_Click(object sender, RoutedEventArgs e)
    {
        if ((sender as FrameworkElement)?.Tag is ExtractCrop crop) RemoveCrops(new[] { crop });
    }

    private void RemoveCrops(IReadOnlyCollection<ExtractCrop> crops)
    {
        if (crops.Count == 0 || _adding) return;
        PushHistory();
        foreach (var crop in crops) _crops.Remove(crop);
        RenderBoxes(-1);
        ReleaseUnusedReaders();
    }

    private void SetChecked(IEnumerable<ExtractCrop> crops, bool value)
    {
        var changed = crops.Where(c => c.IsChecked != value).ToList();
        if (changed.Count == 0) return;
        PushHistory();
        foreach (var crop in changed) crop.IsChecked = value;
    }

    // ---------- undo ----------

    private List<CropState> Snapshot() => _crops.Select(c => c.Snapshot()).ToList();

    private void PushHistory()
    {
        _history.Push(Snapshot());
        UpdateEnabled();
    }

    private void Undo()
    {
        if (_adding || _workCts != null) return;
        if (_history.Undo(Snapshot()) is { } states) Restore(states);
    }

    private void Redo()
    {
        if (_adding || _workCts != null) return;
        if (_history.Redo(Snapshot()) is { } states) Restore(states);
    }

    private void Restore(List<CropState> states)
    {
        var recut = states.Where(s => s.NeedsRecut).Select(s => s.Crop).ToList();
        foreach (var state in states) state.Restore();
        _crops.Clear();
        foreach (var state in states) _crops.Add(state.Crop);
        foreach (var crop in _crops) DescribeCrop(crop);
        RenderBoxes(-1);
        foreach (var crop in recut) _ = CutAsync(crop);
        UpdateEnabled();
    }

    // ---------- cutting ----------

    private sealed record CutResult(byte[] Png, ulong Hash, BitmapSource Thumbnail);

    /// <summary>Cut in the background (at most CutConcurrency at once); stale results are dropped by version.</summary>
    private async Task CutAsync(ExtractCrop crop, CancellationToken ct = default)
    {
        int version = ++crop.Version;
        var (path, frame, region, mode, tolerance, holes, strokes) = (crop.SourcePath, crop.Frame, crop.Region, crop.Mode, crop.Tolerance, crop.Holes, crop.Strokes);
        crop.Png = null;
        crop.Hash = null;
        crop.Failed = false;
        DescribeCrop(crop);
        CutResult? result = null;
        bool entered = false;
        try
        {
            var reader = await GetReaderAsync(path);
            await _cutGate.WaitAsync(ct);
            entered = true;
            if (reader != null && version == crop.Version)
                result = await Task.Run(() => CutCore(reader, frame, region, mode, tolerance, holes, strokes), ct);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            result = null;
        }
        finally
        {
            if (entered) _cutGate.Release();
        }
        if (version != crop.Version) return;
        crop.Png = result?.Png;
        crop.Hash = result?.Hash;
        crop.Thumbnail = result?.Thumbnail;
        crop.Failed = result == null;
        DescribeCrop(crop);
    }

    private static CutResult? CutCore(VideoFrameReader reader, int frame, VariantRegion region, VariantCutout mode, int tolerance, bool holes,
        IReadOnlyList<CanvasStroke> strokes)
    {
        using var image = reader.ReadBgra(frame);
        if (image == null) return null;
        using var mask = strokes.Count == 0 ? null : CanvasStrokeRaster.Render(strokes, image.Width, image.Height,
            VariantMaskHints.MaskForeground, VariantMaskHints.MaskBackground, VariantMaskHints.MaskUnknown);
        var hints = mask == null ? null : new VariantMaskHints(Array.Empty<VariantStroke>(), mask);
        var png = VariantExtractor.Cut(image, region, mode, new VariantCutOptions(tolerance, hints, holes));
        if (png == null || VariantExtractor.PerceptualHash(png) is not { } hash) return null;
        return new CutResult(png, hash, BitmapDecode.FromBytes(png, region.Width > ThumbnailSide ? ThumbnailSide : 0));
    }

    private static void DescribeCrop(ExtractCrop crop)
    {
        var r = crop.Region;
        crop.Caption = T(crop.IsVideo ? I18nKeys.YoloTaskSetExtractPendingVideo : I18nKeys.YoloTaskSetExtractPendingImage)
            .Replace("{source}", Path.GetFileName(crop.SourcePath))
            .Replace("{frame}", N(crop.Frame))
            .Replace("{width}", N(r.Width))
            .Replace("{height}", N(r.Height));
        var confidence = crop.Confidence is { } c
            ? T(I18nKeys.VariantExtractConfidence).Replace("{value}", c.ToString(ConfidenceFormat, CultureInfo.InvariantCulture))
            : "";
        var lines = new List<string>();
        if (crop.Failed) lines.Add(T(I18nKeys.YoloTaskSetExtractCutFailed));
        else if (crop.Png == null) lines.Add(T(I18nKeys.YoloTaskSetExtractCutting));
        if (confidence.Length > 0) lines.Add(confidence);
        if (crop.Replaces is { } replaced) lines.Add(T(I18nKeys.VariantExtractReplaces).Replace("{name}", Path.GetFileName(replaced.File)));
        crop.Info = string.Join(Environment.NewLine, lines);
        var tag = crop.IsVideo ? T(I18nKeys.VariantExtractFrameTag).Replace("{frame}", N(crop.Frame)) : "";
        crop.FilmText = string.Join(" ", new[] { tag, confidence }.Where(s => s.Length > 0));
    }

    // ---------- tracking / fixed box ----------

    private static bool TryReadInt(TextBox box, int min, out int value) =>
        int.TryParse(box.Text.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value) && value >= min;

    /// <summary>The selected box on the shown video frame, or null (with a status hint).</summary>
    private ExtractCrop? SeriesStart()
    {
        if (SelectedFrameCrop() is { IsVideo: true } start && _video != null) return start;
        SetStatus(() => T(I18nKeys.VariantExtractNeedVideoCrop));
        return null;
    }

    private CancellationTokenSource BeginWork()
    {
        var cts = new CancellationTokenSource();
        _workCts = cts;
        PrgTrack.Value = 0;
        PanelProgress.Visibility = Visibility.Visible;
        UpdateEnabled();
        return cts;
    }

    private void EndWork(CancellationTokenSource cts)
    {
        if (ReferenceEquals(_workCts, cts)) _workCts = null;
        cts.Dispose();
        PanelProgress.Visibility = Visibility.Collapsed;
        UpdateEnabled();
    }

    private void ReportProgress(int done, int total, string key)
    {
        PrgTrack.Value = total > 0 ? Math.Clamp((double)done / total, 0, 1) : 0;
        SetStatus(() => T(key).Replace("{done}", N(done)).Replace("{total}", N(total)));
    }

    private async Task TrackAsync(TrackDirection direction)
    {
        if (_workCts != null || SeriesStart() is not { } start) return;
        if (!TryReadInt(TxtStep, 1, out int step) || !TryReadInt(TxtCount, 1, out int count))
        {
            SetStatus(() => T(I18nKeys.VariantExtractInvalidNumber));
            return;
        }
        var cts = BeginWork();
        try
        {
            var reader = await GetReaderAsync(start.SourcePath);
            if (reader == null) return;
            var progress = new Progress<WorkProgress>(p => ReportProgress(Math.Max(0, p.Done - 1), count, I18nKeys.VariantExtractTracking));
            ReportProgress(0, count, I18nKeys.VariantExtractTracking);
            var (frame, region, token) = (start.Frame, start.Region, cts.Token);
            var result = await Task.Run(() => VariantExtractor.Track(reader, frame, region, step, count + 1, direction, token, progress), token);
            var regions = result.Regions.Where(r => r.FrameIndex != start.Frame).ToList();
            var (added, duplicates) = await AddSeriesAsync(start, regions, withConfidence: true, cts.Token);
            var done = T(I18nKeys.VariantExtractTrackDone).Replace("{count}", N(added)).Replace("{duplicates}", N(duplicates));
            var lost = result.Lost
                ? Environment.NewLine + T(I18nKeys.VariantExtractTrackLost).Replace("{frame}", N(regions.Count > 0 ? regions[^1].FrameIndex : start.Frame))
                : "";
            SetStatus(() => done + lost);
        }
        catch (OperationCanceledException)
        {
            SetStatus(() => T(I18nKeys.VariantExtractCancelled));
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            var message = TaskSetUiErrors.Describe(ex);
            SetStatus(() => message);
        }
        finally
        {
            EndWork(cts);
        }
    }

    private async Task FixedBoxAsync()
    {
        if (_workCts != null || SeriesStart() is not { } start || _video is not { } video) return;
        if (!TryReadInt(TxtFixedFrom, 0, out int from) || !TryReadInt(TxtFixedTo, 0, out int to) || !TryReadInt(TxtFixedEvery, 1, out int every))
        {
            SetStatus(() => T(I18nKeys.VariantExtractInvalidNumber));
            return;
        }
        var regions = VariantExtractor.FixedBox(start.Region, from, to, every, video.FrameCount).Where(r => r.FrameIndex != start.Frame).ToList();
        var cts = BeginWork();
        try
        {
            var (added, duplicates) = await AddSeriesAsync(start, regions, withConfidence: false, cts.Token);
            SetStatus(() => T(I18nKeys.VariantExtractFixedDone).Replace("{count}", N(added)).Replace("{duplicates}", N(duplicates)));
        }
        catch (OperationCanceledException)
        {
            SetStatus(() => T(I18nKeys.VariantExtractCancelled));
        }
        finally
        {
            EndWork(cts);
        }
    }

    /// <summary>Pending crops for the regions (same mode as the start crop), cut with progress, then near duplicates unchecked.</summary>
    private async Task<(int Added, int Duplicates)> AddSeriesAsync(ExtractCrop start, IReadOnlyList<TrackedRegion> regions, bool withConfidence, CancellationToken ct)
    {
        var fresh = regions
            .Where(r => !_crops.Any(c => PathEquals(c.SourcePath, start.SourcePath) && c.Frame == r.FrameIndex && c.Region == r.Region))
            .ToList();
        if (fresh.Count == 0) return (0, 0);
        PushHistory();
        var created = fresh.Select(r => AddCrop(r.FrameIndex, r.Region, start.Mode, start.Tolerance, start.Holes, withConfidence ? r.Confidence : null)).ToList();
        RenderBoxes(_frameCrops.IndexOf(start));
        int done = 0;
        ReportProgress(0, created.Count, I18nKeys.VariantExtractCutting);
        await Task.WhenAll(created.Select(async crop =>
        {
            await CutAsync(crop, ct);
            ReportProgress(++done, created.Count, I18nKeys.VariantExtractCutting);
        }));
        ct.ThrowIfCancellationRequested();
        int duplicates = ChkDedupe.IsChecked == true ? UncheckDuplicates(new[] { start }.Concat(created).ToList()) : 0;
        return (created.Count, duplicates);
    }

    /// <summary>Uncheck checked crops whose dHash is closer than the dedupe distance to an earlier kept crop; returns how many.</summary>
    private int UncheckDuplicates(IReadOnlyList<ExtractCrop> ordered)
    {
        int distance = TryReadInt(TxtDedupe, 0, out int d) ? d : VariantExtractor.DefaultDedupeDistance;
        var hashed = ordered.Where(c => c.IsChecked && c.Hash != null).ToList();
        var kept = VariantExtractor.Dedupe(hashed.Select(c => c.Hash!.Value).ToList(), distance).ToHashSet();
        int count = 0;
        for (int i = 0; i < hashed.Count; i++)
        {
            if (kept.Contains(i)) continue;
            hashed[i].IsChecked = false;
            count++;
        }
        return count;
    }

    private void DedupeFilm()
    {
        PushHistory();
        int count = UncheckDuplicates(FilmCrops());
        SetStatus(() => T(I18nKeys.VariantExtractDedupeDone).Replace("{count}", N(count)));
    }

    // ---------- edit stored variant ----------

    private async Task EditVariantAsync(TaskTarget target, TaskResource variant)
    {
        RefreshTargets(target);
        Activate();
        var stored = _store.ResourcePath(_set, variant);
        bool fromSource = VariantExtractor.TryParseSourceRef(variant.OriginalPath, out var sourcePath, out var frame, out var region)
            && region.Width > 0 && region.Height > 0 && File.Exists(sourcePath);
        VariantCutout mode;
        int tolerance = Tolerance;
        if (fromSource)
        {
            bool transparent = await Task.Run(() => VariantExtractor.InspectAlpha(stored)?.HasTransparency == true);
            mode = transparent ? VariantCutout.GrabCut : VariantCutout.Rectangle;
        }
        else
        {
            sourcePath = stored;
            frame = null;
            mode = VariantCutout.ColorKey;
            tolerance = EditSourceMissingTolerance;
        }
        await SelectSourceAsync(sourcePath);
        if (!PathEquals(_sourcePath, Path.GetFullPath(sourcePath))) return;
        if (_video != null && frame is { } f && f != _frame) await GoToFrameAsync(f);
        if (!_imageLoaded || Canvas.ImageSource is not { } image) return;
        if (!fromSource) region = new VariantRegion(0, 0, image.PixelWidth, image.PixelHeight);
        PushHistory();
        var crop = AddCrop(_frame, region, mode, tolerance, Holes, replaces: variant);
        RenderBoxes(_frameCrops.IndexOf(crop));
        _ = CutAsync(crop);
        var name = Path.GetFileName(variant.File);
        SetStatus(() => (fromSource ? "" : T(I18nKeys.VariantExtractEditSourceMissing) + Environment.NewLine)
            + T(I18nKeys.VariantExtractEditing).Replace("{name}", name));
    }

    // ---------- add ----------

    /// <summary>Add the checked crops to the selected target; true when the owner accepted all of them.</summary>
    private async Task<bool> AddAsync()
    {
        if (_adding || _addBlocked || _workCts != null) return false;
        var target = SelectedTarget;
        var addDistractors = DistractorsSelected ? _addDistractors : null;
        if (target == null && addDistractors == null)
        {
            MessageBox.Show(this, T(I18nKeys.YoloTaskSetExtractNoTarget), Title, MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        var crops = _crops.Where(c => c.IsChecked).ToList();
        if (crops.Count == 0)
        {
            MessageBox.Show(this, T(I18nKeys.YoloTaskSetExtractNothingToAdd), Title, MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        _adding = true;
        UpdateEnabled();
        try
        {
            var readers = new Dictionary<ExtractCrop, VideoFrameReader?>();
            foreach (var crop in crops.Where(c => c.Png == null)) readers[crop] = await GetReaderAsync(crop.SourcePath);
            var variants = await Task.Run(() => crops
                .Select(c => (Crop: c, Png: c.Png ?? (readers.GetValueOrDefault(c) is { } r ? CutCore(r, c.Frame, c.Region, c.Mode, c.Tolerance, c.Holes, c.Strokes)?.Png : null)))
                .Where(x => x.Png != null)
                .Select(x => (x.Crop, Variant: new ExtractedVariant(x.Png!, OriginalPathOf(x.Crop), NameHintOf(x.Crop), x.Crop.Replaces, x.Crop.PixelScale)))
                .ToList());
            if (variants.Count == 0)
            {
                MessageBox.Show(this, T(I18nKeys.YoloTaskSetExtractNothingToAdd), Title, MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            var list = variants.Select(v => v.Variant).ToList();
            int added = target != null ? await _addVariants(target, list) : await addDistractors!(list.Select(v => v with { Replaces = null }).ToList());
            foreach (var (crop, _) in variants.Take(added)) _crops.Remove(crop);
            _history.Reset();
            var name = target?.Name ?? T(I18nKeys.VariantExtractDistractorPool);
            SetStatus(() => T(I18nKeys.YoloTaskSetExtractAdded).Replace("{count}", N(added)).Replace("{target}", name));
            RenderBoxes(-1);
            ReleaseUnusedReaders();
            return added == crops.Count;
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            MessageBox.Show(this, TaskSetUiErrors.Describe(ex), Title, MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
        finally
        {
            _adding = false;
            UpdateEnabled();
        }
    }

    private static string OriginalPathOf(ExtractCrop c) => VariantExtractor.FormatSourceRef(c.SourcePath, c.IsVideo ? c.Frame : null, c.Region);

    private static string NameHintOf(ExtractCrop c)
    {
        var stem = Path.GetFileNameWithoutExtension(c.SourcePath);
        return c.IsVideo ? string.Create(CultureInfo.InvariantCulture, $"{stem}_f{c.Frame}") : stem;
    }

    /// <summary>Destination entry; Target null = the distractor pool.</summary>
    private sealed record TargetItem(string Display, TaskTarget? Target);

    private sealed record SourceItem(string Display, string Path);
}
