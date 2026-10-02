// PY-REF: pyapps/d3-check/ui/panels/coordinate_calibration_panel.py
// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.ViewModels;
using DotApps.d3d4tester.Windows;
using DotCore.Common;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.VocAnnotator;
using DotCore.YoloRecord;

namespace DotApps.d3d4tester.Pages.Calibration;

/// <summary>
/// Calibration tab: client type, YOLO record/project/segment management, train flow, record log.
/// 1:1 Python pyapps/d3-check/ui/panels/coordinate_calibration_panel.py (YOLO data panel variant; the history-panel fallback is not used because the YOLO lib is always present).
/// Fixes Python bug: the top "Open label" button called flow3_open_label_tool without images_dir and always failed; it now opens the latest segment frames.
/// </summary>
public partial class CalibrationPage : UserControl
{
    private const int StartSegmentDelayMs = 800;
    private const string LogPrefix = "[YOLO_RECORD] ";
    private const string StepDone = "●";
    private const string StepPending = "○";
    private const string EmptyCell = "-";
    private const string SizeFormat = "{0:F1} MB";
    private const string PlaceholderLabel = "{label}";
    private const string PlaceholderCount = "{count}";
    private const string PlaceholderAdded = "{added}";
    private const string PlaceholderTotal = "{total}";
    private const string ImageFilterPattern = "*.png;*.jpg;*.jpeg;*.bmp";
    private const string AllFilesPattern = "*.*";
    private const string StyleButton = "CalButton";
    private const string StyleSuccessButton = "CalSuccessButton";
    private const string StyleDangerButton = "CalDangerButton";

    private readonly YoloCalibrationData _yoloData = new();
    private readonly YoloRecordService _recorder = new();
    private readonly ObservableCollection<YoloSegmentRow> _rows = new();
    private readonly ContextMenu _patchMenu = new();
    private readonly MenuItem _patchMenuOne = new();
    private readonly MenuItem _patchMenuFolder = new();
    private YoloSegmentRow? _contextRow;
    private bool _initialized;
    private bool _suppressEvents;

    public CalibrationPage()
    {
        InitializeComponent();
        DataContext = new CalibrationViewModel();
        Loaded += CalibrationPage_Loaded;
        Unloaded += CalibrationPage_Unloaded;
    }

    private static II18nProvider I18n => D3D4TesterI18n.Provider;

    private static string T(string key) => I18n.GetUiText(key);

    private void CalibrationPage_Loaded(object sender, RoutedEventArgs e)
    {
        I18n.LanguageChanged += OnLanguageChanged;
        if (_initialized) return;
        _initialized = true;
        DgYoloSegments.ItemsSource = _rows;
        _yoloData.LoadFromConfig();
        _suppressEvents = true;
        if (_yoloData.ClientType == AppConstants.ClientTypeD3Game) RadioD3Game.IsChecked = true;
        else if (_yoloData.ClientType == AppConstants.ClientTypeD4Game) RadioD4Game.IsChecked = true;
        else RadioBattlenet.IsChecked = true;
        _suppressEvents = false;
        BindEvents();
        RefreshI18n();
        RefreshYoloDataTable();
    }

    private void CalibrationPage_Unloaded(object sender, RoutedEventArgs e) => I18n.LanguageChanged -= OnLanguageChanged;

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(RefreshI18n);

    private void BindEvents()
    {
        RadioBattlenet.Checked += (_, _) => OnClientTypeChange(AppConstants.ClientTypeBattlenet);
        RadioD3Game.Checked += (_, _) => OnClientTypeChange(AppConstants.ClientTypeD3Game);
        RadioD4Game.Checked += (_, _) => OnClientTypeChange(AppConstants.ClientTypeD4Game);
        BtnCapture.Click += (_, _) => OnCaptureScreenshot();
        BtnYoloConfig.Click += (_, _) => OnRecordConfig();
        BtnYoloRecordToggle.Click += async (_, _) => await OnRecordToggleAsync();
        BtnYoloFlowOpenLabel.Click += async (_, _) => await OpenLabelAsync(null, useSelection: false);
        BtnYoloImportPatch.Click += (_, _) => ShowPatchMenu(BtnYoloImportPatch);
        BtnYoloImportPatchToolbar.Click += (_, _) => ShowPatchMenu(BtnYoloImportPatchToolbar);
        BtnYoloCleanUnlabeled.Click += (_, _) => OnCleanUnlabeled();
        BtnYoloTrain.Click += async (_, _) => await OnTrainAsync();
        CboYoloProject.SelectionChanged += (_, _) => OnProjectSwitch();
        BtnYoloLoadProject.Click += (_, _) => OnProjectLoad();
        BtnYoloCreateProject.Click += (_, _) => OnProjectCreate();
        BtnYoloOpenProjectDir.Click += (_, _) => OnOpenProjectDir();
        BtnYoloRefresh.Click += (_, _) => { RefreshYoloDataTable(); AppendLog(T(I18nKeys.CoordCalYoloDataRefreshed)); };
        BtnYoloExportSelected.Click += async (_, _) => await OnExportSelectedAsync();
        BtnYoloOpenLabel.Click += async (_, _) => await OpenLabelAsync(null, useSelection: true);
        BtnYoloMerge.Click += async (_, _) => await OnMergeSelectedAsync();
        BtnYoloDelete.Click += (_, _) => OnDeleteSelected();
        BtnExportGameFrames.Click += async (_, _) => await OnExportGameFramesAsync();
        BtnOpenRecordDir.Click += (_, _) => OnOpenRecordDir();
        DgYoloSegments.PreviewMouseRightButtonDown += DgYoloSegments_PreviewMouseRightButtonDown;
        SegmentContextMenu.Opened += (_, _) => MiSegmentDelete.IsEnabled = !_recorder.IsRecording;
        DgYoloSegments.ContextMenuOpening += (_, e) => { if (_contextRow == null || _contextRow.IsPatch) e.Handled = true; };
        MiSegmentOpenFolder.Click += (_, _) => { if (_contextRow != null) YoloSegmentLayout.OpenDir(_contextRow.SegmentPath); };
        MiSegmentExportFrames.Click += async (_, _) => await OnSegmentExportFramesAsync();
        MiSegmentOpenLabel.Click += async (_, _) => { if (_contextRow != null) await OpenLabelAsync(_contextRow.SegmentPath, useSelection: false); };
        MiSegmentDelete.Click += (_, _) => OnSegmentDelete();
        _patchMenuOne.Click += (_, _) => OnPatchImport(oneFile: true);
        _patchMenuFolder.Click += (_, _) => OnPatchImport(oneFile: false);
        _patchMenu.Items.Add(_patchMenuOne);
        _patchMenu.Items.Add(_patchMenuFolder);
    }

    /// <summary>Re-apply all localized texts.</summary>
    public void RefreshI18n()
    {
        LblClientMode.Text = T(I18nKeys.CoordCalClientMode);
        RadioBattlenet.Content = T(I18nKeys.CoordCalClientBattlenet);
        RadioD3Game.Content = T(I18nKeys.CoordCalClientD3Game);
        RadioD4Game.Content = T(I18nKeys.CoordCalClientD4Game);
        BtnCapture.Content = T(I18nKeys.CoordCalCaptureButton);
        TxtYoloTitle.Text = T(I18nKeys.CoordCalYoloDataTitle);
        BtnYoloConfig.Content = T(I18nKeys.CoordCalYoloRecordConfig);
        BtnYoloFlowOpenLabel.Content = T(I18nKeys.CoordCalYoloFlowOpenLabel);
        BtnYoloImportPatch.Content = T(I18nKeys.CoordCalYoloPatchImport);
        BtnYoloImportPatchToolbar.Content = T(I18nKeys.CoordCalYoloPatchImport);
        BtnYoloCleanUnlabeled.Content = T(I18nKeys.CoordCalYoloFlowCleanUnlabeled);
        BtnYoloTrain.Content = T(I18nKeys.CoordCalYoloFlowTrain);
        LblYoloProject.Text = T(I18nKeys.CoordCalYoloDataProjectLabel);
        BtnYoloLoadProject.Content = T(I18nKeys.CoordCalYoloProjectLoad);
        BtnYoloCreateProject.Content = T(I18nKeys.CoordCalYoloProjectCreate);
        BtnYoloOpenProjectDir.Content = T(I18nKeys.CoordCalYoloDataOpenProject);
        ColTimestamp.Header = T(I18nKeys.CoordCalYoloDataColTimestamp);
        ColFrames.Header = T(I18nKeys.CoordCalYoloDataColFrames);
        ColStatus.Header = T(I18nKeys.CoordCalYoloDataColStatus);
        ColSize.Header = T(I18nKeys.CoordCalYoloDataColSize);
        MiSegmentOpenFolder.Header = T(I18nKeys.CoordCalYoloSegmentOpenFolder);
        MiSegmentExportFrames.Header = T(I18nKeys.CoordCalYoloSegmentExportFrames);
        MiSegmentOpenLabel.Header = T(I18nKeys.CoordCalYoloSegmentOpenLabel);
        MiSegmentDelete.Header = T(I18nKeys.CoordCalYoloSegmentDelete);
        _patchMenuOne.Header = T(I18nKeys.CoordCalYoloPatchImportOne);
        _patchMenuFolder.Header = T(I18nKeys.CoordCalYoloPatchImportFolder);
        BtnYoloRefresh.Content = T(I18nKeys.CoordCalYoloDataRefresh);
        BtnYoloExportSelected.Content = T(I18nKeys.CoordCalYoloDataExportSelected);
        BtnYoloOpenLabel.Content = T(I18nKeys.CoordCalYoloDataOpenLabel);
        BtnYoloMerge.Content = T(I18nKeys.CoordCalYoloDataMergeSelected);
        BtnYoloDelete.Content = T(I18nKeys.CoordCalYoloDataDeleteSelected);
        TxtRecordLogTitle.Text = T(I18nKeys.CoordCalYoloRecordLogTitle);
        BtnExportGameFrames.Content = T(I18nKeys.CoordCalYoloRecordExportFrames);
        BtnOpenRecordDir.Content = T(I18nKeys.CoordCalYoloRecordOpenDir);
        UpdateRecordStatus();
        if (_initialized)
            RefreshYoloDataTable(logWhenEmpty: false);
    }

    private void OnClientTypeChange(string clientType)
    {
        if (_suppressEvents) return;
        _yoloData.SetClientType(clientType);
        UpdateRecordStatus();
        UpdateProjectDropdown();
        RefreshYoloDataTable();
    }

    private void AppendLog(string text)
    {
        TxtRecordLog.AppendText((TxtRecordLog.Text.Length > 0 ? "\n" : "") + text);
        TxtRecordLog.ScrollToEnd();
        ColorPrinter.Blue(LogPrefix + text);
    }

    private string? CurrentProject() => _yoloData.GetCurrentProject();

    private List<string> SelectedSegmentPaths() =>
        DgYoloSegments.SelectedItems.OfType<YoloSegmentRow>().Where(r => !r.IsPatch).Select(r => r.SegmentPath).ToList();

    private void RefreshYoloDataTable(bool logWhenEmpty = true)
    {
        _rows.Clear();
        var project = CurrentProject();
        UpdateProjectDropdown();
        if (project == null)
        {
            UpdateWorkflowBar(Array.Empty<YoloSegmentLayout.SegmentInfo>());
            return;
        }
        var (_, patchItems) = PatchData.LoadPatchData(Path.Combine(project, ProjectConfig.AnnotatorConfigFileName));
        _rows.Add(new YoloSegmentRow
        {
            IsPatch = true,
            Timestamp = T(I18nKeys.CoordCalYoloPatchRowFormat)
                .Replace(PlaceholderLabel, T(I18nKeys.CoordCalYoloPatchRowLabel))
                .Replace(PlaceholderCount, patchItems.Count.ToString()),
            Frames = EmptyCell,
            Status = EmptyCell,
            Size = EmptyCell,
        });
        var infos = new List<YoloSegmentLayout.SegmentInfo>();
        foreach (var (segmentId, segmentPath) in YoloSegmentLayout.ListSegments(project))
        {
            var info = YoloSegmentLayout.GetSegmentInfo(segmentPath);
            infos.Add(info);
            _rows.Add(new YoloSegmentRow
            {
                SegmentId = segmentId,
                SegmentPath = segmentPath,
                Timestamp = segmentId,
                Frames = info.FramesCount > 0 ? info.FramesCount.ToString() : (info.HasVideo ? T(I18nKeys.CoordCalYoloFramesVideo) : EmptyCell),
                StatusKey = info.Status,
                Status = StatusText(info.Status),
                Size = info.SizeMb > 0 ? string.Format(SizeFormat, info.SizeMb) : EmptyCell,
            });
        }
        if (infos.Count == 0 && logWhenEmpty)
            AppendLog(T(I18nKeys.CoordCalYoloDataNoSegments));
        UpdateWorkflowBar(infos);
    }

    private static string StatusText(string status) => status switch
    {
        YoloSegmentLayout.StatusLabeled => T(I18nKeys.CoordCalYoloStatusLabeled),
        YoloSegmentLayout.StatusExported => T(I18nKeys.CoordCalYoloStatusExported),
        YoloSegmentLayout.StatusRaw => T(I18nKeys.CoordCalYoloStatusRaw),
        _ => status,
    };

    private void UpdateWorkflowBar(IReadOnlyCollection<YoloSegmentLayout.SegmentInfo> infos)
    {
        var total = infos.Count;
        var exported = infos.Count(i => i.HasFrames);
        var labeled = infos.Count(i => i.Status == YoloSegmentLayout.StatusLabeled);
        TxtWorkflowStep1.Text = StepText(I18nKeys.CoordCalYoloWorkflowStep1, total);
        TxtWorkflowStep2.Text = StepText(I18nKeys.CoordCalYoloWorkflowStep2, exported);
        TxtWorkflowStep3.Text = StepText(I18nKeys.CoordCalYoloWorkflowStep3, labeled);
    }

    private static string StepText(string key, int count) => $"{T(key)}  {(count > 0 ? StepDone : StepPending)} {count}";

    private void UpdateRecordStatus()
    {
        if (_recorder.IsRecording)
        {
            BtnYoloRecordToggle.Content = T(I18nKeys.CoordCalYoloRecordStop);
            BtnYoloRecordToggle.SetResourceReference(StyleProperty, StyleDangerButton);
            return;
        }
        var online = _yoloData.FindClientWindow() != IntPtr.Zero;
        BtnYoloRecordToggle.Content = T(online ? I18nKeys.CoordCalYoloRecordStart : I18nKeys.CoordCalYoloRecordStartNeedWindow);
        BtnYoloRecordToggle.SetResourceReference(StyleProperty, online ? StyleSuccessButton : StyleButton);
    }

    private void UpdateProjectDropdown()
    {
        var project = CurrentProject();
        var paths = _yoloData.GetDropdownProjectPaths();
        if (project != null && !paths.Any(p => string.Equals(p, project, StringComparison.OrdinalIgnoreCase)))
            paths.Insert(0, project);
        _suppressEvents = true;
        CboYoloProject.Items.Clear();
        foreach (var p in paths)
            CboYoloProject.Items.Add(new YoloProjectItem { Display = YoloCalibrationData.ShortProjectPathDisplay(p), Path = p });
        CboYoloProject.SelectedIndex = project == null ? -1 : paths.FindIndex(p => string.Equals(p, project, StringComparison.OrdinalIgnoreCase));
        CboYoloProject.ToolTip = project ?? T(I18nKeys.CoordCalYoloDataNoProject);
        _suppressEvents = false;
    }

    private void OnProjectSwitch()
    {
        if (_suppressEvents || CboYoloProject.SelectedItem is not YoloProjectItem item || !Directory.Exists(item.Path)) return;
        _yoloData.SetCurrentProject(item.Path);
        RefreshYoloDataTable();
    }

    private void OnProjectCreate()
    {
        try
        {
            var path = _yoloData.CreateProject();
            _yoloData.SetCurrentProject(path);
            _yoloData.AddProjectToCache(path);
            RefreshYoloDataTable();
            AppendLog(T(I18nKeys.CoordCalYoloProjectCreated) + path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            AppendLog(ex.Message);
        }
    }

    private void OnProjectLoad()
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.CoordCalYoloProjectLoadTitle) };
        if (dlg.ShowDialog(Window.GetWindow(this)) != true || !Directory.Exists(dlg.FolderName)) return;
        var path = Path.GetFullPath(dlg.FolderName);
        _yoloData.SetCurrentProject(path);
        _yoloData.AddProjectToCache(path);
        RefreshYoloDataTable();
        AppendLog(T(I18nKeys.CoordCalYoloProjectLoaded) + path);
    }

    private void OnOpenProjectDir()
    {
        var project = CurrentProject();
        if (project != null)
            YoloSegmentLayout.OpenRecordDirectory(project, openLatestSegment: false);
        else
            AppendLog(T(I18nKeys.CoordCalYoloDataNoProject));
    }

    private void OnRecordConfig()
    {
        var dlg = new RecordConfigDialog(YoloCalibrationData.RecordConfigPath) { Owner = Window.GetWindow(this) };
        dlg.ShowDialog();
    }

    private void OnCaptureScreenshot()
    {
        ColorPrinter.Blue($"[COORD_CALIBRATION] Capturing for client: {_yoloData.ClientType}...");
        var (screenshot, error) = Windows.CoordinatePicker.ClientWindowCapture.Capture(_yoloData.FindClientWindow);
        if (screenshot == null)
        {
            MessageBox.Show(Window.GetWindow(this), error ?? T(I18nKeys.CoordCalNoGameWindow), T(I18nKeys.CoordCalErrorTitle), MessageBoxButton.OK, MessageBoxImage.Warning);
            ColorPrinter.Yellow("[COORD_CALIBRATION] No window");
            return;
        }
        ColorPrinter.Green("[COORD_CALIBRATION] Captured in memory");
        CoordinatePickerWindow.ShowPicker(Window.GetWindow(this), screenshot, _yoloData.ClientType,
            () => Windows.CoordinatePicker.ClientWindowCapture.Capture(_yoloData.FindClientWindow));
    }

    private async Task OnRecordToggleAsync()
    {
        if (_recorder.IsRecording)
            await StopRecordAsync();
        else
            await StartRecordAsync();
    }

    private async Task StartRecordAsync()
    {
        AppendLog(T(I18nKeys.CoordCalYoloRecordStarting));
        var hwnd = _yoloData.FindClientWindow();
        if (hwnd == IntPtr.Zero)
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordErrorClientWindowRequired));
            return;
        }
        WindowInputHelper.SetForegroundWindow(hwnd);
        AppendLog(T(I18nKeys.CoordCalYoloRecordClientTopped));
        var cfg = YoloRecordConfig.Load(YoloCalibrationData.RecordConfigPath);
        var project = CurrentProject();
        if (project == null)
        {
            AppendLog(T(I18nKeys.CoordCalYoloDataNoProject));
            return;
        }
        _recorder.OnLog = msg => Dispatcher.InvokeAsync(() => AppendLog(msg));
        var (ok, err, projectPath) = _recorder.StartRecord(project, hwnd, cfg.FrameWidth, cfg.FrameHeight, cfg);
        if (!ok)
        {
            AppendLog(string.IsNullOrEmpty(err) ? T(I18nKeys.CoordCalYoloRecordStartFailed) : err);
            if (err == YoloRecordService.ErrorAlreadyRecording)
                AppendLog(T(I18nKeys.CoordCalYoloRecordAlready));
            else if (err == YoloRecordService.ErrorWindowsHwndRequired)
                AppendLog(T(I18nKeys.CoordCalYoloRecordErrorClientWindowRequired));
            return;
        }
        UpdateRecordStatus();
        _yoloData.LastRecordProjectPath = projectPath;
        if (projectPath != null)
            _yoloData.SetCurrentProject(projectPath);
        RefreshYoloDataTable(logWhenEmpty: false);
        AppendLog(T(I18nKeys.CoordCalYoloRecordStartOk));
        if (projectPath != null)
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordDirLabel) + projectPath);
            if (YoloSegmentLayout.OpenRecordDirectory(projectPath))
                AppendLog(T(I18nKeys.CoordCalYoloRecordOpenedDir));
        }
        await Task.Delay(StartSegmentDelayMs);
        if (_recorder.StartSegment())
            AppendLog(T(I18nKeys.CoordCalYoloRecordSegmentStarted));
    }

    private async Task StopRecordAsync()
    {
        await _recorder.StopRecordAsync();
        UpdateRecordStatus();
        AppendLog(T(I18nKeys.CoordCalYoloRecordStopOk));
        RefreshYoloDataTable();
        var project = CurrentProject();
        if (project == null) return;
        AppendLog(T(I18nKeys.CoordCalYoloRecordSegmentsInOutput) + YoloSegmentLayout.GetRecordOutputSubdir(project));
        if (YoloSegmentLayout.OpenRecordDirectory(project))
            AppendLog(T(I18nKeys.CoordCalYoloRecordOpenedDir));
        var (segmentDir, framesDir) = await Task.Run(() => YoloSegmentLayout.ContinueToLabeling(project));
        if (segmentDir != null)
        {
            if (framesDir != null)
            {
                YoloSegmentLayout.OpenDir(framesDir);
                AppendLog(T(I18nKeys.CoordCalYoloRecordFramesOpenedForLabel));
            }
            else
            {
                AppendLog(T(I18nKeys.CoordCalYoloRecordNoFramesInSegment));
            }
        }
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    private async Task OnExportSelectedAsync()
    {
        var paths = SelectedSegmentPaths();
        if (paths.Count == 0)
        {
            AppendLog(T(I18nKeys.CoordCalYoloDataSelectFirst));
            return;
        }
        string? firstFramesDir = null;
        foreach (var seg in paths)
        {
            var (ok, _, framesDir) = await Task.Run(() => YoloSegmentLayout.ComposeSegmentToFrames(seg));
            if (ok && framesDir != null && firstFramesDir == null)
                firstFramesDir = framesDir;
        }
        if (firstFramesDir != null)
            YoloSegmentLayout.OpenDir(firstFramesDir);
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    /// <summary>Open the VOC annotator on a segment's frames (explicit segment, else selected segment when useSelection, else latest segment), composing frames when missing.</summary>
    private async Task OpenLabelAsync(string? segmentPath, bool useSelection)
    {
        var project = CurrentProject();
        if (project == null || !Directory.Exists(project))
        {
            AppendLog(T(I18nKeys.CoordCalYoloDataNoProject));
            return;
        }
        if (segmentPath == null && useSelection)
            segmentPath = SelectedSegmentPaths().FirstOrDefault();
        segmentPath ??= YoloSegmentLayout.GetLatestSegmentDir(project);
        string? framesDir = null;
        if (segmentPath != null)
        {
            framesDir = Path.Combine(segmentPath, YoloSegmentLayout.FramesSubdir);
            if (!Directory.Exists(framesDir))
            {
                var (ok, _, composed) = await Task.Run(() => YoloSegmentLayout.ComposeSegmentToFrames(segmentPath));
                framesDir = ok ? composed : null;
            }
        }
        if (framesDir == null || !Directory.Exists(framesDir))
        {
            AppendLog(T(I18nKeys.CoordCalYoloFlowOpenLabelFailed));
            RefreshYoloDataTable(logWhenEmpty: false);
            return;
        }
        var win = new AnnotatorWindow(framesDir, framesDir, project) { Owner = Window.GetWindow(this) };
        win.Show();
        YoloSegmentLayout.OpenDir(framesDir);
        AppendLog(T(I18nKeys.CoordCalYoloFlowOpenLabel));
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    private async Task OnMergeSelectedAsync()
    {
        var paths = SelectedSegmentPaths();
        if (paths.Count == 0)
        {
            AppendLog(T(I18nKeys.CoordCalYoloDataSelectFirst));
            return;
        }
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.CoordCalYoloDataMergeTarget) };
        if (dlg.ShowDialog(Window.GetWindow(this)) != true || string.IsNullOrWhiteSpace(dlg.FolderName)) return;
        var target = dlg.FolderName;
        var (ok, msg, mergedDir) = await Task.Run(() => YoloSegmentLayout.MergeSegmentsToFolder(paths, target));
        if (ok && mergedDir != null)
            YoloSegmentLayout.OpenDir(mergedDir);
        AppendLog(string.IsNullOrEmpty(msg) ? T(I18nKeys.CoordCalYoloDataMerged) : msg);
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    private void OnDeleteSelected()
    {
        var paths = SelectedSegmentPaths();
        if (paths.Count == 0)
        {
            AppendLog(T(I18nKeys.CoordCalYoloDataSelectFirst));
            return;
        }
        if (_recorder.IsRecording)
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordDeleteWhileRecording));
            return;
        }
        var msg = T(I18nKeys.CoordCalYoloDataConfirmDeleteMultiple).Replace(PlaceholderCount, paths.Count.ToString());
        if (!Confirm(msg)) return;
        var failed = paths.Count(p => !YoloSegmentLayout.DeleteSegment(p).Ok);
        RefreshYoloDataTable(logWhenEmpty: false);
        AppendLog(failed == 0
            ? T(I18nKeys.CoordCalYoloSegmentDeleted)
            : T(I18nKeys.CoordCalYoloDataDeleteFailed).Replace(PlaceholderCount, failed.ToString()));
    }

    private void DgYoloSegments_PreviewMouseRightButtonDown(object sender, MouseButtonEventArgs e)
    {
        _contextRow = null;
        var dep = e.OriginalSource as DependencyObject;
        while (dep != null && dep is not DataGridRow)
            dep = System.Windows.Media.VisualTreeHelper.GetParent(dep);
        if (dep is DataGridRow row && row.Item is YoloSegmentRow item)
        {
            _contextRow = item;
            DgYoloSegments.SelectedItem = item;
        }
    }

    private async Task OnSegmentExportFramesAsync()
    {
        if (_contextRow == null) return;
        var seg = _contextRow.SegmentPath;
        await Task.Run(() => YoloSegmentLayout.ComposeSegmentToFrames(seg));
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    private void OnSegmentDelete()
    {
        if (_contextRow == null) return;
        if (!Confirm(T(I18nKeys.CoordCalYoloSegmentConfirmDelete))) return;
        var (ok, msg) = YoloSegmentLayout.DeleteSegment(_contextRow.SegmentPath);
        if (ok)
        {
            RefreshYoloDataTable(logWhenEmpty: false);
            AppendLog(T(I18nKeys.CoordCalYoloSegmentDeleted));
        }
        else
        {
            AppendLog(T(I18nKeys.CoordCalYoloSegmentDeleteFailed) + msg);
        }
    }

    private void ShowPatchMenu(Button anchor)
    {
        _patchMenu.PlacementTarget = anchor;
        _patchMenu.Placement = PlacementMode.Bottom;
        _patchMenu.IsOpen = true;
    }

    private void OnPatchImport(bool oneFile)
    {
        var project = CurrentProject();
        if (project == null)
        {
            AppendLog(T(I18nKeys.CoordCalYoloDataNoProject));
            return;
        }
        var owner = Window.GetWindow(this);
        string baseDir = "";
        var items = new List<(string File, string Name)>();
        if (oneFile)
        {
            var dlg = new Microsoft.Win32.OpenFileDialog
            {
                Title = T(I18nKeys.CoordCalYoloPatchImportOne),
                Filter = $"{T(I18nKeys.CoordCalYoloPatchImagesFilter)}|{ImageFilterPattern}|{T(I18nKeys.CoordCalYoloPatchAllFilesFilter)}|{AllFilesPattern}",
            };
            if (dlg.ShowDialog(owner) == true && File.Exists(dlg.FileName))
            {
                baseDir = Path.GetDirectoryName(dlg.FileName) ?? "";
                var name = Path.GetFileName(dlg.FileName);
                var stem = Path.GetFileNameWithoutExtension(name).Trim();
                items.Add((name, string.IsNullOrEmpty(stem) ? name : stem));
            }
        }
        else
        {
            var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.CoordCalYoloPatchImportFolder) };
            if (dlg.ShowDialog(owner) == true)
            {
                baseDir = dlg.FolderName;
                items = PatchData.LoadPatchDir(baseDir);
            }
        }
        if (items.Count == 0) return;
        var configPath = Path.Combine(project, ProjectConfig.AnnotatorConfigFileName);
        PatchData.AddPatchSource(configPath, baseDir, items);
        RefreshYoloDataTable(logWhenEmpty: false);
        var total = PatchData.GetPatchItemsFlat(configPath).Count;
        AppendLog(T(I18nKeys.CoordCalYoloPatchImportDone)
            .Replace(PlaceholderLabel, T(I18nKeys.CoordCalYoloPatchRowLabel))
            .Replace(PlaceholderAdded, items.Count.ToString())
            .Replace(PlaceholderTotal, total.ToString()));
    }

    /// <summary>Step 4 (optional): clean unlabeled in the latest segment frames. 1:1 _on_flow4_clean_unlabeled (with a confirm, since it deletes files).</summary>
    private void OnCleanUnlabeled()
    {
        var latest = YoloSegmentLayout.GetLatestSegmentDir(CurrentProject());
        var framesDir = latest == null ? null : Path.Combine(latest, YoloSegmentLayout.FramesSubdir);
        if (framesDir == null || !Directory.Exists(framesDir))
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordNoSegment));
            return;
        }
        if (!Confirm(T(I18nKeys.CoordCalYoloFlowCleanConfirm))) return;
        var (ok, msg) = YoloTrainFlow.Flow4CleanUnlabeled(framesDir);
        AppendLog(ok ? T(I18nKeys.CoordCalYoloFlowCleanDone) : (string.IsNullOrEmpty(msg) ? T(I18nKeys.CoordCalYoloFlowCleanFailed) : msg));
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    /// <summary>Steps 5-6: prepare images/labels/data.yaml in the selected (or latest) segment and launch Ultralytics training.</summary>
    private async Task OnTrainAsync()
    {
        var project = CurrentProject();
        var segment = SelectedSegmentPaths().FirstOrDefault() ?? YoloSegmentLayout.GetLatestSegmentDir(project);
        var framesDir = segment == null ? null : Path.Combine(segment, YoloSegmentLayout.FramesSubdir);
        if (project == null || segment == null || framesDir == null || !Directory.Exists(framesDir))
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordNoSegment));
            return;
        }
        var classes = ProjectConfig.GetClassesFromProjectDir(project);
        var (ok, msg, yamlPath) = await Task.Run(() => YoloTrainFlow.PrepareTrainingDir(segment, framesDir, framesDir, classes));
        if (!ok || yamlPath == null)
        {
            AppendLog(T(I18nKeys.CoordCalYoloFlowPrepareFailed) + msg);
            return;
        }
        AppendLog(T(I18nKeys.CoordCalYoloFlowPrepareOk) + msg);
        var (started, trainMsg, _) = YoloTrainFlow.Flow6StartTrain(yamlPath);
        AppendLog((started ? T(I18nKeys.CoordCalYoloFlowTrainStarted) : T(I18nKeys.CoordCalYoloFlowTrainFailed)) + trainMsg);
    }

    /// <summary>Record-log button: step 2 export latest segment frames. 1:1 _on_flow2_export_frames.</summary>
    private async Task OnExportGameFramesAsync()
    {
        var project = CurrentProject();
        if (project == null)
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordNoDirYet));
            return;
        }
        var (ok, msg, framesDir) = await Task.Run(() => YoloSegmentLayout.ExportLatestSegmentFrames(project));
        if (ok)
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordExportFramesOk) + msg);
            if (framesDir != null)
                YoloSegmentLayout.OpenDir(framesDir);
        }
        else
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordExportFramesFailed) + msg);
        }
        RefreshYoloDataTable(logWhenEmpty: false);
    }

    private void OnOpenRecordDir()
    {
        var project = CurrentProject();
        if (project == null)
        {
            AppendLog(T(I18nKeys.CoordCalYoloRecordNoDirYet));
            return;
        }
        if (YoloSegmentLayout.OpenRecordDirectory(project))
            AppendLog(T(I18nKeys.CoordCalYoloRecordOpenedDir));
    }

    private bool Confirm(string message) =>
        MessageBox.Show(Window.GetWindow(this), message, T(I18nKeys.CoordCalConfirmTitle), MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;
}

public class YoloProjectItem
{
    public string Display { get; set; } = "";
    public string Path { get; set; } = "";
}

public class YoloSegmentRow
{
    public string SegmentId { get; set; } = "";
    public string SegmentPath { get; set; } = "";
    public string Timestamp { get; set; } = "";
    public string Frames { get; set; } = "";
    public string Status { get; set; } = "";
    public string StatusKey { get; set; } = "";
    public string Size { get; set; } = "";
    public bool IsPatch { get; set; }
}
