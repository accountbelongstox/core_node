namespace DotApps.d3check.Core;

/// <summary>
/// ROSBOT operation: get window, activate window, run after-start automation, resume, get UI state (e.g. need key).
/// 1:1 with Python d3utils.rosbot_operation.RosbotOperation and get_rosbot_operation().
/// </summary>
public interface IRosbotOperation
{
    /// <summary>Return current ROSBOT window info (when status is paused) or null. 1:1 Python get_window().</summary>
    RosbotWindowInfo? GetWindow();

    /// <summary>Bring ROSBOT window to foreground. Returns true if window found and activated. 1:1 Python activate_window().</summary>
    bool ActivateWindow();

    /// <summary>After ROSBOT process started: wait window, activate, then run sequence (main profile tab + Start botting). 1:1 Python run_after_rosbot_start.</summary>
    bool RunAfterRosbotStart(int waitSec = 30, bool doDebug = true, bool doTab = true, bool doStartBotting = true);

    /// <summary>Resume ROSBOT when paused: activate window, run sequence (main profile + Start botting). 1:1 Python resume_rosbot.</summary>
    bool ResumeRosbot(bool doTab = true, bool doStartBotting = true);

    /// <summary>Return current ROSBOT UI state. When KEY dialog is present (e.g. "Error" with "enter a key"), need_key_input is true. 1:1 Python get_ui_state().</summary>
    RosbotUiState GetUiState(IReadOnlyList<int>? pids = null);
}

/// <summary>ROSBOT UI state. 1:1 Python get_ui_state return dict need_key_input, message.</summary>
public sealed class RosbotUiState
{
    public bool NeedKeyInput { get; init; }
    public string Message { get; init; } = "";
}
