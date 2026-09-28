using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotCore.YoloRecord;

namespace DotApps.d3check.Services;

/// <summary>
/// Centralized YOLO calibration state: client type, data root, project list, current project, segments. Load/save from CONFIG; refresh project/segment lists from disk. Uses DotCore.YoloRecord layout (record/, frames/).
/// </summary>
public sealed class YoloCalibrationData
{
    public const string ImagesSubdir = "images";
    public static string FramesSubdir => YoloSegmentLayout.FramesSubdir;
    public static string RecordSubdir => YoloSegmentLayout.RecordSubdir;
    private const string RecordFpsKey = "coord_calibration.record_fps";

    private string _clientType = "battlenet";
    private string _yoloDataRoot = "";
    private string? _currentProjectPath;
    private List<string> _projectList = new();
    private List<(string SegmentId, string SegmentPath)> _segments = new();

    public string ClientType => _clientType;
    public string YoloDataRoot => _yoloDataRoot;
    public string? CurrentProjectPath => _currentProjectPath;
    public IReadOnlyList<string> ProjectList => _projectList;
    public IReadOnlyList<(string SegmentId, string SegmentPath)> Segments => _segments;
    public int RecordFps { get; private set; } = 2;

    public void LoadFromConfig()
    {
        var opts = ConfigOptionsProvider.GetOptions<CoordCalibrationOptions>();
        _clientType = opts.ClientType ?? "battlenet";
        _yoloDataRoot = opts.YoloDataRoot ?? "";
        _currentProjectPath = string.IsNullOrWhiteSpace(opts.YoloCurrentProject) ? null : opts.YoloCurrentProject;
        _projectList = opts.YoloProjectList != null ? new List<string>(opts.YoloProjectList) : new List<string>();
        RecordFps = opts.RecordFps;
        if (RecordFps < 1) RecordFps = 1;
        if (RecordFps > 30) RecordFps = 30;
    }

    public void SaveToConfig()
    {
        var svc = D3CheckConfigService.Instance;
        svc.SetValueAsync(ConfigKeys.CoordCalibrationClientType, _clientType);
        svc.SetValueAsync(ConfigKeys.CoordCalibrationYoloDataRoot, _yoloDataRoot);
        svc.SetValueAsync(ConfigKeys.CoordCalibrationYoloCurrentProject, _currentProjectPath ?? "");
        svc.SetValueAsync(ConfigKeys.CoordCalibrationYoloProjectList, _projectList);
        svc.SetValueAsync(RecordFpsKey, RecordFps);
        svc.QueueSave();
    }

    public void SetClientType(string clientType)
    {
        _clientType = clientType ?? "battlenet";
    }

    public void SetCurrentProject(string? projectPath)
    {
        _currentProjectPath = projectPath;
    }

    public void SetYoloDataRoot(string root)
    {
        _yoloDataRoot = root ?? "";
    }

    /// <summary>Project path = {yoloDataRoot}/{clientType}/{projectName}.</summary>
    public string GetProjectPath(string projectName)
    {
        if (string.IsNullOrWhiteSpace(_yoloDataRoot) || string.IsNullOrWhiteSpace(projectName)) return "";
        string client = string.IsNullOrWhiteSpace(_clientType) ? "battlenet" : _clientType.Replace(".", "_");
        return Path.Combine(_yoloDataRoot, client, projectName.Trim());
    }

    public void RefreshProjectListFromDisk()
    {
        _projectList.Clear();
        if (string.IsNullOrWhiteSpace(_yoloDataRoot) || !Directory.Exists(_yoloDataRoot)) return;
        foreach (var clientDir in Directory.EnumerateDirectories(_yoloDataRoot))
        {
            foreach (var projDir in Directory.EnumerateDirectories(clientDir))
            {
                string path = Path.GetFullPath(projDir);
                if (!_projectList.Contains(path, StringComparer.OrdinalIgnoreCase))
                    _projectList.Add(path);
            }
        }
    }

    public void RefreshSegmentListFromDisk()
    {
        _segments.Clear();
        if (string.IsNullOrWhiteSpace(_currentProjectPath) || !Directory.Exists(_currentProjectPath)) return;
        var dirs = Directory.EnumerateDirectories(_currentProjectPath).OrderByDescending(d => d).ToList();
        foreach (var d in dirs)
        {
            string segmentId = Path.GetFileName(d) ?? "";
            _segments.Add((segmentId, d));
        }
    }

    /// <summary>Get segment info from disk: frame count (record or frames), status, size MB. Uses DotCore.YoloRecord.</summary>
    public static (int Frames, string Status, double SizeMb) GetSegmentInfoFromDisk(string segmentPath)
    {
        return YoloSegmentLayout.GetSegmentInfo(segmentPath);
    }
}
