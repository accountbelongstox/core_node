// PY-REF: none (DOT-only)
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Shapes;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotCore.Common;
using DotCore.VocAnnotator;
using DotCore.VocAnnotatorUI;
using DotCore.YoloRecord;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// View of the task-set manager for the specific YOLO training mode (YOLO_TASKSET_SYNTHESIS_DESIGN.md section 6). State and
/// store / synthesizer work live in <see cref="TaskSetManagerViewModel"/>; this class prompts, renders and wires input.
/// </summary>
public partial class TaskSetWindow : Window
{
    private const string AllFilesPattern = "*.*";
    private const string LinePrefix = "  ";
    private const int ImportSummaryMaxLines = 20;
    private const string IssueActionShow = "show";
    private const string IssueActionLabel = "label";
    private const string IssueActionMask = "mask";
    private const int AugPreviewDebounceMs = 350;
    private const int AugPreviewSeed = 1;
    private const double AugPreviewMaxHeight = 360;

    private static readonly string ImagePatterns = Patterns(TaskSetStore.ImageExtensions);
    private static readonly string VideoPatterns = Patterns(TaskSetStore.VideoExtensions);

    private readonly TaskSetManagerViewModel _vm = new();
    private readonly List<(TextBlock Text, string Key)> _fieldLabels = new();
    private readonly List<Control> _globalAugEditors = new();
    private readonly List<OverrideRow> _overrideRows = new();
    private readonly List<Control> _synEditors = new();
    private string? _pendingSelectId;
    private VariantExtractWindow? _extract;
    private TaskSet? _extractSet;
    private readonly DispatcherTimer _augTimer = new() { Interval = TimeSpan.FromMilliseconds(AugPreviewDebounceMs) };
    private readonly AugPreview _targetAug = new();
    private readonly AugPreview _globalAug = new();
    private int _augSeed = AugPreviewSeed;
    private int _augVersion;
    private bool _syncingSelection;
    private bool _rendering;
    private bool _closeReady;

    public TaskSetWindow()
    {
        InitializeComponent();
        LstSets.ItemsSource = _vm.Sets;
        LstTargets.ItemsSource = _vm.Targets;
        LstVariants.ItemsSource = _vm.Variants;
        LstScenes.ItemsSource = _vm.Scenes;
        LstCommon.ItemsSource = _vm.Common;
        LstDistractors.ItemsSource = _vm.Distractors;
        LstIssues.ItemsSource = _vm.IssueRows;
        LstDatasets.ItemsSource = _vm.Datasets;
        LstRuns.ItemsSource = _vm.Runs;
        LstHoldouts.ItemsSource = _vm.Holdouts;
        BuildGlobalAugEditor();
        BuildOverrideEditor();
        BuildSynthesisEditor();
        BuildRoiEditor();
        BuildAugPreviews();
        ApplyTexts();
        BindEvents();
        BindShortcuts();
        _vm.PropertyChanged += OnViewModelChanged;
        _vm.StateChanged += UpdateEnabled;
        _vm.StructureChanged += () =>
        {
            _extract?.RefreshTargets();
            ScheduleAugPreview();
        };
        _vm.ErrorRaised += message => MessageBox.Show(this, message, Title, MessageBoxButton.OK, MessageBoxImage.Error);
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        Closed += (_, _) =>
        {
            D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
            _augTimer.Stop();
        };
        Loaded += async (_, _) => await _vm.ReloadSetsAsync(_pendingSelectId ?? ConfigBinding.GetValue(ConfigKeys.YoloTaskSetLastTaskSet, ""));
        RenderAll();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string N(int value) => value.ToString(CultureInfo.InvariantCulture);

    private static string Patterns(IEnumerable<string> extensions) => string.Join(";", extensions.Select(e => "*" + e));

    /// <summary>Show the single manager window (reused when open), optionally selecting a task set.</summary>
    public static TaskSetWindow ShowSingle(Window? owner, string? taskSetId = null)
    {
        var win = Current;
        if (win == null)
        {
            win = new TaskSetWindow { Owner = owner, _pendingSelectId = taskSetId };
            win.Show();
            return win;
        }
        if (win.WindowState == WindowState.Minimized) win.WindowState = WindowState.Normal;
        win.Activate();
        if (taskSetId != null && win.IsLoaded && win._vm.Set?.Id != taskSetId && win.ReleaseExtractorFor(taskSetId)) _ = win._vm.ReloadSetsAsync(taskSetId);
        return win;
    }

    private static TaskSetWindow? Current => Application.Current.Windows.OfType<TaskSetWindow>().FirstOrDefault();

    /// <summary>Another window is about to write this task set on disk: persist pending manager edits first (UI thread).</summary>
    public static Task FlushPendingAsync(string taskSetId) =>
        Current is { } win && win._vm.Set?.Id == taskSetId ? win._vm.FlushSaveAsync() : Task.CompletedTask;

    /// <summary>Another window changed this task set on disk: reload it when it is the selected one (UI thread).</summary>
    public static void NotifyExternalChange(string taskSetId)
    {
        if (Current is { IsLoaded: true } win && win._vm.Set?.Id == taskSetId) _ = win._vm.ReloadCurrentAsync();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        if (e.Cancel || _closeReady) return;
        if (_vm.IsGenerating && !Confirm(T(I18nKeys.YoloTaskSetConfirmCloseBusy)))
        {
            e.Cancel = true;
            return;
        }
        if (!_vm.HasPendingWork && !_vm.CanCancel) return;
        e.Cancel = true;
        _ = CloseAfterPendingAsync();
    }

    private async Task CloseAfterPendingAsync()
    {
        await _vm.CompletePendingAsync();
        _closeReady = true;
        Close();
    }

    // ---------- texts ----------

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        _vm.RefreshTexts();
        RenderAll();
    });

    private static void Tip(Control control, string key)
    {
        var text = T(key);
        control.ToolTip = text;
        AutomationProperties.SetName(control, text);
    }

    private void ApplyTexts()
    {
        Title = T(I18nKeys.YoloTaskSetWindowTitle);
        Resources["IssueActionShow"] = T(I18nKeys.YoloTaskSetHitShow);
        Resources["IssueActionLabel"] = T(I18nKeys.YoloTaskSetHitLabel);
        Resources["IssueActionMask"] = T(I18nKeys.YoloTaskSetHitMask);
        BtnValidate.Content = T(I18nKeys.YoloTaskSetValidate);
        BtnPreview.Content = T(I18nKeys.YoloTaskSetPreview);
        BtnNextSample.Content = T(I18nKeys.YoloTaskSetNextSample);
        BtnGenerate.Content = T(I18nKeys.YoloTaskSetGenerate);
        BtnCancel.Content = T(I18nKeys.YoloTaskSetCancel);
        BtnOpenDataset.Content = T(I18nKeys.YoloTaskSetOpenDataset);
        BtnTrain.Content = T(I18nKeys.YoloTaskSetTrain);
        Tip(BtnUndo, I18nKeys.YoloTaskSetUndo);
        LblSets.Text = T(I18nKeys.YoloTaskSetSectionSets);
        Tip(BtnSetNew, I18nKeys.YoloTaskSetSetNew);
        Tip(BtnSetRename, I18nKeys.YoloTaskSetSetRename);
        Tip(BtnSetDuplicate, I18nKeys.YoloTaskSetSetDuplicate);
        Tip(BtnSetDelete, I18nKeys.YoloTaskSetSetDelete);
        LblDescription.Text = T(I18nKeys.YoloTaskSetSetDescription);
        LblTargets.Text = T(I18nKeys.YoloTaskSetSectionTargets);
        Tip(BtnTargetAdd, I18nKeys.YoloTaskSetTargetAdd);
        Tip(BtnTargetRename, I18nKeys.YoloTaskSetTargetRename);
        Tip(BtnTargetUp, I18nKeys.YoloTaskSetTargetUp);
        Tip(BtnTargetDown, I18nKeys.YoloTaskSetTargetDown);
        Tip(BtnTargetDelete, I18nKeys.YoloTaskSetTargetDelete);
        Tip(BtnTargetImportTree, I18nKeys.YoloTaskSetImportTree);
        Tip(BtnTargetImportSet, I18nKeys.YoloTaskSetImportFromSet);
        LblImagesPerTarget.Text = T(I18nKeys.YoloTaskSetImagesPerTarget);
        ChkIptInherit.Content = T(I18nKeys.YoloTaskSetInheritGlobal);
        TabVariants.Header = T(I18nKeys.YoloTaskSetTabVariants);
        TabScenes.Header = T(I18nKeys.YoloTaskSetTabScenes);
        TabOverride.Header = T(I18nKeys.YoloTaskSetTabAugmentation);
        TxtVariantsHint.Text = T(I18nKeys.YoloTaskSetVariantsHint);
        TxtScenesHint.Text = T(I18nKeys.YoloTaskSetScenesHint);
        TxtCommonHint.Text = T(I18nKeys.YoloTaskSetCommonHint);
        TxtOverrideHint.Text = T(I18nKeys.YoloTaskSetOverrideHint);
        foreach (var b in new[] { BtnVariantAddFiles, BtnSceneAddFiles, BtnCommonAddFiles, BtnDistractorAddFiles }) b.Content = T(I18nKeys.YoloTaskSetAddFiles);
        foreach (var b in new[] { BtnVariantAddFolder, BtnSceneAddFolder, BtnCommonAddFolder, BtnDistractorAddFolder }) b.Content = T(I18nKeys.YoloTaskSetAddFolder);
        foreach (var b in new[] { BtnVariantRemove, BtnSceneRemove, BtnCommonRemove, BtnDistractorRemove }) b.Content = T(I18nKeys.YoloTaskSetRemoveSelected);
        BtnVariantExtract.Content = T(I18nKeys.YoloTaskSetExtractOpen);
        BtnDistractorExtract.Content = T(I18nKeys.YoloTaskSetExtractOpen);
        TabCommon.Header = T(I18nKeys.YoloTaskSetSectionCommon);
        TabDistractors.Header = T(I18nKeys.YoloTaskSetSectionDistractors);
        TxtDistractorsHint.Text = T(I18nKeys.YoloTaskSetDistractorsHint);
        LblRoi.Text = T(I18nKeys.YoloTaskSetRoiTitle);
        LblRoiAnchor.Text = T(I18nKeys.YoloTaskSetRoiAnchor);
        LblRoiBand.Text = T(I18nKeys.YoloTaskSetRoiBand);
        LblRoiRect.Text = T(I18nKeys.YoloTaskSetRoiRect);
        LblHoldout.Text = T(I18nKeys.YoloTaskSetHoldoutTitle);
        TxtHoldoutHint.Text = T(I18nKeys.YoloTaskSetHoldoutHint);
        BtnHoldoutAdd.Content = T(I18nKeys.YoloTaskSetAddFolder);
        BtnHoldoutRemove.Content = T(I18nKeys.YoloTaskSetRemoveSelected);
        AutomationProperties.SetName(LstHoldouts, LblHoldout.Text);
        AutomationProperties.SetName(CboRoiAnchor, LblRoiAnchor.Text);
        AutomationProperties.SetName(TxtRoiBand, LblRoiBand.Text);
        AutomationProperties.SetName(TxtRoiRect, LblRoiRect.Text);
        SetChoiceTexts(CboRoiAnchor, TaskSetFields.RoiAnchors.Select(a => a.TextKey));
        _targetAug.ApplyTexts();
        _globalAug.ApplyTexts();
        TabGlobalAug.Header = T(I18nKeys.YoloTaskSetSectionGlobalAug);
        TabSynthesis.Header = T(I18nKeys.YoloTaskSetSectionSynthesis);
        TabValidation.Header = T(I18nKeys.YoloTaskSetSectionValidation);
        TabPreview.Header = T(I18nKeys.YoloTaskSetSectionPreview);
        TabGenerate.Header = T(I18nKeys.YoloTaskSetSectionGenerate);
        TabHistory.Header = T(I18nKeys.YoloTaskSetSectionHistory);
        LblHistoryDatasets.Text = T(I18nKeys.YoloTaskSetHistoryDatasets);
        LblHistoryRuns.Text = T(I18nKeys.YoloTaskSetHistoryRuns);
        Tip(BtnHistoryRefresh, I18nKeys.YoloTaskSetHistoryRefresh);
        BtnDatasetOpen.Content = T(I18nKeys.YoloTaskSetHistoryOpen);
        BtnDatasetTrain.Content = T(I18nKeys.YoloTaskSetHistoryTrainDataset);
        BtnDatasetDelete.Content = T(I18nKeys.YoloTaskSetHistoryDelete);
        BtnRunOpen.Content = T(I18nKeys.YoloTaskSetHistoryOpen);
        BtnRunTest.Content = T(I18nKeys.YoloTaskSetHistoryTestModel);
        BtnRunDelete.Content = T(I18nKeys.YoloTaskSetHistoryDelete);
        foreach (var (text, key) in _fieldLabels) text.Text = T(key);
        foreach (var row in _overrideRows) row.Inherit.Content = T(I18nKeys.YoloTaskSetInheritGlobal);
        BuildContextMenus();
        for (int i = 0; i < TaskSetFields.Synthesis.Count; i++)
            if (_synEditors[i] is ComboBox combo && TaskSetFields.Synthesis[i].Choices is { } choices) SetChoiceTexts(combo, choices.Select(c => c.TextKey));
    }

    /// <summary>Localized combo items, keeping the selected index and suppressing commits.</summary>
    private void SetChoiceTexts(ComboBox combo, IEnumerable<string> keys)
    {
        bool was = _rendering;
        _rendering = true;
        int idx = combo.SelectedIndex;
        combo.ItemsSource = keys.Select(T).ToArray();
        combo.SelectedIndex = idx;
        _rendering = was;
    }

    private void BuildContextMenus()
    {
        MenuVariants.Items.Clear();
        MenuScenes.Items.Clear();
        MenuCommon.Items.Clear();
        MenuDistractors.Items.Clear();
        AddMenuItem(MenuVariants, I18nKeys.YoloTaskSetMenuEditVariant, EditSelectedVariant);
        AddMenuItem(MenuScenes, I18nKeys.YoloTaskSetExtractFromResource, () => OpenExtract(SelectedRow(LstScenes)?.Path));
        AddMenuItem(MenuCommon, I18nKeys.YoloTaskSetExtractFromResource, () => OpenExtract(SelectedRow(LstCommon)?.Path));
        AddMenuItem(MenuScenes, I18nKeys.YoloTaskSetExtractDistractors, () => OpenExtractDistractors(SelectedRow(LstScenes)?.Path));
        AddMenuItem(MenuCommon, I18nKeys.YoloTaskSetExtractDistractors, () => OpenExtractDistractors(SelectedRow(LstCommon)?.Path));
        AddMenuItem(MenuVariants, I18nKeys.YoloTaskSetMenuValOnly, () => _vm.SetValOnly(SelectedResources(LstVariants), true));
        AddMenuItem(MenuVariants, I18nKeys.YoloTaskSetMenuTrainAndVal, () => _vm.SetValOnly(SelectedResources(LstVariants), false));
        foreach (var (menu, list) in new[] { (MenuScenes, LstScenes), (MenuCommon, LstCommon) })
        {
            AddMenuItem(menu, I18nKeys.YoloTaskSetMenuRegions, () => _ = EditRegionsAsync(list));
            AddMenuItem(menu, I18nKeys.YoloTaskSetMenuMasks, () =>
            {
                if (SelectedRow(list)?.Resource is { } r) _ = EditMasksAsync(r);
            });
        }
        foreach (var (menu, list) in new[] { (MenuVariants, LstVariants), (MenuScenes, LstScenes), (MenuCommon, LstCommon), (MenuDistractors, LstDistractors) })
        {
            AddMenuItem(menu, I18nKeys.YoloTaskSetMenuPixelScale, () => SetPixelScale(list));
            menu.Items.Add(new Separator());
            AddMenuItem(menu, I18nKeys.YoloTaskSetRemoveSelected, () => _ = RemoveSelectedAsync(list), "Del");
        }
    }

    private static void AddMenuItem(ContextMenu menu, string key, Action click, string? gesture = null)
    {
        var item = new MenuItem { Header = T(key), InputGestureText = gesture ?? "" };
        item.Click += (_, _) => click();
        menu.Items.Add(item);
    }

    private static TaskResourceRow? SelectedRow(ListBox list) => list.SelectedItem as TaskResourceRow;

    // ---------- wiring ----------

    private void BindEvents()
    {
        BtnSetNew.Click += async (_, _) => await CreateSetAsync();
        BtnSetRename.Click += async (_, _) => await RenameSetAsync();
        BtnSetDuplicate.Click += async (_, _) => await DuplicateSetAsync();
        BtnSetDelete.Click += async (_, _) => await DeleteSetAsync();
        LstSets.SelectionChanged += async (_, _) =>
        {
            if (!_syncingSelection && LstSets.SelectedItem is TaskSetRow row) await SelectSetAsync(row.Set);
        };
        TxtDescription.LostFocus += (_, _) =>
        {
            if (!_rendering) _vm.SetDescription(TxtDescription.Text);
        };

        BtnTargetAdd.Click += async (_, _) => await AddTargetAsync();
        BtnTargetRename.Click += async (_, _) => await RenameTargetAsync();
        BtnTargetDelete.Click += async (_, _) => await DeleteTargetAsync();
        BtnTargetUp.Click += async (_, _) => await _vm.MoveTargetAsync(-1);
        BtnTargetDown.Click += async (_, _) => await _vm.MoveTargetAsync(1);
        LstTargets.SelectionChanged += (_, _) =>
        {
            if (!_syncingSelection) _vm.SelectTarget((LstTargets.SelectedItem as TaskTargetRow)?.Target);
        };
        ChkIptInherit.Checked += (_, _) => SetIptInherit(true);
        ChkIptInherit.Unchecked += (_, _) => SetIptInherit(false);
        OnCommit(TxtIpt, CommitIpt);

        BtnVariantAddFiles.Click += async (_, _) => await AddFilesAsync(TaskResourcePool.Variants);
        BtnSceneAddFiles.Click += async (_, _) => await AddFilesAsync(TaskResourcePool.Scenes);
        BtnCommonAddFiles.Click += async (_, _) => await AddFilesAsync(TaskResourcePool.Common);
        BtnVariantAddFolder.Click += async (_, _) => await AddFolderAsync(TaskResourcePool.Variants);
        BtnSceneAddFolder.Click += async (_, _) => await AddFolderAsync(TaskResourcePool.Scenes);
        BtnCommonAddFolder.Click += async (_, _) => await AddFolderAsync(TaskResourcePool.Common);
        BtnVariantRemove.Click += async (_, _) => await RemoveSelectedAsync(LstVariants);
        BtnSceneRemove.Click += async (_, _) => await RemoveSelectedAsync(LstScenes);
        BtnCommonRemove.Click += async (_, _) => await RemoveSelectedAsync(LstCommon);
        BtnVariantExtract.Click += (_, _) => OpenExtract(null);
        BtnDistractorAddFiles.Click += async (_, _) => await AddFilesAsync(TaskResourcePool.Distractors);
        BtnDistractorAddFolder.Click += async (_, _) => await AddFolderAsync(TaskResourcePool.Distractors);
        BtnDistractorRemove.Click += async (_, _) => await RemoveSelectedAsync(LstDistractors);
        BtnDistractorExtract.Click += (_, _) => OpenExtractDistractors(null);
        TabsTarget.SelectionChanged += (_, e) =>
        {
            if (ReferenceEquals(e.OriginalSource, TabsTarget)) ScheduleAugPreview();
        };
        TabsRight.SelectionChanged += (_, e) =>
        {
            if (ReferenceEquals(e.OriginalSource, TabsRight)) ScheduleAugPreview();
        };
        _augTimer.Tick += async (_, _) => await RenderAugPreviewsAsync();
        foreach (var (list, pool) in new[]
                 {
                     (LstVariants, TaskResourcePool.Variants), (LstScenes, TaskResourcePool.Scenes), (LstCommon, TaskResourcePool.Common),
                     (LstDistractors, TaskResourcePool.Distractors),
                 })
        {
            list.DragOver += (_, e) => AcceptFileDrag(e);
            list.Drop += async (_, e) => await DropFilesAsync(pool, e);
        }
        LstTargets.DragOver += (_, e) => AcceptFileDrag(e);
        LstTargets.Drop += async (_, e) => await DropOnTargetsAsync(e);
        BtnTargetImportTree.Click += async (_, _) => await ImportTreeAsync();
        BtnTargetImportSet.Click += async (_, _) => await ImportFromSetAsync();
        BtnUndo.Click += async (_, _) => await UndoAsync();
        BtnHoldoutAdd.Click += (_, _) => AddHoldout();
        BtnHoldoutRemove.Click += (_, _) => RemoveHoldouts();
        LstHoldouts.SelectionChanged += (_, _) => UpdateEnabled();

        BtnValidate.Click += async (_, _) =>
        {
            await _vm.ValidateAsync();
            TabsRight.SelectedItem = TabValidation;
        };
        BtnPreview.Click += async (_, _) => await PreviewAsync(reset: true);
        BtnNextSample.Click += async (_, _) => await PreviewAsync(reset: false);
        BtnGenerate.Click += async (_, _) => await GenerateAsync();
        BtnCancel.Click += (_, _) => _vm.CancelJob();
        BtnOpenDataset.Click += (_, _) =>
        {
            if (_vm.Result != null) YoloSegmentLayout.OpenDir(_vm.Result.DatasetDir);
        };
        BtnTrain.Click += async (_, _) => await TrainAsync();

        LstIssues.AddHandler(System.Windows.Controls.Primitives.ButtonBase.ClickEvent, new RoutedEventHandler(async (_, e) => await OnIssueActionAsync(e)));
        BtnHistoryRefresh.Click += async (_, _) => await _vm.RefreshHistoryAsync();
        LstDatasets.SelectionChanged += (_, _) => UpdateEnabled();
        LstRuns.SelectionChanged += (_, _) => UpdateEnabled();
        BtnDatasetOpen.Click += (_, _) =>
        {
            if (LstDatasets.SelectedItem is TaskSetDatasetRow row) YoloSegmentLayout.OpenDir(row.Dir);
        };
        BtnRunOpen.Click += (_, _) =>
        {
            if (LstRuns.SelectedItem is TaskSetRunRow row) YoloSegmentLayout.OpenDir(row.Dir);
        };
        BtnDatasetDelete.Click += async (_, _) =>
        {
            if (LstDatasets.SelectedItem is TaskSetDatasetRow row && Confirm(T(I18nKeys.YoloTaskSetHistoryDeleteConfirm).Replace("{name}", row.Name)))
                await DeleteHistoryAsync(row.Dir);
        };
        BtnDatasetTrain.Click += async (_, _) =>
        {
            if (LstDatasets.SelectedItem is not TaskSetDatasetRow { DataYamlPath: not null } row || _vm.Set is not { } set) return;
            await _vm.FlushSaveAsync();
            YoloTrainingWindow.ShowForDataset(this, set.Id, row.Dir, autoStart: true);
        };
        BtnRunTest.Click += (_, _) =>
        {
            if (LstRuns.SelectedItem is TaskSetRunRow row) ModelTestWindow.ShowSingle(this, row.OnnxPath ?? row.WeightsPath ?? row.Dir);
        };
        BtnRunDelete.Click += async (_, _) =>
        {
            if (LstRuns.SelectedItem is TaskSetRunRow row && Confirm(T(I18nKeys.YoloTaskSetHistoryDeleteConfirm).Replace("{name}", row.Name)))
                await DeleteHistoryAsync(row.Dir);
        };
    }

    private async Task DeleteHistoryAsync(string dir)
    {
        if (!await _vm.DeleteHistoryDirAsync(dir)) Warn(T(I18nKeys.YoloTaskSetHistoryLocked));
    }

    private void BindShortcuts()
    {
        AddShortcut(Key.Delete, ModifierKeys.None, () => _ = DeleteFocusedAsync(), allowInTextBox: false);
        AddShortcut(Key.F2, ModifierKeys.None, () => _ = RenameFocusedAsync());
        AddShortcut(Key.N, ModifierKeys.Control, () => _ = AddTargetAsync());
        AddShortcut(Key.N, ModifierKeys.Control | ModifierKeys.Shift, () => _ = CreateSetAsync());
        AddShortcut(Key.F5, ModifierKeys.None, () => _ = PreviewAsync(reset: false));
        AddShortcut(Key.Z, ModifierKeys.Control, () => _ = UndoAsync(), allowInTextBox: false);
    }

    private void AddShortcut(Key key, ModifierKeys modifiers, Action action, bool allowInTextBox = true)
    {
        var command = new RoutedCommand();
        CommandBindings.Add(new CommandBinding(command, (_, _) => action(), (_, e) =>
            e.CanExecute = _vm.IsIdle && (allowInTextBox || Keyboard.FocusedElement is not TextBox)));
        InputBindings.Add(new KeyBinding(command, key, modifiers));
    }

    private bool IsFocusWithin(UIElement element) => element.IsKeyboardFocusWithin;

    private async Task DeleteFocusedAsync()
    {
        if (IsFocusWithin(LstVariants)) await RemoveSelectedAsync(LstVariants);
        else if (IsFocusWithin(LstScenes)) await RemoveSelectedAsync(LstScenes);
        else if (IsFocusWithin(LstCommon)) await RemoveSelectedAsync(LstCommon);
        else if (IsFocusWithin(LstDistractors)) await RemoveSelectedAsync(LstDistractors);
        else if (IsFocusWithin(LstTargets)) await DeleteTargetAsync();
        else if (IsFocusWithin(LstSets)) await DeleteSetAsync();
    }

    private async Task RenameFocusedAsync()
    {
        if (IsFocusWithin(LstSets)) await RenameSetAsync();
        else await RenameTargetAsync();
    }

    // ---------- view model -> view ----------

    private void OnViewModelChanged(object? sender, PropertyChangedEventArgs e)
    {
        switch (e.PropertyName)
        {
            case nameof(TaskSetManagerViewModel.Set):
                SyncSetSelection();
                SyncExtractorSet();
                _rendering = true;
                TxtDescription.Text = _vm.Set?.Description ?? "";
                _rendering = false;
                RenderGlobalAug();
                RenderSynthesis();
                RenderResult();
                break;
            case nameof(TaskSetManagerViewModel.Target):
                SyncTargetSelection();
                RenderTargetHeader();
                RenderOverride();
                ScheduleAugPreview();
                break;
            case nameof(TaskSetManagerViewModel.Issues):
                RenderIssuesState();
                break;
            case nameof(TaskSetManagerViewModel.Preview):
                RenderPreview();
                break;
            case nameof(TaskSetManagerViewModel.Result):
                RenderResult();
                break;
            case nameof(TaskSetManagerViewModel.Progress):
                BarProgress.Value = _vm.Progress;
                break;
            case nameof(TaskSetManagerViewModel.StatusText):
                RenderStatus();
                break;
        }
    }

    private void SyncSetSelection()
    {
        _syncingSelection = true;
        LstSets.SelectedItem = _vm.Sets.FirstOrDefault(r => ReferenceEquals(r.Set, _vm.Set));
        _syncingSelection = false;
    }

    private void SyncTargetSelection()
    {
        _syncingSelection = true;
        LstTargets.SelectedItem = _vm.Targets.FirstOrDefault(r => ReferenceEquals(r.Target, _vm.Target));
        _syncingSelection = false;
    }

    private void RenderAll()
    {
        RenderTargetHeader();
        RenderGlobalAug();
        RenderOverride();
        RenderSynthesis();
        RenderIssuesState();
        RenderPreview();
        RenderResult();
        RenderStatus();
        UpdateEnabled();
    }

    private void RenderStatus()
    {
        ChipStatus.SetResourceReference(StyleProperty, _vm.StatusStyle);
        TxtStatusChip.Text = _vm.StatusText;
    }

    private void UpdateEnabled()
    {
        bool hasSet = _vm.Set != null;
        bool idle = _vm.IsIdle;
        MainArea.IsEnabled = idle;
        BtnValidate.IsEnabled = hasSet && idle;
        BtnPreview.IsEnabled = hasSet && idle;
        BtnNextSample.IsEnabled = hasSet && idle && _vm.Preview != null;
        BtnGenerate.IsEnabled = hasSet && idle;
        BtnTrain.IsEnabled = hasSet && idle;
        BtnCancel.IsEnabled = _vm.CanCancel;
        _extract?.SetAddBlocked(_vm.IsGenerating);
        BtnOpenDataset.IsEnabled = _vm.Result != null && Directory.Exists(_vm.Result.DatasetDir);
        BtnUndo.IsEnabled = idle && _vm.CanUndo;
        BtnSetRename.IsEnabled = hasSet;
        BtnSetDuplicate.IsEnabled = hasSet;
        BtnSetDelete.IsEnabled = hasSet;
        TxtDescription.IsEnabled = hasSet;
        CardTargets.IsEnabled = hasSet;
        CardRight.IsEnabled = hasSet;
        CardTarget.IsEnabled = _vm.Target != null;
        int idx = _vm.TargetIndex;
        BtnTargetRename.IsEnabled = idx >= 0;
        BtnTargetDelete.IsEnabled = idx >= 0;
        BtnTargetUp.IsEnabled = idx > 0;
        BtnTargetDown.IsEnabled = idx >= 0 && idx < _vm.Targets.Count - 1;
        BtnTargetImportTree.IsEnabled = hasSet;
        BtnTargetImportSet.IsEnabled = hasSet && _vm.Sets.Count > 1;
        BtnDatasetOpen.IsEnabled = LstDatasets.SelectedItem != null;
        BtnDatasetDelete.IsEnabled = LstDatasets.SelectedItem != null;
        BtnDatasetTrain.IsEnabled = LstDatasets.SelectedItem is TaskSetDatasetRow { DataYamlPath: not null };
        BtnRunOpen.IsEnabled = LstRuns.SelectedItem != null;
        BtnRunDelete.IsEnabled = LstRuns.SelectedItem != null;
        BtnRunTest.IsEnabled = LstRuns.SelectedItem != null;
        BtnHoldoutRemove.IsEnabled = LstHoldouts.SelectedItem != null;
        CommandManager.InvalidateRequerySuggested();
    }

    // ---------- dialogs ----------

    private void Warn(string text) => MessageBox.Show(this, text, Title, MessageBoxButton.OK, MessageBoxImage.Warning);

    private bool Confirm(string text) =>
        MessageBox.Show(this, text, T(I18nKeys.YoloTaskSetConfirmTitle), MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;

    private string? AskName(string titleKey, string promptKey, string initial)
    {
        var name = AnnotatorInputDialog.Ask(this, T(titleKey), T(promptKey), initial)?.Trim();
        return string.IsNullOrEmpty(name) ? null : name;
    }

    // ---------- task sets ----------

    private async Task SelectSetAsync(TaskSet set)
    {
        if (ReferenceEquals(set, _vm.Set)) return;
        if (!ReleaseExtractorFor(set.Id))
        {
            SyncSetSelection();
            return;
        }
        await _vm.SelectSetAsync(set);
    }

    /// <summary>Before switching to another task set: close the extractor through its pending-crop guard; false = the user kept it.</summary>
    private bool ReleaseExtractorFor(string? setId) => _extract == null || _extractSet?.Id == setId || _extract.RequestClose();

    /// <summary>A reloaded instance of the same set keeps the extractor and its pending crops; another set closes it.</summary>
    private void SyncExtractorSet()
    {
        if (_extract == null || ReferenceEquals(_extractSet, _vm.Set)) return;
        if (_vm.Set is { } set && set.Id == _extractSet?.Id)
        {
            _extract.Rebind(set);
            _extractSet = set;
        }
        else
        {
            _extract.Close();
        }
    }

    private async Task CreateSetAsync()
    {
        if (AskName(I18nKeys.YoloTaskSetSetNew, I18nKeys.YoloTaskSetSetNamePrompt, T(I18nKeys.YoloTaskSetSetDefaultName)) is not { } name || !ReleaseExtractorFor(null)) return;
        await _vm.CreateSetAsync(name);
    }

    private async Task RenameSetAsync()
    {
        if (_vm.Set is not { } set) return;
        if (AskName(I18nKeys.YoloTaskSetSetRename, I18nKeys.YoloTaskSetSetNamePrompt, set.Name) is not { } name) return;
        await _vm.RenameSetAsync(name);
    }

    private async Task DuplicateSetAsync()
    {
        if (_vm.Set is not { } set) return;
        var initial = T(I18nKeys.YoloTaskSetSetDuplicateName).Replace("{name}", set.Name);
        if (AskName(I18nKeys.YoloTaskSetSetDuplicate, I18nKeys.YoloTaskSetSetNamePrompt, initial) is not { } name || !ReleaseExtractorFor(null)) return;
        await _vm.DuplicateSetAsync(name);
    }

    private async Task DeleteSetAsync()
    {
        if (_vm.Set is not { } set) return;
        if (!Confirm(T(I18nKeys.YoloTaskSetSetDeleteConfirm).Replace("{name}", set.Name)) || !ReleaseExtractorFor(null)) return;
        await _vm.DeleteSetAsync();
    }

    // ---------- targets ----------

    private void RenderTargetHeader()
    {
        LblTargetName.Text = _vm.TargetTitle(_vm.Target);
        RenderIpt();
    }

    private async Task AddTargetAsync()
    {
        if (_vm.Set is not { } set) return;
        var initial = T(I18nKeys.YoloTaskSetTargetDefaultName).Replace("{number}", N(set.Targets.Count + 1));
        if (AskName(I18nKeys.YoloTaskSetTargetAdd, I18nKeys.YoloTaskSetTargetNamePrompt, initial) is not { } name) return;
        await _vm.AddTargetAsync(name);
    }

    private async Task RenameTargetAsync()
    {
        if (_vm.Target is not { } target) return;
        if (AskName(I18nKeys.YoloTaskSetTargetRename, I18nKeys.YoloTaskSetTargetNamePrompt, target.Name) is not { } name) return;
        await _vm.RenameTargetAsync(name);
        RenderTargetHeader();
    }

    private async Task DeleteTargetAsync()
    {
        if (_vm.Target is not { } target) return;
        if (!Confirm(T(I18nKeys.YoloTaskSetTargetDeleteConfirm).Replace("{name}", target.Name))) return;
        await _vm.DeleteTargetAsync();
    }

    private void SetIptInherit(bool inherit)
    {
        if (_rendering || _vm.Target == null || _vm.Set == null) return;
        _vm.SetImagesPerTarget(inherit ? null : _vm.Set.Synthesis.ImagesPerTarget);
        RenderIpt();
    }

    private void CommitIpt()
    {
        if (_vm.Target?.ImagesPerTarget == null) return;
        if (TaskSetFields.Parse(TaskSetFieldKind.Int, TxtIpt.Text) is int v) _vm.SetImagesPerTarget(v);
        RenderIpt();
    }

    private void RenderIpt()
    {
        _rendering = true;
        bool inherit = _vm.Target?.ImagesPerTarget == null;
        ChkIptInherit.IsChecked = inherit;
        TxtIpt.IsEnabled = !inherit;
        int global = _vm.Set?.Synthesis.ImagesPerTarget ?? 0;
        TxtIpt.Text = N(_vm.Target?.ImagesPerTarget ?? global);
        TxtIptGlobal.Text = T(I18nKeys.YoloTaskSetGlobalValue).Replace("{value}", N(global));
        _rendering = false;
    }

    // ---------- validate, preview, generate, train ----------

    private async Task OnIssueActionAsync(RoutedEventArgs e)
    {
        if (e.OriginalSource is not Button { DataContext: TaskSetIssueRow { Hit: { } hit } row, Tag: string action }) return;
        e.Handled = true;
        switch (action)
        {
            case IssueActionLabel:
                _vm.ResolveHit(row, mask: false);
                break;
            case IssueActionMask:
                _vm.ResolveHit(row, mask: true);
                break;
            case IssueActionShow:
                var path = _vm.HitImagePath(hit);
                var image = await Task.Run(() => BitmapDecode.TryFromFile(path));
                if (image == null)
                {
                    Warn(T(I18nKeys.YoloTaskSetImageUnreadable).Replace("{name}", System.IO.Path.GetFileName(path)));
                    return;
                }
                TaskSetRegionEditor.View(this, row.Text, T(I18nKeys.YoloTaskSetHitHint), image,
                    new[] { new AnnotationBox(hit.TargetName, hit.X, hit.Y, hit.X + hit.Width, hit.Y + hit.Height) });
                break;
        }
    }

    private void RenderIssuesState() =>
        TxtValidationState.Text = _vm.Issues == null ? T(I18nKeys.YoloTaskSetValidationNone)
            : _vm.Issues.Count == 0 ? T(I18nKeys.YoloTaskSetValidationOk) : "";

    private async Task PreviewAsync(bool reset)
    {
        if (!_vm.IsIdle) return;
        bool ok = await _vm.PreviewAsync(reset);
        TabsRight.SelectedItem = ok ? TabPreview : TabValidation;
        if (!ok) Warn(T(I18nKeys.YoloTaskSetPreviewBlocked));
    }

    private void RenderPreview()
    {
        CanvasBoxes.Children.Clear();
        if (_vm.Preview is not { } preview || _vm.PreviewImage is not { } image)
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
        TxtPreviewInfo.Text = _vm.Preview == null ? T(I18nKeys.YoloTaskSetPreviewNone)
            : T(I18nKeys.YoloTaskSetPreviewInfo)
                .Replace("{seed}", N(_vm.PreviewSeed))
                .Replace("{boxes}", N(_vm.Preview.Boxes.Count));

    private async Task GenerateAsync()
    {
        if (!_vm.IsIdle || _vm.Set == null) return;
        TabsRight.SelectedItem = TabGenerate;
        if (!await _vm.GenerateAsync())
        {
            TabsRight.SelectedItem = TabValidation;
            Warn(T(I18nKeys.YoloTaskSetGenerateBlocked));
        }
    }

    private void RenderResult()
    {
        if (_vm.Result is not { } r)
        {
            TxtResult.Text = T(I18nKeys.YoloTaskSetGenerateNone);
            return;
        }
        var sb = new StringBuilder();
        sb.AppendLine(T(I18nKeys.YoloTaskSetResultSummary)
            .Replace("{train}", N(r.TrainImages))
            .Replace("{val}", N(r.ValImages))
            .Replace("{negative}", N(r.NegativeImages)));
        foreach (var cls in r.Classes)
            sb.AppendLine(T(I18nKeys.YoloTaskSetResultInstances)
                .Replace("{name}", cls)
                .Replace("{count}", N(r.Instances.TryGetValue(cls, out var n) ? n : 0)));
        if (r.Warnings.Count > 0)
        {
            sb.AppendLine(T(I18nKeys.YoloTaskSetResultWarnings));
            foreach (var w in r.Warnings) sb.AppendLine(LinePrefix + TaskSetIssueFormatter.Text(w));
        }
        sb.Append(T(I18nKeys.YoloTaskSetResultDir).Replace("{path}", r.DatasetDir));
        TxtResult.Text = sb.ToString();
    }

    private async Task TrainAsync()
    {
        if (_vm.Set is not { } set || !_vm.IsIdle) return;
        var issues = await _vm.ValidateAsync();
        if (issues == null) return;
        if (issues.Any(i => i.IsError))
        {
            TabsRight.SelectedItem = TabValidation;
            Warn(T(I18nKeys.YoloTaskSetTrainBlocked));
            return;
        }
        await _vm.FlushSaveAsync();
        YoloTrainingWindow.ShowForTaskSet(this, set.Id, autoStart: true);
    }
}
