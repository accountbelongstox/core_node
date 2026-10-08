// PY-REF: pyapps/d3-check/providor/providor_index.py
using DotApps.d3d4tester.Constants;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for coord_calibration section.</summary>
public sealed class CoordCalibrationOptions
{
    [ConfigurationKeyName("client_type")]
    public string ClientType { get; set; } = AppConstants.ClientTypeBattlenet;

    [ConfigurationKeyName("yolo_data_root")]
    public string YoloDataRoot { get; set; } = "";

    [ConfigurationKeyName("yolo_current_project")]
    public string YoloCurrentProject { get; set; } = "";

    [ConfigurationKeyName("yolo_project_list")]
    public List<string> YoloProjectList { get; set; } = new();

    [ConfigurationKeyName("record_fps")]
    public int RecordFps { get; set; } = 2;
}
