using System.Collections.Generic;

namespace DotApps.d3check.Models;

/// <summary>
/// Centralized project data for coordinate calibration / YOLO workflow.
/// Matches Python layout: project_path = {yolo_data_root}/{client_type}/{project_name},
/// segments under project_path, project_config.json and patch_data.json at project root.
/// Used by CalibrationPage and YoloRecordBridgeClient; extend for new fields without breaking CONFIG.
/// </summary>
public class YoloProjectData
{
    /// <summary>Absolute project directory path. 1:1 Python get_yolo_project_path / segment layout.</summary>
    public string ProjectPath { get; set; } = "";

    /// <summary>Project display name (last segment of path or from project_config.json).</summary>
    public string ProjectName { get; set; } = "";

    /// <summary>Client type: battlenet, d3_game, d4_game. 1:1 Python CLIENT_TYPE_TO_RECORD_SUBDIR.</summary>
    public string ClientType { get; set; } = "battlenet";

    /// <summary>Class names for YOLO (from project_config.json).</summary>
    public List<string> Classes { get; set; } = new();

    /// <summary>Segment id -> segment path (under project). Filled from ListSegments API.</summary>
    public List<(string SegmentId, string SegmentPath)> Segments { get; set; } = new();
}
