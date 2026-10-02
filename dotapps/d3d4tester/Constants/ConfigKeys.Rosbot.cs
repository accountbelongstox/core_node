// PY-REF: pyapps/d3-check/d3utils/rosbot_manager.py
using DotApps.d3d4tester.Core;

namespace DotApps.d3d4tester.Constants;

/// <summary>ros_settings process keys (Python ROSBOTManager config); values shared with Core RosbotConstants.</summary>
public static partial class ConfigKeys
{
    public const string RosSettingsRosbotExeName = RosbotConstants.ConfigKeyRosbotExeName;
    public const string RosSettingsOtherExeSearchPatterns = RosbotConstants.ConfigKeyOtherExeSearchPatterns;
    public const string RosSettingsOtherExeExcludePatterns = RosbotConstants.ConfigKeyOtherExeExcludePatterns;
    public const string RosSettingsStartupDelaySeconds = RosbotConstants.ConfigKeyStartupDelaySeconds;
    public const string RosSettingsProcessDetectionTimeout = RosbotConstants.ConfigKeyProcessDetectionTimeout;
}
