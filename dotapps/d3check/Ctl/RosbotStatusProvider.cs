using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;

namespace DotApps.d3check.Ctl;

/// <summary>
/// Refresh ROSBOT extended status and update GameInterfaceData. 1:1 Python refresh_rosbot_status / _refresh_rosbot_status_internal.
/// Call from timer or when panel needs update. Single lookup: GetDetection -> SetRosbotExtendedStatus, SetRosbotFoundDisplay, SetRosbotHasMainUi, SetRosbotUiNeedKey (from GetUiState).
/// </summary>
public static class RosbotStatusProvider
{
    private static readonly object _lock = new();
    private static IRosbotOperation? _rosbotOperation;

    /// <summary>Get or create ROSBOT operation singleton (config from ros_settings.ros_directory). 1:1 Python get_rosbot_operation().</summary>
    public static IRosbotOperation GetRosbotOperation()
    {
        if (_rosbotOperation != null) return _rosbotOperation;
        lock (_lock)
        {
            if (_rosbotOperation == null)
            {
                _rosbotOperation = new RosbotOperation(
                    () => { var r = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory; return string.IsNullOrWhiteSpace(r) ? null : r; },
                    () => RosbotConstants.DefaultRosbotExeName);
            }
        }
        return _rosbotOperation;
    }

    /// <summary>
    /// Detect ROSBOT status (not_found | running | paused), update GameInterfaceData, return window info if paused.
    /// Uses config ros_settings.ros_directory and same-dir exe logic (other first, then main). 1:1 Python refresh_rosbot_status().
    /// Also calls GetUiState (KEY dialog) and SetRosbotUiNeedKey.
    /// </summary>
    public static RosbotWindowInfo? Refresh()
    {
        string? rosDir = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
        if (string.IsNullOrWhiteSpace(rosDir)) rosDir = null;
        var det = RosbotDetection.GetDetection(rosDir, RosbotConstants.DefaultRosbotExeName);
        var game = GameInterfaceData.Instance;
        game.SetRosbotExtendedStatus(det.Status);
        game.SetRosbotHasMainUi(det.Status == "paused" && det.IsMainUi);
        string exeName = det.ExeName ?? "";
        string? title = det.WindowInfo?.Title;
        game.SetRosbotFoundDisplay(exeName, title ?? "");

        RosbotUiState uiState = GetRosbotOperation().GetUiState(det.Pids);
        game.SetRosbotUiNeedKey(uiState.NeedKeyInput, uiState.Message);

        return det.WindowInfo;
    }
}
