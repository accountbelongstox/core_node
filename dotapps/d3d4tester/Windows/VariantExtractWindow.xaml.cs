// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotCore.Common;
using DotCore.VocAnnotator;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>Variant cut from a source image or video frame, ready for TaskSetStore.AddVariantFromPng.</summary>
public sealed record ExtractedVariant(byte[] Png, string OriginalPath, string NameHint);

/// <summary>
/// Extracts variants ("1.x") from large images or video frames: pick a source (target scenes, common resources or any file),
/// draw rectangles on the frame, preview the cut (rectangle or GrabCut) and add the crops to a target through the owner's callback.
/// </summary>
public partial class VariantExtractWindow : Window
{
    private const int FrameDebounceMs = 150;
    private const int FrameBigStep = 10;
    private const int MinRegionSide = 2;
    private const string TimeFormat = @"hh\:mm\:ss\.fff";

    private readonly TaskSet _set;
    private readonly TaskSetStore _store;
    private readonly Func<TaskTarget, IReadOnlyList<ExtractedVariant>, Task<int>> _addVariants;
    private readonly ObservableCollection<ExtractCropRow> _crops = new();
    private readonly ObservableCollection<AnnotationBox> _boxes = new();
    private readonly List<ExtractCropRow> _frameCrops = new();
    private readonly List<string> _externalSources = new();
    private readonly DispatcherTimer _frameTimer;
    private string? _sourcePath;
    private bool _sourceIsVideo;
    private VideoInfo? _video;
    private int _frame;
    private int _sourceVersion;
    private int _loadVersion;
    private bool _imageLoaded;
    private bool _rendering;
    private bool _adding;
    private Func<string> _status = () => "";

    public VariantExtractWindow(TaskSet set, TaskSetStore store, Func<TaskTarget, IReadOnlyList<ExtractedVariant>, Task<int>> addVariants)
    {
        _set = set;
        _store = store;
        _addVariants = addVariants;
        InitializeComponent();
        _frameTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(FrameDebounceMs) };
        _frameTimer.Tick += async (_, _) =>
        {
            _frameTimer.Stop();
            await LoadFrameAsync(fit: false);
        };
        LstCrops.ItemsSource = _crops;
        Canvas.Boxes = _boxes;
        ApplyTexts();
        BindEvents();
        PanelVideo.Visibility = Visibility.Collapsed;
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        Closed += (_, _) => D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private VariantCutout Mode => RadioGrabCut.IsChecked == true ? VariantCutout.GrabCut : VariantCutout.Rectangle;

    private TaskTarget? SelectedTarget => (CboTarget.SelectedItem as TargetItem)?.Target;

    /// <summary>Select the target and optionally a source (resource or external file) to extract from.</summary>
    public void Open(TaskTarget? target, string? sourcePath)
    {
        RefreshTargets(target);
        if (sourcePath != null) SelectSource(sourcePath);
        Activate();
    }

    /// <summary>Rebuild targets and sources after the owner changed the task set.</summary>
    public void RefreshTargets(TaskTarget? select = null)
    {
        select ??= SelectedTarget;
        _rendering = true;
        var items = _set.Targets.Select((t, i) => new TargetItem($"{i + 1}. {t.Name}", t)).ToList();
        CboTarget.ItemsSource = items;
        CboTarget.SelectedItem = items.FirstOrDefault(i => ReferenceEquals(i.Target, select)) ?? items.FirstOrDefault();
        _rendering = false;
        RebuildSources();
        UpdateEnabled();
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        RebuildSources();
        foreach (var crop in _crops) DescribeCrop(crop);
        RenderFrameInfo();
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
        LblPending.Text = T(I18nKeys.YoloTaskSetExtractSectionPending);
        BtnAdd.Content = T(I18nKeys.YoloTaskSetExtractAdd);
        BtnClear.Content = T(I18nKeys.YoloTaskSetExtractClear);
        BtnFit.Content = T(I18nKeys.YoloTaskSetExtractFit);
        TxtHint.Text = T(I18nKeys.YoloTaskSetExtractViewerHint);
        BtnFrameBack.ToolTip = T(I18nKeys.YoloTaskSetExtractFrameBack);
        BtnFramePrev.ToolTip = T(I18nKeys.YoloTaskSetExtractFramePrev);
        BtnFrameNext.ToolTip = T(I18nKeys.YoloTaskSetExtractFrameNext);
        BtnFrameForward.ToolTip = T(I18nKeys.YoloTaskSetExtractFrameForward);
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
            if (!_rendering && CboSource.SelectedItem is SourceItem item && item.Path != _sourcePath) await LoadSourceAsync(item.Path);
        };
        BtnBrowse.Click += (_, _) => Browse();
        RadioRectangle.Checked += (_, _) => RecutAll();
        RadioGrabCut.Checked += (_, _) => RecutAll();
        BtnAdd.Click += async (_, _) => await AddAsync();
        BtnClear.Click += (_, _) =>
        {
            _crops.Clear();
            RenderBoxes(-1);
            UpdateEnabled();
        };
        BtnFit.Click += (_, _) => Canvas.FitToView();
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
        Canvas.BoxDrawn += (_, box) => OnBoxDrawn(box);
        Canvas.BoxEdited += (_, e) => OnBoxEdited(e.Index, e.Box);
        Canvas.PreviewMouseDown += (_, _) => Canvas.Focus();
        Canvas.KeyDown += (_, e) =>
        {
            if (e.Key == Key.F)
            {
                Canvas.FitToView();
                e.Handled = true;
            }
            else if (e.Key == Key.Delete && Canvas.SelectedIndex >= 0 && Canvas.SelectedIndex < _frameCrops.Count)
            {
                RemoveCrop(_frameCrops[Canvas.SelectedIndex]);
                e.Handled = true;
            }
        };
    }

    private void UpdateEnabled()
    {
        BtnAdd.IsEnabled = !_adding && _crops.Count > 0 && SelectedTarget != null;
        BtnClear.IsEnabled = !_adding && _crops.Count > 0;
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

    private void SelectSource(string path)
    {
        var full = Path.GetFullPath(path);
        if (CboSource.ItemsSource is not IEnumerable<SourceItem> items || !items.Any(i => PathEquals(i.Path, full)))
        {
            _externalSources.Add(full);
            RebuildSources();
        }
        var item = ((IEnumerable<SourceItem>)CboSource.ItemsSource).First(i => PathEquals(i.Path, full));
        if (ReferenceEquals(CboSource.SelectedItem, item)) return;
        CboSource.SelectedItem = item;
    }

    private static bool PathEquals(string? a, string? b) => a != null && b != null && string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private void Browse()
    {
        var images = string.Join(";", TaskSetStore.ImageExtensions.Select(e => "*" + e));
        var videos = string.Join(";", TaskSetStore.VideoExtensions.Select(e => "*" + e));
        var dlg = new Microsoft.Win32.OpenFileDialog
        {
            Filter = $"{T(I18nKeys.YoloTaskSetMediaFilter)}|{images};{videos}|{T(I18nKeys.YoloTaskSetImageFilter)}|{images}",
        };
        if (dlg.ShowDialog(this) == true) SelectSource(dlg.FileName);
    }

    private async Task LoadSourceAsync(string path)
    {
        int version = ++_sourceVersion;
        _sourcePath = path;
        _sourceIsVideo = VariantExtractor.IsVideo(path);
        _video = null;
        _frame = 0;
        _imageLoaded = false;
        Canvas.ImageSource = null;
        PanelVideo.Visibility = Visibility.Collapsed;
        RenderBoxes(-1);
        SetStatus(() => T(I18nKeys.YoloTaskSetExtractLoading));
        if (_sourceIsVideo)
        {
            var info = await Task.Run(() => VariantExtractor.GetVideoInfo(path));
            if (version != _sourceVersion) return;
            if (info is not { FrameCount: > 0 })
            {
                SetStatus(() => T(I18nKeys.YoloTaskSetExtractLoadFailed));
                RenderFrameInfo();
                return;
            }
            _video = info;
            _rendering = true;
            SldFrame.Maximum = info.FrameCount - 1;
            SldFrame.Value = 0;
            _rendering = false;
            PanelVideo.Visibility = Visibility.Visible;
        }
        await LoadFrameAsync(fit: true);
    }

    private void StepFrame(int delta)
    {
        if (_video == null) return;
        _frame = Math.Clamp(_frame + delta, 0, _video.FrameCount - 1);
        _rendering = true;
        SldFrame.Value = _frame;
        _rendering = false;
        OnFrameChanged();
    }

    private void OnFrameChanged()
    {
        _imageLoaded = false;
        RenderFrameInfo();
        RenderBoxes(-1);
        _frameTimer.Stop();
        _frameTimer.Start();
    }

    private async Task LoadFrameAsync(bool fit)
    {
        if (_sourcePath is not { } path) return;
        int version = ++_loadVersion;
        int frame = _frame;
        BitmapSource? image;
        try
        {
            image = await Task.Run(() => VariantExtractor.LoadFramePng(path, frame) is { } png ? TaskSetWindow.DecodeBytes(png, 0) : null);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException or InvalidOperationException)
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
            SetStatus(() => "");
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
                .Replace("{frame}", _frame.ToString(CultureInfo.InvariantCulture))
                .Replace("{total}", (v.FrameCount - 1).ToString(CultureInfo.InvariantCulture))
                .Replace("{time}", time)
                .Replace("{width}", v.Width.ToString(CultureInfo.InvariantCulture))
                .Replace("{height}", v.Height.ToString(CultureInfo.InvariantCulture));
        }
        else if (Canvas.ImageSource is { } img)
        {
            TxtFrameInfo.Text = T(I18nKeys.YoloTaskSetExtractImageInfo)
                .Replace("{width}", img.PixelWidth.ToString(CultureInfo.InvariantCulture))
                .Replace("{height}", img.PixelHeight.ToString(CultureInfo.InvariantCulture));
        }
        else
        {
            TxtFrameInfo.Text = "";
        }
    }

    // ---------- crops ----------

    private void RenderBoxes(int select)
    {
        _frameCrops.Clear();
        _boxes.Clear();
        if (_imageLoaded && _sourcePath != null)
        {
            var label = SelectedTarget?.Name ?? "";
            foreach (var crop in _crops.Where(c => PathEquals(c.SourcePath, _sourcePath) && (!c.IsVideo || c.Frame == _frame)))
            {
                _frameCrops.Add(crop);
                var r = crop.Region;
                _boxes.Add(new AnnotationBox(label, r.X, r.Y, r.X + r.Width, r.Y + r.Height));
            }
        }
        Canvas.SelectedIndex = select < _boxes.Count ? select : -1;
        Canvas.Refresh();
    }

    private VariantRegion? ToRegion(AnnotationBox box)
    {
        if (Canvas.ImageSource is not { } img) return null;
        int x0 = (int)Math.Floor(Math.Clamp(box.XMin, 0, img.PixelWidth));
        int y0 = (int)Math.Floor(Math.Clamp(box.YMin, 0, img.PixelHeight));
        int x1 = (int)Math.Ceiling(Math.Clamp(box.XMax, 0, img.PixelWidth));
        int y1 = (int)Math.Ceiling(Math.Clamp(box.YMax, 0, img.PixelHeight));
        return x1 - x0 < MinRegionSide || y1 - y0 < MinRegionSide ? null : new VariantRegion(x0, y0, x1 - x0, y1 - y0);
    }

    private void OnBoxDrawn(AnnotationBox box)
    {
        if (!_imageLoaded || _sourcePath == null || ToRegion(box) is not { } region) return;
        var crop = new ExtractCropRow(_sourcePath, _sourceIsVideo, _sourceIsVideo ? _frame : 0, region);
        _crops.Add(crop);
        RenderBoxes(_frameCrops.Count);
        _ = CutAsync(crop);
        UpdateEnabled();
    }

    private void OnBoxEdited(int index, AnnotationBox box)
    {
        if (index < 0 || index >= _frameCrops.Count) return;
        var crop = _frameCrops[index];
        if (ToRegion(box) is { } region) crop.Region = region;
        RenderBoxes(index);
        _ = CutAsync(crop);
    }

    private void RemoveCrop_Click(object sender, RoutedEventArgs e)
    {
        if ((sender as FrameworkElement)?.Tag is ExtractCropRow crop) RemoveCrop(crop);
    }

    private void RemoveCrop(ExtractCropRow crop)
    {
        _crops.Remove(crop);
        RenderBoxes(-1);
        UpdateEnabled();
    }

    private void RecutAll()
    {
        foreach (var crop in _crops) _ = CutAsync(crop);
    }

    private async Task CutAsync(ExtractCropRow crop)
    {
        int version = ++crop.Version;
        var (path, frame, region, mode) = (crop.SourcePath, crop.Frame, crop.Region, Mode);
        crop.Png = null;
        crop.Failed = false;
        DescribeCrop(crop);
        (byte[]? Png, BitmapSource? Thumb) result;
        try
        {
            result = await Task.Run(() =>
            {
                var png = VariantExtractor.Cut(path, frame, region, mode);
                return (png, png == null ? null : TaskSetWindow.DecodeBytes(png, 0));
            });
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException or InvalidOperationException)
        {
            result = (null, null);
        }
        if (version != crop.Version) return;
        crop.Png = result.Png;
        crop.Thumbnail = result.Thumb;
        crop.Failed = result.Png == null;
        DescribeCrop(crop);
    }

    private static void DescribeCrop(ExtractCropRow crop)
    {
        var r = crop.Region;
        crop.Caption = T(crop.IsVideo ? I18nKeys.YoloTaskSetExtractPendingVideo : I18nKeys.YoloTaskSetExtractPendingImage)
            .Replace("{source}", Path.GetFileName(crop.SourcePath))
            .Replace("{frame}", crop.Frame.ToString(CultureInfo.InvariantCulture))
            .Replace("{width}", r.Width.ToString(CultureInfo.InvariantCulture))
            .Replace("{height}", r.Height.ToString(CultureInfo.InvariantCulture));
        crop.Info = crop.Failed ? T(I18nKeys.YoloTaskSetExtractCutFailed) : crop.Png == null ? T(I18nKeys.YoloTaskSetExtractCutting) : "";
    }

    private async Task AddAsync()
    {
        if (SelectedTarget is not { } target)
        {
            MessageBox.Show(this, T(I18nKeys.YoloTaskSetExtractNoTarget), Title, MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        var crops = _crops.ToList();
        var mode = Mode;
        _adding = true;
        UpdateEnabled();
        try
        {
            var variants = await Task.Run(() => crops
                .Select(c => (Crop: c, Png: c.Png ?? VariantExtractor.Cut(c.SourcePath, c.Frame, c.Region, mode)))
                .Where(x => x.Png != null)
                .Select(x => (x.Crop, Variant: new ExtractedVariant(x.Png!, OriginalPathOf(x.Crop), NameHintOf(x.Crop))))
                .ToList());
            if (variants.Count == 0)
            {
                MessageBox.Show(this, T(I18nKeys.YoloTaskSetExtractNothingToAdd), Title, MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            int added = await _addVariants(target, variants.Select(v => v.Variant).ToList());
            foreach (var (crop, _) in variants.Take(added)) _crops.Remove(crop);
            var name = target.Name;
            SetStatus(() => T(I18nKeys.YoloTaskSetExtractAdded).Replace("{count}", added.ToString(CultureInfo.InvariantCulture)).Replace("{target}", name));
            RenderBoxes(-1);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException or InvalidOperationException)
        {
            MessageBox.Show(this, T(I18nKeys.YoloTaskSetErrorIo).Replace("{message}", ex.Message), Title, MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            _adding = false;
            UpdateEnabled();
        }
    }

    private static string OriginalPathOf(ExtractCropRow c)
    {
        var r = c.Region;
        var region = string.Create(CultureInfo.InvariantCulture, $"@{r.X},{r.Y},{r.Width},{r.Height}");
        return c.IsVideo ? string.Create(CultureInfo.InvariantCulture, $"{c.SourcePath}#frame={c.Frame}{region}") : c.SourcePath + region;
    }

    private static string NameHintOf(ExtractCropRow c)
    {
        var stem = Path.GetFileNameWithoutExtension(c.SourcePath);
        return c.IsVideo ? string.Create(CultureInfo.InvariantCulture, $"{stem}_f{c.Frame}") : stem;
    }

    private sealed record TargetItem(string Display, TaskTarget Target);

    private sealed record SourceItem(string Display, string Path);
}
