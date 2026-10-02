// PY-REF: pyapps/d3-check/d3utils/rosbot_status_provider.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_operation.py
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.I18n;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// ROSBOT extended status (not_found | running | paused) into GameInterfaceData. running/paused -> not_found marks the exit
/// reason (restart count). has_main_ui = status paused. Single lookup; GetUiState reuses the PIDs.
/// 1:1 Python d3utils/rosbot_status_provider.py.
/// </summary>
public static class RosbotStatusProvider
{
    private static readonly Lazy<IRosbotOperation> Operation = new(() =>
        new RosbotOperation(() => D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotNeedKeyMessage)));

    /// <summary>1:1 Python get_rosbot_operation().</summary>
    public static IRosbotOperation GetRosbotOperation() => Operation.Value;

    /// <summary>Refresh and return the window info when paused, else null. 1:1 Python refresh_rosbot_status.</summary>
    public static RosbotWindowInfo? Refresh() => RefreshInternal().Window;

    /// <summary>Refresh; returns (window when paused, state_changed). 1:1 Python _refresh_rosbot_status_internal.</summary>
    public static (RosbotWindowInfo? Window, bool Changed) RefreshInternal()
    {
        var game = GameInterfaceData.Instance;
        var prev = game.GetStateSnapshot();
        var det = RosbotManager.Instance.GetDetection();
        string status = det.Status;
        if (RosbotDetection.IsOnline(prev.RosbotExtendedStatus) && status == RosbotDetection.StatusNotFound)
            RosbotExitState.MarkExitReasonWhenProcessGone();
        bool statusChanged = game.SetRosbotExtendedStatus(status);
        bool hasMainUi = status == RosbotDetection.StatusPaused;
        bool mainUiChanged = prev.RosbotHasMainUi != hasMainUi;
        game.SetRosbotHasMainUi(hasMainUi);
        bool displayChanged = game.SetRosbotFoundDisplay(det.ExeName ?? "", det.WindowInfo?.Title ?? "");

        RosbotUiState ui = GetRosbotOperation().GetUiState(det.Pids.Count > 0 ? det.Pids : null);
        game.SetRosbotUiNeedKey(ui.NeedKeyInput, ui.Message.Trim());
        return (det.WindowInfo, statusChanged || displayChanged || mainUiChanged);
    }

    /// <summary>Immediate check: current ROSBOT window or null. 1:1 Python get_current_rosbot_window.</summary>
    public static RosbotWindowInfo? GetCurrentWindow() => RosbotManager.Instance.GetRosbotWindow();
}
