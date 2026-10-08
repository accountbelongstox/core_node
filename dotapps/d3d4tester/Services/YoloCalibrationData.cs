// PY-REF: pyapps/d3-check/ui/panels/coordinate_calibration_panel.py
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.VocAnnotator;
using DotCore.YoloRecord;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Calibration tab YOLO state: client type, current project (CONFIG is source of truth), loaded-project cache, client window lookup and record config path.
/// 1:1 Python pyapps/d3-check/ui/panels/coordinate_calibration_panel.py (_get_yolo_current_project, _add_project_to_cache, _get_standard_project_paths,
/// _on_client_type_change, _get_current_client_window_hwnd).
/// Fixes Python bug: a project opened via Load (non-standard path, kept in the cache) was rejected by is_valid_project_path and never became current.
/// </summary>
public sealed class YoloCalibrationData
{
    public const int ProjectListMax = 30;
    private const string ProjectNamePrefix = "project_";
    private const string LogTag = "[YoloCalibrationData]";
    private static readonly TimeSpan RecorderStopTimeout = TimeSpan.FromSeconds(3);
    private static readonly string[] RecordConfigRelativePath = { "GameAISDK", "tools", "SDKTool", "Resource", "cfg", YoloRecordConfig.FileName };

    private string _clientType = AppConstants.ClientTypeBattlenet;
    private string? _currentProjectPath;
    private List<string> _projectList = new();

    public string ClientType => _clientType;
    public IReadOnlyList<string> ProjectList => _projectList;
    public string? LastRecordProjectPath { get; set; }

    /// <summary>The single YOLO recorder of the app (calibration page and HTTP bridge); stopped and flushed on app shutdown.</summary>
    public static YoloRecordService Recorder { get; } = new();

    /// <summary>App startup: apply the yolo_data_root override now and on every change of that key, and stop the recorder on shutdown.</summary>
    public static void InitializeRuntime()
    {
        ApplyDataRootOverride();
        D3D4TesterConfigChangeHub.Notifier.Subscribe(OnConfigChanged);
        ShutdownManager.RegisterShutdownHook(StopRecorder);
    }

    /// <summary>record_cfg.json loaded from <see cref="RecordConfigPath"/> (defaults when missing).</summary>
    public static YoloRecordConfig LoadRecordConfig() => YoloRecordConfig.Load(RecordConfigPath);

    /// <summary>
    /// Current project from the live config without side effects: the saved project when it exists, else the default project of the
    /// configured client when it exists. Same fallbacks as <see cref="GetCurrentProject"/> without the in-memory last record project.
    /// </summary>
    public static string? ResolveCurrentProject()
    {
        var saved = ConfigBinding.GetValue(ConfigKeys.CoordCalibrationYoloCurrentProject, "");
        if (!string.IsNullOrWhiteSpace(saved))
        {
            var candidate = Path.GetFullPath(saved.Trim());
            if (Directory.Exists(candidate)) return candidate;
        }
        var def = YoloDataLayout.GetProjectPath(YoloSegmentLayout.GetClientSubdir(ConfiguredClientType()), YoloSegmentLayout.DefaultProjectName);
        return Directory.Exists(def) ? def : null;
    }

    /// <summary>Client type from the live config (invalid -> Battle.net).</summary>
    public static string ConfiguredClientType()
    {
        var clientType = ConfigBinding.GetValue(ConfigKeys.CoordCalibrationClientType, AppConstants.ClientTypeBattlenet);
        return IsValidClientType(clientType) ? clientType! : AppConstants.ClientTypeBattlenet;
    }

    private static void ApplyDataRootOverride() =>
        YoloDataLayout.SetRootOverride(ConfigBinding.GetValue(ConfigKeys.CoordCalibrationYoloDataRoot, ""));

    private static void OnConfigChanged(string? keyPath)
    {
        if (keyPath == null || ConfigKeys.CoordCalibrationYoloDataRoot.StartsWith(keyPath, StringComparison.Ordinal))
            ApplyDataRootOverride();
    }

    private static void StopRecorder()
    {
        if (!Recorder.IsRecording) return;
        try
        {
            if (!Recorder.StopRecordAsync().Wait(RecorderStopTimeout))
                ColorPrinter.Yellow($"{LogTag} Stop recording timed out");
        }
        catch (AggregateException ex)
        {
            ColorPrinter.Yellow($"{LogTag} Stop recording failed: {ex.InnerException?.Message ?? ex.Message}");
        }
    }

    /// <summary>record_cfg.json path: repo pyapps/GameAISDK/tools/SDKTool/Resource/cfg (Python location) when pyapps is found above the app dir, else next to the app.</summary>
    public static string RecordConfigPath
    {
        get
        {
            if (SourcePaths.RepoRoot is { } root)
                return Path.Combine(new[] { root, SourcePaths.PyAppsDirName }.Concat(RecordConfigRelativePath).ToArray());
            return Path.Combine(AppContext.BaseDirectory, YoloRecordConfig.FileName);
        }
    }

    /// <summary>Load client type, current project and project cache from CONFIG; apply yolo_data_root override.</summary>
    public void LoadFromConfig()
    {
        var opts = ConfigOptionsProvider.GetOptions<CoordCalibrationOptions>();
        _clientType = IsValidClientType(opts.ClientType) ? opts.ClientType : AppConstants.ClientTypeBattlenet;
        ApplyDataRootOverride();
        _projectList = (opts.YoloProjectList ?? new List<string>())
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => Path.GetFullPath(p.Trim()))
            .Take(ProjectListMax)
            .ToList();
        _currentProjectPath = null;
        var saved = opts.YoloCurrentProject;
        if (!string.IsNullOrWhiteSpace(saved))
        {
            var candidate = Path.GetFullPath(saved.Trim());
            if (Directory.Exists(candidate) && (YoloSegmentLayout.IsValidProjectPath(candidate) || _projectList.Any(p => PathEquals(p, candidate))))
                _currentProjectPath = candidate;
            else
                SaveCurrentProject(SafeDefaultProjectPath(_clientType) ?? "");
        }
    }

    public static bool IsValidClientType(string? clientType) =>
        clientType == AppConstants.ClientTypeBattlenet || clientType == AppConstants.ClientTypeD3Game || clientType == AppConstants.ClientTypeD4Game;

    /// <summary>Change client type; reset the current project when it is not under the new client subdir.</summary>
    public void SetClientType(string clientType)
    {
        _clientType = IsValidClientType(clientType) ? clientType : AppConstants.ClientTypeBattlenet;
        Save(ConfigKeys.CoordCalibrationClientType, _clientType);
        var current = _currentProjectPath;
        var subdirBase = Path.Combine(YoloDataLayout.Root, YoloSegmentLayout.GetClientSubdir(_clientType));
        if (current != null && !YoloDataLayout.IsUnder(current, subdirBase))
        {
            _currentProjectPath = null;
            SaveCurrentProject(SafeDefaultProjectPath(_clientType) ?? "");
        }
    }

    /// <summary>Current project: CONFIG value (mirrored in memory on load and every write) when it exists, else last record project, else client default.</summary>
    public string? GetCurrentProject()
    {
        if (_currentProjectPath != null && Directory.Exists(_currentProjectPath))
            return _currentProjectPath;
        if (LastRecordProjectPath != null && Directory.Exists(LastRecordProjectPath) && YoloSegmentLayout.IsValidProjectPath(LastRecordProjectPath))
            return LastRecordProjectPath;
        var def = SafeDefaultProjectPath(_clientType);
        return def != null && Directory.Exists(def) ? def : null;
    }

    /// <summary>Switch current project and persist.</summary>
    public void SetCurrentProject(string projectPath)
    {
        _currentProjectPath = Path.GetFullPath(projectPath);
        SaveCurrentProject(_currentProjectPath);
    }

    /// <summary>Insert at head of cache (dedupe, trim to 30) and persist.</summary>
    public void AddProjectToCache(string projectPath)
    {
        if (string.IsNullOrWhiteSpace(projectPath)) return;
        var p = Path.GetFullPath(projectPath.Trim());
        _projectList.RemoveAll(x => PathEquals(x, p));
        _projectList.Insert(0, p);
        if (_projectList.Count > ProjectListMax)
            _projectList.RemoveRange(ProjectListMax, _projectList.Count - ProjectListMax);
        Save(ConfigKeys.CoordCalibrationYoloProjectList, _projectList.ToList());
    }

    /// <summary>Projects under Root/{client subdir} (ensures default exists), sorted by name.</summary>
    public List<string> GetStandardProjectPaths()
    {
        try
        {
            var standardBase = Path.Combine(YoloDataLayout.Root, YoloSegmentLayout.GetClientSubdir(_clientType));
            Directory.CreateDirectory(Path.Combine(standardBase, YoloSegmentLayout.DefaultProjectName));
            return Directory.EnumerateDirectories(standardBase)
                .OrderBy(d => Path.GetFileName(d), StringComparer.Ordinal)
                .Select(Path.GetFullPath)
                .ToList();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return new List<string>();
        }
    }

    /// <summary>Dropdown entries: standard projects then cached (non-standard) existing paths.</summary>
    public List<string> GetDropdownProjectPaths()
    {
        var standard = GetStandardProjectPaths();
        var cache = _projectList.Where(p => !standard.Any(s => PathEquals(s, p)) && Directory.Exists(p));
        return standard.Concat(cache).ToList();
    }

    /// <summary>Create Root/{client subdir}/project_yyyyMMdd_HHmmss with annotator_config.json; returns path.</summary>
    public string CreateProject()
    {
        var baseDir = Path.Combine(YoloDataLayout.Root, YoloSegmentLayout.GetClientSubdir(_clientType));
        Directory.CreateDirectory(baseDir);
        var name = ProjectNamePrefix + DateTime.Now.ToString(D3PathConstants.FileTimestampFormat, CultureInfo.InvariantCulture);
        var projectPath = Path.Combine(baseDir, name);
        Directory.CreateDirectory(projectPath);
        ProjectConfig.SaveProjectConfig(Path.Combine(projectPath, ProjectConfig.AnnotatorConfigFileName), name, new[] { ProjectConfig.DefaultClassName });
        return Path.GetFullPath(projectPath);
    }

    /// <summary>Find the window for the current client type; IntPtr.Zero when none.</summary>
    public IntPtr FindClientWindow() => FindClientWindow(_clientType);

    /// <summary>Find the window of a client type; IntPtr.Zero when none.</summary>
    public static IntPtr FindClientWindow(string clientType)
    {
        if (clientType == AppConstants.ClientTypeD3Game)
            return D3Manager.Instance.FindFirstHwnd();
        var window = clientType == AppConstants.ClientTypeD4Game
            ? D4Manager.Instance.FindFirstWindow()
            : BattlenetManager.Instance.FindBattlenetWindow();
        return window?.Hwnd ?? IntPtr.Zero;
    }

    /// <summary>Bring the current client window to front through its manager (blocking; game clients wait the settle delay).</summary>
    public bool ActivateClientWindow() => ActivateClientWindow(_clientType);

    /// <summary>Bring the window of a client type to front through its manager; false when no window.</summary>
    public static bool ActivateClientWindow(string clientType) => clientType switch
    {
        AppConstants.ClientTypeD3Game => D3Manager.Instance.ActivateWindow(),
        AppConstants.ClientTypeD4Game => D4Manager.Instance.ActivateWindow(),
        _ => BattlenetManager.Instance.ActivateWindow(),
    };

    /// <summary>"client/project" (last two components) for display.</summary>
    public static string ShortProjectPathDisplay(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "";
        var parts = Path.GetFullPath(path.Trim()).Split(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2) return Path.Combine(parts[^2], parts[^1]);
        return parts.Length > 0 ? parts[^1] : path;
    }

    private static string? SafeDefaultProjectPath(string clientType)
    {
        try { return YoloSegmentLayout.GetDefaultProjectPath(clientType); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }

    private static void SaveCurrentProject(string path) => Save(ConfigKeys.CoordCalibrationYoloCurrentProject, path);

    private static void Save(string key, object value) => ConfigBinding.SetValue(key, value);

    private static bool PathEquals(string a, string b) =>
        string.Equals(YoloDataLayout.TrimSeparators(Path.GetFullPath(a)), YoloDataLayout.TrimSeparators(Path.GetFullPath(b)), StringComparison.OrdinalIgnoreCase);
}
