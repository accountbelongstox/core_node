// PY-REF: pyapps/d3-check/ui/panels/coordinate_calibration_panel.py
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
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
    private static readonly string[] RecordConfigRelativePath = { "GameAISDK", "tools", "SDKTool", "Resource", "cfg", YoloRecordConfig.FileName };

    private string _clientType = AppConstants.ClientTypeBattlenet;
    private string? _currentProjectPath;
    private List<string> _projectList = new();

    public string ClientType => _clientType;
    public IReadOnlyList<string> ProjectList => _projectList;
    public string? LastRecordProjectPath { get; set; }

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
        YoloDataLayout.SetRootOverride(opts.YoloDataRoot);
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
        var name = "project_" + DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var projectPath = Path.Combine(baseDir, name);
        Directory.CreateDirectory(projectPath);
        ProjectConfig.SaveProjectConfig(Path.Combine(projectPath, ProjectConfig.AnnotatorConfigFileName), name, new[] { ProjectConfig.DefaultClassName });
        return Path.GetFullPath(projectPath);
    }

    /// <summary>Find the window for the current client type; IntPtr.Zero when none.</summary>
    public IntPtr FindClientWindow()
    {
        if (_clientType == AppConstants.ClientTypeD3Game)
            return D3WindowFinder.FindFirstHandle();
        var window = _clientType == AppConstants.ClientTypeD4Game
            ? D4Manager.Instance.FindFirstWindow()
            : BattlenetManager.Instance.FindBattlenetWindow();
        return window?.Hwnd ?? IntPtr.Zero;
    }

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

    private static void Save(string key, object value)
    {
        var svc = D3D4TesterConfigService.Instance;
        svc.SetValueAsync(key, value);
        svc.QueueSave();
    }

    private static bool PathEquals(string a, string b) =>
        string.Equals(YoloDataLayout.TrimSeparators(Path.GetFullPath(a)), YoloDataLayout.TrimSeparators(Path.GetFullPath(b)), StringComparison.OrdinalIgnoreCase);
}
