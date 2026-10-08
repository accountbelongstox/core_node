// PY-REF: pyapps/d3-check/d3utils/rosbot_operation.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT operation: UI state (KEY dialog -> need key). Start / resume automation lives in RosbotUiAutomation, windows in RosbotManager.
/// 1:1 with Python d3utils.rosbot_operation.RosbotOperation and get_rosbot_operation().
/// </summary>
public interface IRosbotOperation
{
    /// <summary>Return current ROSBOT UI state. When KEY dialog is present (e.g. "Error" with "enter a key"), need_key_input is true. 1:1 Python get_ui_state().</summary>
    RosbotUiState GetUiState(IReadOnlyList<int>? pids = null);
}

/// <summary>ROSBOT UI state. 1:1 Python get_ui_state return dict need_key_input, message.</summary>
public sealed class RosbotUiState
{
    public bool NeedKeyInput { get; init; }
    public string Message { get; init; } = "";
}
