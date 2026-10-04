// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotCore.Common;
using DotCore.VocAnnotatorUI;
using DotCore.YoloRecord;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Task-set manager for the specific YOLO training mode (YOLO_TASKSET_SYNTHESIS_DESIGN.md §6): task set CRUD, targets with
/// variants / scenes / augmentation overrides, common resources, global augmentation and synthesis settings, validation,
/// synthetic preview, dataset generation and one-click training. Every store / synthesizer call runs off the UI thread.
/// </summary>
public partial class TaskSetWindow : Window
{
    private const int ThumbDecodeWidth = 96;
    private const int SaveDebounceMs = 400;
    private const int MaxImagesPerTarget = 100_000;
    private const string DatasetStampFormat = "yyyyMMdd_HHmmss";
    private const string AllFilesPattern = "*.*";
    private const string GlyphImage = "";
    private const string GlyphVideo = "";
    private const string GlyphError = "";
    private const string GlyphWarning = "";
    private const string ChipIdle = "StatusChipStyle";
    private const string ChipInfo = "StatusChipInfoStyle";
    private const string ChipSuccess = "StatusChipSuccessStyle";
    private const string ChipWarning = "StatusChipWarningStyle";
    private const string ChipDanger = "StatusChipDangerStyle";

    private static readonly string ImagePatterns = Patterns(TaskSetStore.ImageExtensions);
    private static readonly string VideoPatterns = Patterns(TaskSetStore.VideoExtensions);

    private static readonly IReadOnlyList<AugField> AugFields = new AugField[]
    {
        new(I18nKeys.YoloTaskSetAugScaleMin, FieldKind.Double, p => p.ScaleMin, (p, v) => p.ScaleMin = (double)v, o => o.ScaleMin, (o, v) => o.ScaleMin = (double?)v),
        new(I18nKeys.YoloTaskSetAugScaleMax, FieldKind.Double, p => p.ScaleMax, (p, v) => p.ScaleMax = (double)v, o => o.ScaleMax, (o, v) => o.ScaleMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugStretchMin, FieldKind.Double, p => p.StretchMin, (p, v) => p.StretchMin = (double)v, o => o.StretchMin, (o, v) => o.StretchMin = (double?)v),
        new(I18nKeys.YoloTaskSetAugStretchMax, FieldKind.Double, p => p.StretchMax, (p, v) => p.StretchMax = (double)v, o => o.StretchMax, (o, v) => o.StretchMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugRotationMaxDegrees, FieldKind.Double, p => p.RotationMaxDegrees, (p, v) => p.RotationMaxDegrees = (double)v, o => o.RotationMaxDegrees, (o, v) => o.RotationMaxDegrees = (double?)v),
        new(I18nKeys.YoloTaskSetAugLeftStretchMax, FieldKind.Double, p => p.LeftStretchMax, (p, v) => p.LeftStretchMax = (double)v, o => o.LeftStretchMax, (o, v) => o.LeftStretchMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugRightStretchMax, FieldKind.Double, p => p.RightStretchMax, (p, v) => p.RightStretchMax = (double)v, o => o.RightStretchMax, (o, v) => o.RightStretchMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugFlipHorizontal, FieldKind.Bool, p => p.FlipHorizontal, (p, v) => p.FlipHorizontal = (bool)v, o => o.FlipHorizontal, (o, v) => o.FlipHorizontal = (bool?)v),
        new(I18nKeys.YoloTaskSetAugBrightnessMax, FieldKind.Double, p => p.BrightnessMax, (p, v) => p.BrightnessMax = (double)v, o => o.BrightnessMax, (o, v) => o.BrightnessMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugContrastMax, FieldKind.Double, p => p.ContrastMax, (p, v) => p.ContrastMax = (double)v, o => o.ContrastMax, (o, v) => o.ContrastMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugBlurProbability, FieldKind.Double, p => p.BlurProbability, (p, v) => p.BlurProbability = (double)v, o => o.BlurProbability, (o, v) => o.BlurProbability = (double?)v),
        new(I18nKeys.YoloTaskSetAugBlurMaxKernel, FieldKind.Int, p => p.BlurMaxKernel, (p, v) => p.BlurMaxKernel = (int)v, o => o.BlurMaxKernel, (o, v) => o.BlurMaxKernel = (int?)v),
        new(I18nKeys.YoloTaskSetAugEdgeFeather, FieldKind.Double, p => p.EdgeFeather, (p, v) => p.EdgeFeather = (double)v, o => o.EdgeFeather, (o, v) => o.EdgeFeather = (double?)v),
    };

    private static readonly IReadOnlyList<SynField> SynFields = new SynField[]
    {
        new(I18nKeys.YoloTaskSetSynImagesPerTarget, FieldKind.Int, s => s.ImagesPerTarget, (s, v) => s.ImagesPerTarget = (int)v),
        new(I18nKeys.YoloTaskSetSynValPercent, FieldKind.Int, s => s.ValPercent, (s, v) => s.ValPercent = (int)v),
        new(I18nKeys.YoloTaskSetSynSeed, FieldKind.Int, s => s.Seed, (s, v) => s.Seed = (int)v),
        new(I18nKeys.YoloTaskSetSynMinObjects, FieldKind.Int, s => s.MinObjectsPerImage, (s, v) => s.MinObjectsPerImage = (int)v),
        new(I18nKeys.YoloTaskSetSynMaxObjects, FieldKind.Int, s => s.MaxObjectsPerImage, (s, v) => s.MaxObjectsPerImage = (int)v),
        new(I18nKeys.YoloTaskSetSynCrossTargetProbability, FieldKind.Double, s => s.CrossTargetProbability, (s, v) => s.CrossTargetProbability = (double)v),
        new(I18nKeys.YoloTaskSetSynNegativePercent, FieldKind.Int, s => s.NegativePercent, (s, v) => s.NegativePercent = (int)v),
        new(I18nKeys.YoloTaskSetSynMaxOverlapIou, FieldKind.Double, s => s.MaxOverlapIou, (s, v) => s.MaxOverlapIou = (double)v),
        new(I18nKeys.YoloTaskSetSynMinVisibleFraction, FieldKind.Double, s => s.MinVisibleFraction, (s, v) => s.MinVisibleFraction = (double)v),
        new(I18nKeys.YoloTaskSetSynScaleMode, FieldKind.ScaleMode, s => s.ScaleMode, (s, v) => s.ScaleMode = (string)v),
        new(I18nKeys.YoloTaskSetSynRelativeMin, FieldKind.Double, s => s.RelativeMin, (s, v) => s.RelativeMin = (double)v),
        new(I18nKeys.YoloTaskSetSynRelativeMax, FieldKind.Double, s => s.RelativeMax, (s, v) => s.RelativeMax = (double)v),
        new(I18nKeys.YoloTaskSetSynOutputMaxSide, FieldKind.Int, s => s.OutputMaxSide, (s, v) => s.OutputMaxSide = (int)v),
        new(I18nKeys.YoloTaskSetSynJpegQuality, FieldKind.Int, s => s.JpegQuality, (s, v) => s.JpegQuality = (int)v),
        new(I18nKeys.YoloTaskSetSynVideoFrameInterval, FieldKind.Int, s => s.VideoFrameInterval, (s, v) => s.VideoFrameInterval = (int)v),
        new(I18nKeys.YoloTaskSetSynVideoMaxFrames, FieldKind.Int, s => s.VideoMaxFrames, (s, v) => s.VideoMaxFrames = (int)v),
    };

    private readonly TaskSetStore _store = new(TaskSetStore.DefaultRoot);
    private readonly SemaphoreSlim _storeGate = new(1, 1);
    private readonly DispatcherTimer _saveTimer;
    private readonly ObservableCollection<TaskSetRow> _sets = new();
    private readonly ObservableCollection<TaskTargetRow> _targets = new();
    private readonly ObservableCollection<TaskResourceRow> _variants = new();
    private readonly ObservableCollection<TaskResourceRow> _scenes = new();
    private readonly ObservableCollection<TaskResourceRow> _common = new();
    private readonly List<(TextBlock Text, string Key)> _fieldLabels = new();
    private readonly List<Control> _globalAugEditors = new();
    private readonly List<OverrideRow> _overrideRows = new();
    private readonly List<Control> _synEditors = new();
    private TaskSet? _set;
    private TaskTarget? _target;
    private string? _pendingSelectId;
    private IReadOnlyList<TaskSetIssue>? _issues;
    private PreviewResult? _preview;
    private BitmapSource? _previewImage;
    private int _previewSeed;
    private SynthesisResult? _result;
    private CancellationTokenSource? _generateCts;
    private Task? _generateTask;
    private string _statusStyle = ChipIdle;
    private Func<string> _statusText = () => T(I18nKeys.YoloTaskSetStatusIdle);
    private int _commonVersion;
    private bool _busy;
    private bool _loading;
    private bool _rendering;
    private bool _closeReady;

    public TaskSetWindow()
    {
        InitializeComponent();
        _saveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(SaveDebounceMs) };
        _saveTimer.Tick += async (_, _) => await FlushSaveAsync();
        LstSets.ItemsSource = _sets;
        LstTargets.ItemsSource = _targets;
        LstVariants.ItemsSource = _variants;
        LstScenes.ItemsSource = _scenes;
        LstCommon.ItemsSource = _common;
        BuildGlobalAugEditor();
        BuildOverrideEditor();
        BuildSynthesisEditor();
        ApplyTexts();
        BindEvents();
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        Closed += (_, _) => D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        Loaded += async (_, _) => await ReloadSetsAsync(_pendingSelectId ?? ConfigBinding.GetValue(ConfigKeys.YoloTaskSetLastTaskSet, ""));
    }

    private enum FieldKind { Double, Int, Bool, ScaleMode }

    private enum Pool { Variants, Scenes, Common }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string Patterns(IEnumerable<string> extensions) => string.Join(";", extensions.Select(e => "*" + e));

    /// <summary>Show the single manager window (reused when open), optionally selecting a task set.</summary>
    public static TaskSetWindow ShowSingle(Window? owner, string? taskSetId = null)
    {
        var win = Application.Current.Windows.OfType<TaskSetWindow>().FirstOrDefault();
        if (win == null)
        {
            win = new TaskSetWindow { Owner = owner, _pendingSelectId = taskSetId };
            win.Show();
            return win;
        }
        if (win.WindowState == WindowState.Minimized) win.WindowState = WindowState.Normal;
        win.Activate();
        if (taskSetId != null && win.IsLoaded) _ = win.ReloadSetsAsync(taskSetId);
        return win;
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        if (e.Cancel || _closeReady) return;
        if (_generateCts != null)
        {
            if (MessageBox.Show(this, T(I18nKeys.YoloTaskSetConfirmCloseBusy), Title, MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
            {
                e.Cancel = true;
                return;
            }
            _generateCts.Cancel();
        }
        if (!_saveTimer.IsEnabled && _generateTask == null) return;
        e.Cancel = true;
        _ = CloseAfterPendingAsync();
    }

    private async Task CloseAfterPendingAsync()
    {
        if (_generateTask is { } running) await running;
        await FlushSaveAsync();
        _closeReady = true;
        Close();
    }

    // ---------- texts ----------

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        RenderSetRows();
        RenderTargetRows();
        foreach (var row in _common) DescribeCommon(row);
        RenderGlobalAug();
        RenderOverride();
        RenderSynthesis();
        RenderIssues();
        RenderPreviewInfo();
        RenderResult();
        RenderStatus();
    });

    private void ApplyTexts()
    {
        Title = T(I18nKeys.YoloTaskSetWindowTitle);
        BtnValidate.Content = T(I18nKeys.YoloTaskSetValidate);
        BtnPreview.Content = T(I18nKeys.YoloTaskSetPreview);
        BtnNextSample.Content = T(I18nKeys.YoloTaskSetNextSample);
        BtnGenerate.Content = T(I18nKeys.YoloTaskSetGenerate);
        BtnCancel.Content = T(I18nKeys.YoloTaskSetCancel);
        BtnOpenDataset.Content = T(I18nKeys.YoloTaskSetOpenDataset);
        BtnTrain.Content = T(I18nKeys.YoloTaskSetTrain);
        LblSets.Text = T(I18nKeys.YoloTaskSetSectionSets);
        BtnSetNew.ToolTip = T(I18nKeys.YoloTaskSetSetNew);
        BtnSetRename.ToolTip = T(I18nKeys.YoloTaskSetSetRename);
        BtnSetDuplicate.ToolTip = T(I18nKeys.YoloTaskSetSetDuplicate);
        BtnSetDelete.ToolTip = T(I18nKeys.YoloTaskSetSetDelete);
        LblDescription.Text = T(I18nKeys.YoloTaskSetSetDescription);
        LblTargets.Text = T(I18nKeys.YoloTaskSetSectionTargets);
        BtnTargetAdd.ToolTip = T(I18nKeys.YoloTaskSetTargetAdd);
        BtnTargetRename.ToolTip = T(I18nKeys.YoloTaskSetTargetRename);
        BtnTargetUp.ToolTip = T(I18nKeys.YoloTaskSetTargetUp);
        BtnTargetDown.ToolTip = T(I18nKeys.YoloTaskSetTargetDown);
        BtnTargetDelete.ToolTip = T(I18nKeys.YoloTaskSetTargetDelete);
        LblImagesPerTarget.Text = T(I18nKeys.YoloTaskSetImagesPerTarget);
        ChkIptInherit.Content = T(I18nKeys.YoloTaskSetInheritGlobal);
        TabVariants.Header = T(I18nKeys.YoloTaskSetTabVariants);
        TabScenes.Header = T(I18nKeys.YoloTaskSetTabScenes);
        TabOverride.Header = T(I18nKeys.YoloTaskSetTabAugmentation);
        TxtVariantsHint.Text = T(I18nKeys.YoloTaskSetVariantsHint);
        TxtScenesHint.Text = T(I18nKeys.YoloTaskSetScenesHint);
        TxtCommonHint.Text = T(I18nKeys.YoloTaskSetCommonHint);
        TxtOverrideHint.Text = T(I18nKeys.YoloTaskSetOverrideHint);
        foreach (var b in new[] { BtnVariantAddFiles, BtnSceneAddFiles, BtnCommonAddFiles }) b.Content = T(I18nKeys.YoloTaskSetAddFiles);
        foreach (var b in new[] { BtnVariantAddFolder, BtnSceneAddFolder, BtnCommonAddFolder }) b.Content = T(I18nKeys.YoloTaskSetAddFolder);
        foreach (var b in new[] { BtnVariantRemove, BtnSceneRemove, BtnCommonRemove }) b.Content = T(I18nKeys.YoloTaskSetRemoveSelected);
        TabCommon.Header = T(I18nKeys.YoloTaskSetSectionCommon);
        TabGlobalAug.Header = T(I18nKeys.YoloTaskSetSectionGlobalAug);
        TabSynthesis.Header = T(I18nKeys.YoloTaskSetSectionSynthesis);
        TabValidation.Header = T(I18nKeys.YoloTaskSetSectionValidation);
        TabPreview.Header = T(I18nKeys.YoloTaskSetSectionPreview);
        TabGenerate.Header = T(I18nKeys.YoloTaskSetSectionGenerate);
        foreach (var (text, key) in _fieldLabels) text.Text = T(key);
        foreach (var row in _overrideRows) row.Inherit.Content = T(I18nKeys.YoloTaskSetInheritGlobal);
        foreach (var combo in _synEditors.OfType<ComboBox>())
        {
            bool was = _rendering;
            _rendering = true;
            int idx = combo.SelectedIndex;
            combo.ItemsSource = ScaleModeTexts();
            combo.SelectedIndex = idx;
            _rendering = was;
        }
    }

    private static string[] ScaleModeTexts() =>
        SynthesisSettings.ScaleModes.Select(m => T(m == SynthesisSettings.ScaleModeRelative ? I18nKeys.YoloTaskSetScaleModeRelative : I18nKeys.YoloTaskSetScaleModeNative)).ToArray();

    private void BindEvents()
    {
        BtnSetNew.Click += async (_, _) => await CreateSetAsync();
        BtnSetRename.Click += async (_, _) => await RenameSetAsync();
        BtnSetDuplicate.Click += async (_, _) => await DuplicateSetAsync();
        BtnSetDelete.Click += async (_, _) => await DeleteSetAsync();
        LstSets.SelectionChanged += async (_, _) =>
        {
            if (!_loading) await SelectSetAsync((LstSets.SelectedItem as TaskSetRow)?.Set);
        };
        TxtDescription.LostFocus += (_, _) =>
        {
            if (_set == null || _set.Description == TxtDescription.Text) return;
            _set.Description = TxtDescription.Text;
            ScheduleSave();
        };

        BtnTargetAdd.Click += async (_, _) => await AddTargetAsync();
        BtnTargetRename.Click += async (_, _) => await RenameTargetAsync();
        BtnTargetDelete.Click += async (_, _) => await DeleteTargetAsync();
        BtnTargetUp.Click += async (_, _) => await MoveTargetAsync(-1);
        BtnTargetDown.Click += async (_, _) => await MoveTargetAsync(1);
        LstTargets.SelectionChanged += (_, _) =>
        {
            if (_loading) return;
            _target = (LstTargets.SelectedItem as TaskTargetRow)?.Target;
            RenderTarget();
        };
        ChkIptInherit.Checked += (_, _) => SetIptInherit(true);
        ChkIptInherit.Unchecked += (_, _) => SetIptInherit(false);
        OnCommit(TxtIpt, CommitIpt);

        BtnVariantAddFiles.Click += async (_, _) => await AddFilesAsync(Pool.Variants);
        BtnSceneAddFiles.Click += async (_, _) => await AddFilesAsync(Pool.Scenes);
        BtnCommonAddFiles.Click += async (_, _) => await AddFilesAsync(Pool.Common);
        BtnVariantAddFolder.Click += async (_, _) => await AddFolderAsync(Pool.Variants);
        BtnSceneAddFolder.Click += async (_, _) => await AddFolderAsync(Pool.Scenes);
        BtnCommonAddFolder.Click += async (_, _) => await AddFolderAsync(Pool.Common);
        BtnVariantRemove.Click += async (_, _) => await RemoveSelectedAsync(LstVariants);
        BtnSceneRemove.Click += async (_, _) => await RemoveSelectedAsync(LstScenes);
        BtnCommonRemove.Click += async (_, _) => await RemoveSelectedAsync(LstCommon);

        BtnValidate.Click += async (_, _) =>
        {
            await ValidateAsync();
            TabsRight.SelectedItem = TabValidation;
        };
        BtnPreview.Click += async (_, _) => await PreviewAsync(reset: true);
        BtnNextSample.Click += async (_, _) => await PreviewAsync(reset: false);
        BtnGenerate.Click += async (_, _) => await GenerateAsync();
        BtnCancel.Click += (_, _) => _generateCts?.Cancel();
        BtnOpenDataset.Click += (_, _) =>
        {
            if (_result != null) YoloSegmentLayout.OpenDir(_result.DatasetDir);
        };
        BtnTrain.Click += async (_, _) => await TrainAsync();
    }

    // ---------- store helpers ----------

    private static bool IsHandled(Exception ex) =>
        ex is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException or NotSupportedException or JsonException;

    /// <summary>Serialized background store / synthesizer call; handled failures show an i18n error and yield default.</summary>
    private async Task<TResult?> RunAsync<TResult>(Func<TResult> work, bool busy = false)
    {
        await _storeGate.WaitAsync();
        if (busy) SetBusy(true);
        try
        {
            return await Task.Run(work);
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
            return default;
        }
        finally
        {
            if (busy) SetBusy(false);
            _storeGate.Release();
        }
    }

    private Task<bool> RunAsync(Action work, bool busy = false) => RunAsync(() =>
    {
        work();
        return true;
    }, busy);

    private void ScheduleSave()
    {
        if (_set == null) return;
        _saveTimer.Stop();
        _saveTimer.Start();
    }

    private async Task FlushSaveAsync()
    {
        if (!_saveTimer.IsEnabled) return;
        _saveTimer.Stop();
        if (_set is not { } set) return;
        await RunAsync(() => _store.Save(set));
        RenderSetRows();
    }

    private void SetBusy(bool busy)
    {
        _busy = busy;
        if (busy) SetStatus(ChipInfo, () => T(I18nKeys.YoloTaskSetStatusBusy));
        else if (_statusStyle == ChipInfo && _generateCts == null) SetStatus(ChipIdle, () => T(I18nKeys.YoloTaskSetStatusIdle));
        UpdateEnabled();
    }

    private void UpdateEnabled()
    {
        bool hasSet = _set != null;
        bool idle = !_busy && _generateCts == null;
        MainArea.IsEnabled = idle;
        BtnValidate.IsEnabled = hasSet && idle;
        BtnPreview.IsEnabled = hasSet && idle;
        BtnNextSample.IsEnabled = hasSet && idle && _preview != null;
        BtnGenerate.IsEnabled = hasSet && idle;
        BtnTrain.IsEnabled = hasSet && idle;
        BtnCancel.IsEnabled = _generateCts != null;
        BtnOpenDataset.IsEnabled = _result != null && Directory.Exists(_result.DatasetDir);
        BtnSetRename.IsEnabled = hasSet;
        BtnSetDuplicate.IsEnabled = hasSet;
        BtnSetDelete.IsEnabled = hasSet;
        TxtDescription.IsEnabled = hasSet;
        CardTargets.IsEnabled = hasSet;
        CardRight.IsEnabled = hasSet;
        CardTarget.IsEnabled = _target != null;
        int idx = _target == null || _set == null ? -1 : _set.Targets.IndexOf(_target);
        BtnTargetRename.IsEnabled = idx >= 0;
        BtnTargetDelete.IsEnabled = idx >= 0;
        BtnTargetUp.IsEnabled = idx > 0;
        BtnTargetDown.IsEnabled = idx >= 0 && idx < _set!.Targets.Count - 1;
    }

    private void SetStatus(string style, Func<string> text)
    {
        _statusStyle = style;
        _statusText = text;
        RenderStatus();
    }

    private void RenderStatus()
    {
        ChipStatus.SetResourceReference(StyleProperty, _statusStyle);
        TxtStatusChip.Text = _statusText();
    }

    private void ShowError(Exception ex)
    {
        SetStatus(ChipDanger, () => T(I18nKeys.YoloTaskSetStatusFailed));
        MessageBox.Show(this, T(I18nKeys.YoloTaskSetErrorIo).Replace("{message}", ex.Message), Title, MessageBoxButton.OK, MessageBoxImage.Error);
    }

    private void Warn(string text) => MessageBox.Show(this, text, Title, MessageBoxButton.OK, MessageBoxImage.Warning);

    private bool Confirm(string text) =>
        MessageBox.Show(this, text, T(I18nKeys.YoloTaskSetConfirmTitle), MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;

    private string? AskName(string titleKey, string promptKey, string initial)
    {
        var name = AnnotatorInputDialog.Ask(this, T(titleKey), T(promptKey), initial)?.Trim();
        return string.IsNullOrEmpty(name) ? null : name;
    }

    // ---------- task sets ----------

    private async Task ReloadSetsAsync(string? selectId)
    {
        await FlushSaveAsync();
        var list = await RunAsync(() => _store.List()) ?? Array.Empty<TaskSet>();
        _loading = true;
        _sets.Clear();
        foreach (var s in list.OrderBy(s => s.Name, StringComparer.CurrentCultureIgnoreCase)) _sets.Add(new TaskSetRow(s));
        RenderSetRows();
        var row = _sets.FirstOrDefault(r => r.Set.Id == selectId) ?? _sets.FirstOrDefault();
        LstSets.SelectedItem = row;
        _loading = false;
        await SelectSetAsync(row?.Set);
    }

    private void RenderSetRows()
    {
        foreach (var row in _sets)
        {
            row.Name = row.Set.Name;
            row.Detail = T(I18nKeys.YoloTaskSetSetRowDetail)
                .Replace("{targets}", row.Set.Targets.Count.ToString(CultureInfo.InvariantCulture))
                .Replace("{common}", row.Set.CommonResources.Count.ToString(CultureInfo.InvariantCulture));
        }
    }

    private async Task SelectSetAsync(TaskSet? set)
    {
        await FlushSaveAsync();
        _set = set;
        _issues = null;
        _preview = null;
        _previewImage = null;
        _result = null;
        _previewSeed = set?.Synthesis.Seed ?? 0;
        if (set != null) ConfigBinding.SaveString(ConfigKeys.YoloTaskSetLastTaskSet, set.Id);
        _rendering = true;
        TxtDescription.Text = set?.Description ?? "";
        _rendering = false;
        RenderTargetRows();
        RenderCommon();
        RenderGlobalAug();
        RenderSynthesis();
        RenderIssues();
        RenderPreview();
        RenderResult();
        SetStatus(ChipIdle, () => T(I18nKeys.YoloTaskSetStatusIdle));
        UpdateEnabled();
    }

    private async Task CreateSetAsync()
    {
        if (AskName(I18nKeys.YoloTaskSetSetNew, I18nKeys.YoloTaskSetSetNamePrompt, T(I18nKeys.YoloTaskSetSetDefaultName)) is not { } name) return;
        var created = await RunAsync(() => _store.Create(name));
        if (created != null) await ReloadSetsAsync(created.Id);
    }

    private async Task RenameSetAsync()
    {
        if (_set is not { } set) return;
        if (AskName(I18nKeys.YoloTaskSetSetRename, I18nKeys.YoloTaskSetSetNamePrompt, set.Name) is not { } name || name == set.Name) return;
        set.Name = name;
        _saveTimer.Stop();
        await RunAsync(() => _store.Save(set));
        RenderSetRows();
    }

    private async Task DuplicateSetAsync()
    {
        if (_set is not { } set) return;
        var initial = T(I18nKeys.YoloTaskSetSetDuplicateName).Replace("{name}", set.Name);
        if (AskName(I18nKeys.YoloTaskSetSetDuplicate, I18nKeys.YoloTaskSetSetNamePrompt, initial) is not { } name) return;
        await FlushSaveAsync();
        var copy = await RunAsync(() => _store.Duplicate(set.Id, name), busy: true);
        if (copy != null) await ReloadSetsAsync(copy.Id);
    }

    private async Task DeleteSetAsync()
    {
        if (_set is not { } set) return;
        if (!Confirm(T(I18nKeys.YoloTaskSetSetDeleteConfirm).Replace("{name}", set.Name))) return;
        _saveTimer.Stop();
        if (await RunAsync(() => _store.Delete(set.Id), busy: true)) await ReloadSetsAsync(null);
    }

    // ---------- targets ----------

    private void RenderTargetRows(string? selectId = null)
    {
        selectId ??= _target?.Id;
        _loading = true;
        _targets.Clear();
        if (_set != null)
            foreach (var t in _set.Targets) _targets.Add(new TaskTargetRow(t));
        for (int i = 0; i < _targets.Count; i++)
        {
            var t = _targets[i].Target;
            _targets[i].Title = T(I18nKeys.YoloTaskSetTargetRow)
                .Replace("{number}", (i + 1).ToString(CultureInfo.InvariantCulture))
                .Replace("{name}", t.Name);
            _targets[i].Detail = T(I18nKeys.YoloTaskSetTargetRowDetail)
                .Replace("{index}", i.ToString(CultureInfo.InvariantCulture))
                .Replace("{variants}", t.Variants.Count.ToString(CultureInfo.InvariantCulture))
                .Replace("{scenes}", t.Scenes.Count.ToString(CultureInfo.InvariantCulture));
        }
        var row = _targets.FirstOrDefault(r => r.Target.Id == selectId) ?? _targets.FirstOrDefault();
        LstTargets.SelectedItem = row;
        _loading = false;
        if (!ReferenceEquals(_target, row?.Target) || row == null)
        {
            _target = row?.Target;
            RenderTarget();
        }
        else
        {
            RenderTargetHeader();
        }
    }

    private void RenderTarget()
    {
        RenderTargetHeader();
        RenderResources(Pool.Variants);
        RenderResources(Pool.Scenes);
        RenderOverride();
        UpdateEnabled();
    }

    private void RenderTargetHeader()
    {
        int idx = _target == null || _set == null ? -1 : _set.Targets.IndexOf(_target);
        LblTargetName.Text = idx < 0 ? T(I18nKeys.YoloTaskSetNoTargetSelected) : _targets[idx].Title;
    }

    private async Task AddTargetAsync()
    {
        if (_set is not { } set) return;
        var initial = T(I18nKeys.YoloTaskSetTargetDefaultName).Replace("{number}", (set.Targets.Count + 1).ToString(CultureInfo.InvariantCulture));
        if (AskName(I18nKeys.YoloTaskSetTargetAdd, I18nKeys.YoloTaskSetTargetNamePrompt, initial) is not { } name) return;
        var added = await RunAsync(() => _store.AddTarget(set, name));
        AfterStructureChange(added?.Id);
    }

    private async Task RenameTargetAsync()
    {
        if (_set is not { } set || _target is not { } target) return;
        if (AskName(I18nKeys.YoloTaskSetTargetRename, I18nKeys.YoloTaskSetTargetNamePrompt, target.Name) is not { } name || name == target.Name) return;
        target.Name = name;
        _saveTimer.Stop();
        await RunAsync(() => _store.Save(set));
        AfterStructureChange(target.Id);
    }

    private async Task DeleteTargetAsync()
    {
        if (_set is not { } set || _target is not { } target) return;
        if (!Confirm(T(I18nKeys.YoloTaskSetTargetDeleteConfirm).Replace("{name}", target.Name))) return;
        int idx = set.Targets.IndexOf(target);
        await RunAsync(() => _store.RemoveTarget(set, target.Id));
        var next = set.Targets.Count == 0 ? null : set.Targets[Math.Clamp(idx, 0, set.Targets.Count - 1)].Id;
        _target = null;
        AfterStructureChange(next);
    }

    private async Task MoveTargetAsync(int delta)
    {
        if (_set is not { } set || _target is not { } target) return;
        await RunAsync(() => _store.MoveTarget(set, target.Id, delta));
        AfterStructureChange(target.Id);
    }

    private void AfterStructureChange(string? selectTargetId)
    {
        _issues = null;
        RenderTargetRows(selectTargetId);
        RenderSetRows();
        RenderIssues();
        UpdateEnabled();
    }

    private void SetIptInherit(bool inherit)
    {
        if (_rendering || _target == null || _set == null) return;
        _target.ImagesPerTarget = inherit ? null : _set.Synthesis.ImagesPerTarget;
        ScheduleSave();
        RenderIpt();
    }

    private void CommitIpt()
    {
        if (_target?.ImagesPerTarget == null) return;
        if (int.TryParse(TxtIpt.Text.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v))
        {
            _target.ImagesPerTarget = Math.Clamp(v, 1, MaxImagesPerTarget);
            ScheduleSave();
        }
        RenderIpt();
    }

    private void RenderIpt()
    {
        _rendering = true;
        bool inherit = _target?.ImagesPerTarget == null;
        ChkIptInherit.IsChecked = inherit;
        TxtIpt.IsEnabled = !inherit;
        int global = _set?.Synthesis.ImagesPerTarget ?? 0;
        TxtIpt.Text = (_target?.ImagesPerTarget ?? global).ToString(CultureInfo.InvariantCulture);
        TxtIptGlobal.Text = T(I18nKeys.YoloTaskSetGlobalValue).Replace("{value}", global.ToString(CultureInfo.InvariantCulture));
        _rendering = false;
    }

    // ---------- resources ----------

    private ObservableCollection<TaskResourceRow> RowsOf(Pool pool) => pool switch
    {
        Pool.Variants => _variants,
        Pool.Scenes => _scenes,
        _ => _common,
    };

    private void RenderCommon() => RenderResources(Pool.Common);

    private void RenderResources(Pool pool)
    {
        var rows = RowsOf(pool);
        rows.Clear();
        if (_set is not { } set) return;
        IEnumerable<TaskResource> resources = pool switch
        {
            Pool.Variants => _target?.Variants ?? Enumerable.Empty<TaskResource>(),
            Pool.Scenes => _target?.Scenes ?? Enumerable.Empty<TaskResource>(),
            _ => set.CommonResources,
        };
        Action? labelChanged = pool == Pool.Variants ? ScheduleSave : null;
        foreach (var r in resources)
        {
            var row = new TaskResourceRow(r, _store.ResourcePath(set, r), r.Kind == TaskResourceKind.Video ? GlyphVideo : GlyphImage, labelChanged);
            rows.Add(row);
            if (!row.IsVideo) _ = LoadThumbnailAsync(row);
        }
        if (pool == Pool.Common) RefreshVideoEstimates();
    }

    private static async Task LoadThumbnailAsync(TaskResourceRow row)
    {
        var path = row.Path;
        row.Thumbnail = await Task.Run(() => DecodeImage(path, ThumbDecodeWidth));
    }

    /// <summary>Decode fully into memory (OnLoad from a byte stream) so the source file is never locked.</summary>
    private static BitmapSource? DecodeImage(string path, int decodeWidth)
    {
        try
        {
            return DecodeBytes(File.ReadAllBytes(path), decodeWidth);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException or InvalidOperationException or FormatException)
        {
            return null;
        }
    }

    private static BitmapSource DecodeBytes(byte[] bytes, int decodeWidth)
    {
        using var ms = new MemoryStream(bytes);
        var bmp = new BitmapImage();
        bmp.BeginInit();
        bmp.CacheOption = BitmapCacheOption.OnLoad;
        if (decodeWidth > 0) bmp.DecodePixelWidth = decodeWidth;
        bmp.StreamSource = ms;
        bmp.EndInit();
        bmp.Freeze();
        return bmp;
    }

    private void RefreshVideoEstimates()
    {
        if (_set is not { } set) return;
        int version = ++_commonVersion;
        int interval = set.Synthesis.VideoFrameInterval;
        int max = set.Synthesis.VideoMaxFrames;
        foreach (var row in _common)
        {
            if (row.IsVideo)
            {
                row.Frames = null;
                row.FramesFailed = false;
                _ = EstimateFramesAsync(row, interval, max, version);
            }
            DescribeCommon(row);
        }
    }

    private async Task EstimateFramesAsync(TaskResourceRow row, int interval, int max, int version)
    {
        var path = row.Path;
        int? frames;
        try
        {
            frames = await Task.Run(() => VideoFrameExtractor.EstimateFrames(path, interval, max));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            frames = null;
        }
        if (version != _commonVersion) return;
        row.Frames = frames;
        row.FramesFailed = frames == null;
        DescribeCommon(row);
    }

    private static void DescribeCommon(TaskResourceRow row)
    {
        if (!row.IsVideo)
        {
            row.Info = T(I18nKeys.YoloTaskSetKindImage);
            return;
        }
        row.Info = row.FramesFailed ? T(I18nKeys.YoloTaskSetVideoFramesFailed)
            : row.Frames is { } n ? T(I18nKeys.YoloTaskSetVideoFrames).Replace("{count}", n.ToString(CultureInfo.InvariantCulture))
            : T(I18nKeys.YoloTaskSetVideoFramesPending);
    }

    private static bool Accepts(Pool pool, string path) =>
        TaskSetStore.IsSupportedImage(path) || (pool == Pool.Common && TaskSetStore.IsSupportedVideo(path));

    private async Task AddFilesAsync(Pool pool)
    {
        var filter = pool == Pool.Common
            ? $"{T(I18nKeys.YoloTaskSetMediaFilter)}|{ImagePatterns};{VideoPatterns}|{T(I18nKeys.YoloTaskSetImageFilter)}|{ImagePatterns}|{AllFilesPattern}|{AllFilesPattern}"
            : $"{T(I18nKeys.YoloTaskSetImageFilter)}|{ImagePatterns}|{AllFilesPattern}|{AllFilesPattern}";
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = filter, Multiselect = true };
        if (dlg.ShowDialog(this) != true || dlg.FileNames.Length == 0) return;
        var files = dlg.FileNames;
        await AddPathsAsync(pool, () => files);
    }

    private async Task AddFolderAsync(Pool pool)
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.YoloTaskSetFolderTitle) };
        if (dlg.ShowDialog(this) != true) return;
        var folder = dlg.FolderName;
        await AddPathsAsync(pool, () => Directory.EnumerateFiles(folder).OrderBy(f => f, StringComparer.OrdinalIgnoreCase).ToList());
    }

    /// <summary>Import files into the pool in the background; unsupported files are counted and reported.</summary>
    private async Task AddPathsAsync(Pool pool, Func<IReadOnlyList<string>> listFiles)
    {
        if (_set is not { } set) return;
        var target = _target;
        if (pool != Pool.Common && target == null) return;
        int skipped = 0;
        await RunAsync(() =>
        {
            foreach (var path in listFiles())
            {
                if (!Accepts(pool, path))
                {
                    skipped++;
                    continue;
                }
                _ = pool switch
                {
                    Pool.Variants => _store.AddVariant(set, target!, path),
                    Pool.Scenes => _store.AddScene(set, target!, path),
                    _ => _store.AddCommon(set, path),
                };
            }
        }, busy: true);
        AfterResourcesChanged(pool);
        if (skipped > 0) Warn(T(I18nKeys.YoloTaskSetAddSkipped).Replace("{count}", skipped.ToString(CultureInfo.InvariantCulture)));
    }

    private async Task RemoveSelectedAsync(ListBox list)
    {
        if (_set is not { } set) return;
        var selected = list.SelectedItems.OfType<TaskResourceRow>().Select(r => r.Resource).ToList();
        if (selected.Count == 0) return;
        if (!Confirm(T(I18nKeys.YoloTaskSetRemoveConfirm).Replace("{count}", selected.Count.ToString(CultureInfo.InvariantCulture)))) return;
        await RunAsync(() =>
        {
            foreach (var r in selected) _store.RemoveResource(set, r);
        }, busy: true);
        AfterResourcesChanged(ReferenceEquals(list, LstVariants) ? Pool.Variants : ReferenceEquals(list, LstScenes) ? Pool.Scenes : Pool.Common);
    }

    private void AfterResourcesChanged(Pool pool)
    {
        _issues = null;
        RenderResources(pool);
        RenderTargetRows();
        RenderSetRows();
        RenderIssues();
    }

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
        for (int i = 0; i < AugFields.Count; i++)
        {
            var field = AugFields[i];
            GridGlobalAug.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            AddLabel(GridGlobalAug, i, field.LabelKey);
            Control editor;
            if (field.Kind == FieldKind.Bool)
            {
                var check = NewCheck();
                check.Checked += (_, _) => CommitGlobalAug(field, true);
                check.Unchecked += (_, _) => CommitGlobalAug(field, false);
                editor = check;
            }
            else
            {
                var box = NewNumberBox();
                OnCommit(box, () => CommitGlobalAug(field, ParseValue(field.Kind, box.Text)));
                editor = box;
            }
            Place(GridGlobalAug, editor, i, 1);
            _globalAugEditors.Add(editor);
        }
    }

    private void CommitGlobalAug(AugField field, object? value)
    {
        if (_rendering || _set is not { } set) return;
        if (value != null)
        {
            var p = set.Augmentation.Clone();
            field.Set(p, value);
            set.Augmentation = p.Normalized();
            ScheduleSave();
        }
        RenderGlobalAug();
        RenderOverride();
    }

    private void RenderGlobalAug()
    {
        _rendering = true;
        var p = _set?.Augmentation ?? new AugmentationProfile();
        for (int i = 0; i < AugFields.Count; i++)
            SetEditorValue(_globalAugEditors[i], AugFields[i].Get(p));
        _rendering = false;
    }

    private void BuildOverrideEditor()
    {
        for (int i = 0; i < AugFields.Count; i++)
        {
            var field = AugFields[i];
            GridOverride.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            AddLabel(GridOverride, i, field.LabelKey);
            var inherit = NewCheck();
            Control editor = field.Kind == FieldKind.Bool ? NewCheck() : NewNumberBox();
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
                OnCommit(box, () => CommitOverride(row, ParseValue(field.Kind, box.Text)));
            }
            Place(GridOverride, inherit, i, 1);
            Place(GridOverride, editor, i, 2);
            Place(GridOverride, global, i, 3);
            _overrideRows.Add(row);
        }
    }

    private void SetOverrideInherit(OverrideRow row, bool inherit)
    {
        if (_rendering || _set is not { } set || _target is not { } target) return;
        var o = target.Augmentation ?? new AugmentationOverride();
        row.Field.SetOverride(o, inherit ? null : row.Field.Get(set.Augmentation));
        target.Augmentation = o.IsEmpty ? null : o;
        ScheduleSave();
        RenderOverride();
    }

    private void CommitOverride(OverrideRow row, object? value)
    {
        if (_rendering || _set is not { } set || _target is not { } target) return;
        if (value != null)
        {
            var probe = set.Augmentation.Clone();
            row.Field.Set(probe, value);
            var o = target.Augmentation ?? new AugmentationOverride();
            row.Field.SetOverride(o, row.Field.Get(probe.Normalized()));
            target.Augmentation = o.IsEmpty ? null : o;
            ScheduleSave();
        }
        RenderOverride();
    }

    private void RenderOverride()
    {
        _rendering = true;
        var global = _set?.Augmentation ?? new AugmentationProfile();
        var o = _target?.Augmentation;
        foreach (var row in _overrideRows)
        {
            var own = o == null ? null : row.Field.GetOverride(o);
            var globalValue = row.Field.Get(global);
            row.Inherit.Content = T(I18nKeys.YoloTaskSetInheritGlobal);
            row.Inherit.IsChecked = own == null;
            row.Editor.IsEnabled = own != null;
            SetEditorValue(row.Editor, own ?? globalValue);
            row.Global.Text = T(I18nKeys.YoloTaskSetGlobalValue).Replace("{value}", FormatValue(globalValue));
        }
        _rendering = false;
        RenderIpt();
    }

    private void BuildSynthesisEditor()
    {
        for (int i = 0; i < SynFields.Count; i++)
        {
            var field = SynFields[i];
            GridSynthesis.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            AddLabel(GridSynthesis, i, field.LabelKey);
            Control editor;
            if (field.Kind == FieldKind.ScaleMode)
            {
                var combo = new ComboBox { Width = 200, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 0, 12, 8) };
                combo.SelectionChanged += (_, _) =>
                {
                    int idx = combo.SelectedIndex;
                    if (idx >= 0 && idx < SynthesisSettings.ScaleModes.Count) CommitSynthesis(field, SynthesisSettings.ScaleModes[idx]);
                };
                editor = combo;
            }
            else
            {
                var box = NewNumberBox();
                OnCommit(box, () => CommitSynthesis(field, ParseValue(field.Kind, box.Text)));
                editor = box;
            }
            Place(GridSynthesis, editor, i, 1);
            _synEditors.Add(editor);
        }
    }

    private void CommitSynthesis(SynField field, object? value)
    {
        if (_rendering || _set is not { } set) return;
        if (value != null && !Equals(field.Get(set.Synthesis), value))
        {
            var s = set.Synthesis.Clone();
            field.Set(s, value);
            set.Synthesis = s.Normalized();
            ScheduleSave();
            if (field.LabelKey is I18nKeys.YoloTaskSetSynVideoFrameInterval or I18nKeys.YoloTaskSetSynVideoMaxFrames) RefreshVideoEstimates();
        }
        RenderSynthesis();
        RenderIpt();
    }

    private void RenderSynthesis()
    {
        _rendering = true;
        var s = _set?.Synthesis ?? new SynthesisSettings();
        for (int i = 0; i < SynFields.Count; i++)
        {
            var value = SynFields[i].Get(s);
            if (_synEditors[i] is ComboBox combo)
            {
                if (combo.ItemsSource == null) combo.ItemsSource = ScaleModeTexts();
                combo.SelectedIndex = Math.Max(0, SynthesisSettings.ScaleModes.ToList().IndexOf((string)value));
            }
            else
            {
                SetEditorValue(_synEditors[i], value);
            }
        }
        _rendering = false;
    }

    private static void SetEditorValue(Control editor, object value)
    {
        switch (editor)
        {
            case CheckBox check:
                check.IsChecked = value is true;
                break;
            case TextBox box:
                box.Text = FormatValue(value);
                break;
        }
    }

    private static object? ParseValue(FieldKind kind, string? text)
    {
        var s = (text ?? "").Trim();
        return kind switch
        {
            FieldKind.Double => double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) && double.IsFinite(d) ? d : null,
            FieldKind.Int => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : null,
            _ => null,
        };
    }

    private static string FormatValue(object value) => value switch
    {
        double d => d.ToString("0.####", CultureInfo.InvariantCulture),
        int i => i.ToString(CultureInfo.InvariantCulture),
        bool b => T(b ? I18nKeys.YoloTaskSetValueOn : I18nKeys.YoloTaskSetValueOff),
        _ => value.ToString() ?? "",
    };

    // ---------- validate, preview, generate, train ----------

    private async Task<IReadOnlyList<TaskSetIssue>?> ValidateAsync()
    {
        if (_set is not { } set) return null;
        await FlushSaveAsync();
        var dir = _store.GetDir(set.Id);
        var issues = await RunAsync(() => TaskSetSynthesizer.Validate(set, dir), busy: true);
        if (issues == null) return null;
        _issues = issues;
        RenderIssues();
        SetStatus(issues.Any(i => i.IsError) ? ChipDanger : issues.Count > 0 ? ChipWarning : ChipSuccess, () => T(I18nKeys.YoloTaskSetStatusIdle));
        return issues;
    }

    private void RenderIssues()
    {
        if (_issues == null)
        {
            TxtValidationState.Text = T(I18nKeys.YoloTaskSetValidationNone);
            LstIssues.ItemsSource = null;
            return;
        }
        TxtValidationState.Text = _issues.Count == 0 ? T(I18nKeys.YoloTaskSetValidationOk) : "";
        LstIssues.ItemsSource = _issues
            .OrderByDescending(i => i.IsError)
            .Select(i => new TaskSetIssueRow(i.IsError ? GlyphError : GlyphWarning, IssueText(i),
                (Brush)FindResource(i.IsError ? "DangerTextBrush" : "WarningTextBrush")))
            .ToList();
    }

    private static string IssueText(TaskSetIssue issue) => T(I18nKeys.YoloTaskSetIssue(issue.Code)).Replace("{subject}", issue.Subject);

    private async Task PreviewAsync(bool reset)
    {
        if (_set is not { } set) return;
        await FlushSaveAsync();
        _previewSeed = reset ? set.Synthesis.Seed : _previewSeed + 1;
        int seed = _previewSeed;
        var dir = _store.GetDir(set.Id);
        var rendered = await RunAsync(() =>
        {
            var r = TaskSetSynthesizer.RenderPreview(set, dir, seed);
            return (Result: r, Image: DecodeBytes(r.Png, 0));
        }, busy: true);
        TabsRight.SelectedItem = TabPreview;
        if (rendered.Result == null) return;
        _preview = rendered.Result;
        _previewImage = rendered.Image;
        RenderPreview();
        UpdateEnabled();
    }

    private void RenderPreview()
    {
        CanvasBoxes.Children.Clear();
        if (_preview is not { } preview || _previewImage is not { } image)
        {
            ImgPreview.Source = null;
            ImgPreview.Width = CanvasBoxes.Width = 0;
            ImgPreview.Height = CanvasBoxes.Height = 0;
            RenderPreviewInfo();
            return;
        }
        double w = image.PixelWidth, h = image.PixelHeight;
        ImgPreview.Source = image;
        ImgPreview.Width = CanvasBoxes.Width = w;
        ImgPreview.Height = CanvasBoxes.Height = h;
        double stroke = Math.Max(2, Math.Max(w, h) / 400);
        double fontSize = Math.Max(12, Math.Max(w, h) / 70);
        foreach (var box in preview.Boxes)
        {
            var rect = new Rectangle { Width = Math.Max(1, box.XMax - box.XMin), Height = Math.Max(1, box.YMax - box.YMin), StrokeThickness = stroke };
            rect.SetResourceReference(Shape.StrokeProperty, "AccentBrush");
            Canvas.SetLeft(rect, box.XMin);
            Canvas.SetTop(rect, box.YMin);
            CanvasBoxes.Children.Add(rect);
            var text = new TextBlock { Text = box.Label, FontSize = fontSize, Padding = new Thickness(stroke, 0, stroke, 0) };
            text.SetResourceReference(TextBlock.ForegroundProperty, "TextOnAccentBrush");
            text.SetResourceReference(TextBlock.BackgroundProperty, "AccentBrush");
            Canvas.SetLeft(text, box.XMin);
            Canvas.SetTop(text, Math.Max(0, box.YMin - fontSize * 1.4));
            CanvasBoxes.Children.Add(text);
        }
        RenderPreviewInfo();
    }

    private void RenderPreviewInfo() =>
        TxtPreviewInfo.Text = _preview == null ? T(I18nKeys.YoloTaskSetPreviewNone)
            : T(I18nKeys.YoloTaskSetPreviewInfo)
                .Replace("{seed}", _previewSeed.ToString(CultureInfo.InvariantCulture))
                .Replace("{boxes}", _preview.Boxes.Count.ToString(CultureInfo.InvariantCulture));

    private async Task GenerateAsync()
    {
        if (_set is not { } set) return;
        var issues = await ValidateAsync();
        if (issues == null) return;
        if (issues.Any(i => i.IsError))
        {
            TabsRight.SelectedItem = TabValidation;
            Warn(T(I18nKeys.YoloTaskSetGenerateBlocked));
            return;
        }
        var dir = _store.GetDir(set.Id);
        var outDir = System.IO.Path.Combine(dir, TaskSetStore.DatasetsSubdir, DateTime.Now.ToString(DatasetStampFormat, CultureInfo.InvariantCulture));
        var cts = new CancellationTokenSource();
        _generateCts = cts;
        _result = null;
        BarProgress.Value = 0;
        RenderResult();
        TabsRight.SelectedItem = TabGenerate;
        var progress = new Progress<SynthesisProgress>(p =>
        {
            BarProgress.Value = p.Total <= 0 ? 0 : (double)p.Done / p.Total;
            SetStatus(ChipInfo, () => T(I18nKeys.YoloTaskSetStatusGenerating)
                .Replace("{done}", p.Done.ToString(CultureInfo.InvariantCulture))
                .Replace("{total}", p.Total.ToString(CultureInfo.InvariantCulture)));
        });
        SetStatus(ChipInfo, () => T(I18nKeys.YoloTaskSetStatusBusy));
        UpdateEnabled();
        var task = Task.Run(() => TaskSetSynthesizer.Generate(set, dir, outDir, progress, cts.Token));
        _generateTask = task;
        try
        {
            _result = await task;
            BarProgress.Value = 1;
            SetStatus(ChipSuccess, () => T(I18nKeys.YoloTaskSetStatusDone));
        }
        catch (OperationCanceledException)
        {
            SetStatus(ChipWarning, () => T(I18nKeys.YoloTaskSetStatusCancelled));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
        }
        finally
        {
            _generateTask = null;
            _generateCts = null;
            cts.Dispose();
            UpdateEnabled();
        }
        RenderResult();
    }

    private void RenderResult()
    {
        if (_result is not { } r)
        {
            TxtResult.Text = T(I18nKeys.YoloTaskSetGenerateNone);
            return;
        }
        var sb = new StringBuilder();
        sb.AppendLine(T(I18nKeys.YoloTaskSetResultSummary)
            .Replace("{train}", r.TrainImages.ToString(CultureInfo.InvariantCulture))
            .Replace("{val}", r.ValImages.ToString(CultureInfo.InvariantCulture))
            .Replace("{negative}", r.NegativeImages.ToString(CultureInfo.InvariantCulture)));
        foreach (var cls in r.Classes)
            sb.AppendLine(T(I18nKeys.YoloTaskSetResultInstances)
                .Replace("{name}", cls)
                .Replace("{count}", (r.Instances.TryGetValue(cls, out var n) ? n : 0).ToString(CultureInfo.InvariantCulture)));
        if (r.Warnings.Count > 0)
        {
            sb.AppendLine(T(I18nKeys.YoloTaskSetResultWarnings));
            foreach (var w in r.Warnings) sb.AppendLine("  " + IssueText(w));
        }
        sb.Append(T(I18nKeys.YoloTaskSetResultDir).Replace("{path}", r.DatasetDir));
        TxtResult.Text = sb.ToString();
    }

    private async Task TrainAsync()
    {
        if (_set is not { } set) return;
        var issues = await ValidateAsync();
        if (issues == null) return;
        if (issues.Any(i => i.IsError))
        {
            TabsRight.SelectedItem = TabValidation;
            Warn(T(I18nKeys.YoloTaskSetTrainBlocked));
            return;
        }
        YoloTrainingWindow.ShowForTaskSet(this, set.Id, autoStart: true);
    }

    private sealed record AugField(
        string LabelKey,
        FieldKind Kind,
        Func<AugmentationProfile, object> Get,
        Action<AugmentationProfile, object> Set,
        Func<AugmentationOverride, object?> GetOverride,
        Action<AugmentationOverride, object?> SetOverride);

    private sealed record SynField(string LabelKey, FieldKind Kind, Func<SynthesisSettings, object> Get, Action<SynthesisSettings, object> Set);

    private sealed record OverrideRow(AugField Field, CheckBox Inherit, Control Editor, TextBlock Global);
}
