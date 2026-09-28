using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Services;
using DotApps.d3check.Windows;
using DotApps.d3check.Core.Battlenet;
using DotApps.d3check.ViewModels;
using DotCore.YoloRecord;

namespace DotApps.d3check.Pages.Calibration;

public partial class CalibrationPage : UserControl
{
    private readonly YoloCalibrationData _yoloData = new();
    private readonly YoloRecordService _yoloRecordService = new();
    private ObservableCollection<YoloSegmentRow>? _segmentRows;

    public CalibrationPage()
    {
        InitializeComponent();
        DataContext = new CalibrationViewModel();
        Loaded += CalibrationPage_Loaded;
    }

    private void CalibrationPage_Loaded(object sender, RoutedEventArgs e)
    {
        _segmentRows = DgYoloSegments.ItemsSource as ObservableCollection<YoloSegmentRow>;
        if (_segmentRows == null)
        {
            _segmentRows = new ObservableCollection<YoloSegmentRow>();
            DgYoloSegments.ItemsSource = _segmentRows;
        }
        LoadCoordCalibrationFromConfig();
        BindYoloButtons();
    }

    private void BindYoloButtons()
    {
        RadioBattlenet.Checked += (_, _) => SaveClientType(AppConstants.ClientTypeBattlenet);
        RadioD3Game.Checked += (_, _) => SaveClientType(AppConstants.ClientTypeD3Game);
        RadioD4Game.Checked += (_, _) => SaveClientType(AppConstants.ClientTypeD4Game);
        CboYoloProject.SelectionChanged += (_, _) => OnProjectSelectionChanged();
        BtnYoloRecordStart.Click += (_, _) => _ = StartRecordAsync();
        BtnYoloRecordStop.Click += (_, _) => _ = StopRecordAsync();
        BtnYoloRefresh.Click += (_, _) => _ = RefreshSegmentsAsync();
        BtnYoloExportSelected.Click += (_, _) => _ = ExportSelectedAsync();
        BtnYoloDelete.Click += (_, _) => _ = DeleteSelectedAsync();
        BtnYoloCreateProject.Click += (_, _) => CreateProject();
        BtnYoloOpenProjectDir.Click += (_, _) => OpenProjectDir();
        BtnYoloConfig.Click += (_, _) => ShowYoloConfig();
        BtnYoloImportPatch.Click += (_, _) => ImportPatch();
        if (BtnYoloImportPatchToolbar != null) BtnYoloImportPatchToolbar.Click += (_, _) => ImportPatch();
    }

    private void SaveClientType(string clientType)
    {
        _yoloData.SetClientType(clientType);
        D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.CoordCalibrationClientType, clientType);
    }

    private void LoadCoordCalibrationFromConfig()
    {
        _yoloData.LoadFromConfig();
        _yoloData.RefreshProjectListFromDisk();
        var client = _yoloData.ClientType;
        if (client == AppConstants.ClientTypeD3Game) RadioD3Game.IsChecked = true;
        else if (client == AppConstants.ClientTypeD4Game) RadioD4Game.IsChecked = true;
        else RadioBattlenet.IsChecked = true;

        CboYoloProject.Items.Clear();
        foreach (var path in _yoloData.ProjectList)
        {
            if (string.IsNullOrWhiteSpace(path)) continue;
            var name = Path.GetFileName(path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)) ?? path;
            CboYoloProject.Items.Add(new YoloProjectItem { Display = name, Path = path });
        }
        var current = _yoloData.CurrentProjectPath;
        if (!string.IsNullOrWhiteSpace(current))
        {
            for (int i = 0; i < CboYoloProject.Items.Count; i++)
            {
                if (CboYoloProject.Items[i] is YoloProjectItem item && string.Equals(item.Path, current, StringComparison.OrdinalIgnoreCase))
                {
                    CboYoloProject.SelectedIndex = i;
                    break;
                }
            }
        }
        if (CboYoloProject.SelectedIndex < 0 && CboYoloProject.Items.Count > 0)
            CboYoloProject.SelectedIndex = 0;
        _yoloData.RefreshSegmentListFromDisk();
        RefreshSegmentRowsFromYoloData();
    }

    private void RefreshSegmentRowsFromYoloData()
    {
        if (_segmentRows == null) return;
        _segmentRows.Clear();
        foreach (var (segmentId, segmentPath) in _yoloData.Segments)
        {
            var (frames, status, sizeMb) = YoloCalibrationData.GetSegmentInfoFromDisk(segmentPath);
            _segmentRows.Add(new YoloSegmentRow
            {
                SegmentId = segmentId,
                SegmentPath = segmentPath,
                Timestamp = segmentId,
                Frames = frames,
                Status = status,
                Size = $"{sizeMb:F1} MB"
            });
        }
    }

    private List<string> GetProjectListFromConfig()
    {
        return _yoloData.ProjectList.ToList();
    }

    private void OnProjectSelectionChanged()
    {
        if (CboYoloProject.SelectedItem is YoloProjectItem item)
        {
            _yoloData.SetCurrentProject(item.Path);
            _yoloData.SaveToConfig();
            _ = RefreshSegmentsAsync();
        }
    }

    private string? GetCurrentProjectPath()
    {
        return CboYoloProject.SelectedValue as string ?? ConfigOptionsProvider.GetOptions<CoordCalibrationOptions>().YoloCurrentProject;
    }

    private string GetClientType()
    {
        if (RadioD3Game.IsChecked == true) return AppConstants.ClientTypeD3Game;
        if (RadioD4Game.IsChecked == true) return AppConstants.ClientTypeD4Game;
        return AppConstants.ClientTypeBattlenet;
    }

    private IntPtr GetWindowHandleForClientType()
    {
        var client = GetClientType();
        if (client == AppConstants.ClientTypeBattlenet)
        {
            var p = BattlenetManager.Instance.GetProcess();
            if (p != null && p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
        }
        if (client == AppConstants.ClientTypeD3Game)
        {
            foreach (var p in Process.GetProcessesByName("Diablo III"))
            {
                try
                {
                    if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
                }
                finally { p.Dispose(); }
            }
        }
        return IntPtr.Zero;
    }

    private Task StartRecordAsync()
    {
        var projectPath = GetCurrentProjectPath();
        if (string.IsNullOrWhiteSpace(projectPath))
        {
            AppendLog("Select a project first.");
            return Task.CompletedTask;
        }
        if (!Directory.Exists(projectPath))
        {
            AppendLog("Project directory does not exist: " + projectPath);
            return Task.CompletedTask;
        }
        var hwnd = GetWindowHandleForClientType();
        if (hwnd == IntPtr.Zero)
        {
            AppendLog("No window found for client type. Open Battle.net or Diablo III first.");
            return Task.CompletedTask;
        }
        _yoloRecordService.OnLog = msg => Dispatcher.InvokeAsync(() => AppendLog(msg));
        int fps = _yoloData.RecordFps;
        var (ok, segmentPath, err) = _yoloRecordService.StartRecording(projectPath, hwnd, fps);
        if (ok)
            AppendLog("Recording started.");
        else
            AppendLog("Record start failed: " + (err ?? "Unknown"));
        return Task.CompletedTask;
    }

    private async Task StopRecordAsync()
    {
        if (!_yoloRecordService.IsRecording)
        {
            AppendLog("No active recording.");
            return;
        }
        await _yoloRecordService.StopRecordingAsync().ConfigureAwait(true);
        await Dispatcher.InvokeAsync(() =>
        {
            _yoloData.RefreshSegmentListFromDisk();
            RefreshSegmentRowsFromYoloData();
        });
        AppendLog("Recording stopped.");
    }

    private Task RefreshSegmentsAsync()
    {
        var projectPath = GetCurrentProjectPath();
        if (string.IsNullOrWhiteSpace(projectPath))
        {
            AppendLog("Select a project first.");
            return Task.CompletedTask;
        }
        _yoloData.SetCurrentProject(projectPath);
        _yoloData.RefreshSegmentListFromDisk();
        RefreshSegmentRowsFromYoloData();
        return Task.CompletedTask;
    }

    private async Task ExportSelectedAsync()
    {
        var selected = DgYoloSegments.SelectedItems.Cast<YoloSegmentRow>().ToList();
        if (selected.Count == 0)
        {
            AppendLog("Select at least one segment to export.");
            return;
        }
        foreach (var row in selected)
        {
            if (string.IsNullOrWhiteSpace(row.SegmentPath)) continue;
            var (ok, err) = YoloSegmentLayout.ExportSegment(row.SegmentPath);
            if (ok)
                AppendLog("Exported: " + row.SegmentId);
            else
                AppendLog("Export failed " + row.SegmentId + ": " + (err ?? "Unknown"));
        }
        await RefreshSegmentsAsync().ConfigureAwait(true);
    }

    private async Task DeleteSelectedAsync()
    {
        var selected = DgYoloSegments.SelectedItems.Cast<YoloSegmentRow>().ToList();
        if (selected.Count == 0)
        {
            AppendLog("Select at least one segment to delete.");
            return;
        }
        if (MessageBox.Show(Window.GetWindow(this), $"Delete {selected.Count} segment(s)?", "Confirm", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
            return;
        foreach (var row in selected)
        {
            if (string.IsNullOrWhiteSpace(row.SegmentPath)) continue;
            var (ok, err) = YoloSegmentLayout.DeleteSegment(row.SegmentPath);
            if (ok)
                AppendLog("Deleted: " + row.SegmentId);
            else
                AppendLog("Delete failed " + row.SegmentId + ": " + (err ?? "Unknown"));
        }
        await RefreshSegmentsAsync().ConfigureAwait(true);
    }

    private void CreateProject()
    {
        _yoloData.LoadFromConfig();
        var root = _yoloData.YoloDataRoot;
        if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
        {
            AppendLog("Set YOLO data root in Config first.");
            return;
        }
        var clientType = GetClientType();
        _yoloData.SetClientType(clientType);
        var name = ShowInputDialog("Project name:", "Create project", "project1");
        if (string.IsNullOrWhiteSpace(name)) return;
        name = name.Trim();
        var projectPath = _yoloData.GetProjectPath(name);
        try
        {
            Directory.CreateDirectory(projectPath);
            var configPath = Path.Combine(projectPath, "project_config.json");
            if (!File.Exists(configPath))
            {
                var config = System.Text.Json.JsonSerializer.Serialize(new { project_name = name, classes = new[] { "object" } }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(configPath, config);
            }
            _yoloData.RefreshProjectListFromDisk();
            _yoloData.SetCurrentProject(projectPath);
            _yoloData.SaveToConfig();
            LoadCoordCalibrationFromConfig();
            for (int i = 0; i < CboYoloProject.Items.Count; i++)
            {
                if (CboYoloProject.Items[i] is YoloProjectItem item && string.Equals(item.Path, projectPath, StringComparison.OrdinalIgnoreCase))
                {
                    CboYoloProject.SelectedIndex = i;
                    break;
                }
            }
            AppendLog("Created project: " + projectPath);
        }
        catch (Exception ex)
        {
            AppendLog("Create project failed: " + ex.Message);
        }
    }

    private void OpenProjectDir()
    {
        var path = GetCurrentProjectPath();
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            AppendLog("Select an existing project first.");
            return;
        }
        try
        {
            Process.Start("explorer", path);
        }
        catch (Exception ex)
        {
            AppendLog("Open folder failed: " + ex.Message);
        }
    }

    private void ShowYoloConfig()
    {
        _yoloData.LoadFromConfig();
        var root = _yoloData.YoloDataRoot;
        var newRoot = ShowInputDialog("YOLO data root path:", "YOLO Config", root);
        if (newRoot != null)
        {
            _yoloData.SetYoloDataRoot(newRoot);
            D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.CoordCalibrationYoloDataRoot, newRoot.Trim());
            _yoloData.SaveToConfig();
            AppendLog("YOLO data root updated.");
        }
    }

    /// <summary>Import patch: select a folder (by choosing any image in it), write patch_data.json to current project (Python-compatible: base_dir + items with class = filename stem).</summary>
    private void ImportPatch()
    {
        var projectPath = GetCurrentProjectPath();
        if (string.IsNullOrWhiteSpace(projectPath) || !Directory.Exists(projectPath))
        {
            AppendLog("Select an existing project first.");
            return;
        }
        var dlg = new Microsoft.Win32.OpenFileDialog
        {
            Title = "Select any image in the patch folder (all images in that folder will be imported)",
            Filter = "Images|*.jpg;*.jpeg;*.png;*.bmp|All|*.*"
        };
        if (dlg.ShowDialog(Window.GetWindow(this)) != true) return;
        var filePath = dlg.FileName?.Trim();
        if (string.IsNullOrEmpty(filePath)) return;
        var dir = File.Exists(filePath) ? Path.GetDirectoryName(filePath) : filePath;
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
        {
            AppendLog("Folder not found.");
            return;
        }
        var imageExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".bmp" };
        var items = new List<object>();
        foreach (var f in Directory.EnumerateFiles(dir))
        {
            if (!imageExts.Contains(Path.GetExtension(f))) continue;
            var file = Path.GetFileName(f);
            var cls = Path.GetFileNameWithoutExtension(f) ?? file;
            items.Add(new { file = file, @class = cls });
        }
        if (items.Count == 0)
        {
            AppendLog("No images found in folder.");
            return;
        }
        var patchPath = Path.Combine(projectPath, "patch_data.json");
        var obj = new Dictionary<string, object>
        {
            ["base_dir"] = dir,
            ["items"] = items
        };
        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(obj, new System.Text.Json.JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });
            File.WriteAllText(patchPath, json);
            AppendLog($"Import patch: {items.Count} images -> {patchPath}");
        }
        catch (Exception ex)
        {
            AppendLog("Import patch failed: " + ex.Message);
        }
    }

    private static string? ShowInputDialog(string prompt, string title, string defaultValue = "")
    {
        var w = new Window
        {
            Title = title,
            Width = 400,
            Height = 120,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            ResizeMode = ResizeMode.NoResize
        };
        var stack = new StackPanel { Margin = new Thickness(12) };
        stack.Children.Add(new TextBlock { Text = prompt, Margin = new Thickness(0, 0, 0, 6) });
        var tb = new TextBox { Text = defaultValue, Margin = new Thickness(0, 0, 0, 12) };
        stack.Children.Add(tb);
        var buttonRow = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var ok = new Button { Content = "OK", Width = 70, Height = 24, Margin = new Thickness(0, 0, 8, 0) };
        var cancel = new Button { Content = "Cancel", Width = 70, Height = 24 };
        string? result = null;
        ok.Click += (_, _) => { result = tb.Text; w.Close(); };
        cancel.Click += (_, _) => w.Close();
        buttonRow.Children.Add(ok);
        buttonRow.Children.Add(cancel);
        stack.Children.Add(buttonRow);
        w.Content = stack;
        w.Owner = Application.Current.MainWindow;
        tb.Focus();
        w.ShowDialog();
        return result;
    }

    private void AppendLog(string message)
    {
        if (TxtRecordLog == null) return;
        var existing = TxtRecordLog.Text;
        TxtRecordLog.Text = string.IsNullOrEmpty(existing) ? message : existing + "\n" + message;
    }

    private void BtnYoloOpenLabel_Click(object sender, RoutedEventArgs e)
    {
        var projectPath = GetCurrentProjectPath();
        string? imagesDir = null;
        if (DgYoloSegments.SelectedItem is YoloSegmentRow row && !string.IsNullOrWhiteSpace(row.SegmentPath))
        {
            var imagesPath = Path.Combine(row.SegmentPath, YoloCalibrationData.ImagesSubdir);
            var framesPath = Path.Combine(row.SegmentPath, YoloCalibrationData.FramesSubdir);
            if (Directory.Exists(imagesPath))
                imagesDir = imagesPath;
            else if (Directory.Exists(framesPath))
                imagesDir = framesPath;
        }
        if (string.IsNullOrWhiteSpace(imagesDir) && !string.IsNullOrWhiteSpace(projectPath) && Directory.Exists(projectPath))
            imagesDir = projectPath;
        if (string.IsNullOrWhiteSpace(imagesDir))
        {
            AppendLog("Select a segment with images/ or frames/, or open a project.");
            return;
        }
        var win = new AnnotatorWindow(imagesDir, projectPath ?? "");
        win.Owner = Window.GetWindow(this);
        win.Show();
        AppendLog("VOC Annotator opened (in-process).");
    }
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
    public int Frames { get; set; }
    public string Status { get; set; } = "";
    public string Size { get; set; } = "";
}
