using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for coord_calibration section.</summary>
public sealed class CoordCalibrationOptions
{
    [ConfigurationKeyName("client_type")]
    public string ClientType { get; set; } = "battlenet";

    [ConfigurationKeyName("yolo_data_root")]
    public string YoloDataRoot { get; set; } = "";

    [ConfigurationKeyName("yolo_current_project")]
    public string YoloCurrentProject { get; set; } = "";

    [ConfigurationKeyName("yolo_project_list")]
    public List<string> YoloProjectList { get; set; } = new();

    [ConfigurationKeyName("record_fps")]
    public int RecordFps { get; set; } = 2;
}
