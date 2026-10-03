// PY-REF: pyapps/d3-check/d3utils/rosbot_manager.py

namespace DotApps.d3d4tester.Constants;

/// <summary>ros_settings process keys (Python ROSBOTManager config); values shared with Core RosbotConstants.</summary>
public static partial class ConfigKeys
{
    public const string RosSettingsRosbotExeName = "ros_settings.rosbot_exe_name";
    public const string RosSettingsOtherExeSearchPatterns = "ros_settings.other_exe_search_patterns";
    public const string RosSettingsOtherExeExcludePatterns = "ros_settings.other_exe_exclude_patterns";
    public const string RosSettingsStartupDelaySeconds = "ros_settings.startup_delay_seconds";
    public const string RosSettingsProcessDetectionTimeout = "ros_settings.process_detection_timeout";
}
