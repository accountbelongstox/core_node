// PY-REF: pyapps/d3-check/d3utils/state_aware_click_handler.py
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// ClickHandler wrapper that aborts each action when the assistant should stop. 1:1 Python pyapps/d3-check/d3utils/state_aware_click_handler.py.
/// </summary>
public sealed class StateAwareClickHandler
{
    /// <summary>Move duration for assistant clicks. 1:1 CLICK_MOVE_DURATION_SEC.</summary>
    public const double ClickMoveDurationSec = 0.0;
    /// <summary>Pause after move before clicking. 1:1 CLICK_PAUSE_AFTER_MOVE_SEC.</summary>
    public const double ClickPauseAfterMoveSec = 0.02;
    private const double DefaultDuration = 0.1;

    private static readonly Lazy<StateAwareClickHandler> LazyInstance = new(() => new StateAwareClickHandler());

    private readonly ClickHandler _click = ClickHandler.Instance;

    private StateAwareClickHandler() { }

    /// <summary>Singleton. 1:1 get_state_aware_click_handler.</summary>
    public static StateAwareClickHandler Instance => LazyInstance.Value;

    private static bool CheckState(string actionName)
    {
        if (AssistantExecutionState.Instance.ShouldStopAssistant())
        {
            ColorPrinter.Yellow($"[StateClick] Execution interrupted before {actionName}");
            return false;
        }
        return true;
    }

    public bool Click(int x, int y, MouseButton button = MouseButton.Left, double duration = DefaultDuration, bool returnToOriginal = true, bool directClick = false, double? pauseAfterMove = null) =>
        CheckState($"click at ({x}, {y})") && _click.Click(x, y, button, duration, returnToOriginal, directClick, pauseAfterMove);

    public bool LeftClick(int x, int y, double duration = DefaultDuration, bool returnToOriginal = true, bool directClick = false, double? pauseAfterMove = null) =>
        CheckState($"left click at ({x}, {y})") && _click.LeftClick(x, y, duration, returnToOriginal, directClick, pauseAfterMove);

    public bool RightClick(int x, int y, double duration = DefaultDuration, bool returnToOriginal = true, bool directClick = false, double? pauseAfterMove = null) =>
        CheckState($"right click at ({x}, {y})") && _click.RightClick(x, y, duration, returnToOriginal, directClick, pauseAfterMove);

    public bool DoubleClick(int x, int y, double duration = DefaultDuration) =>
        CheckState($"double click at ({x}, {y})") && _click.DoubleClick(x, y, duration);

    public bool MoveMouse(int x, int y, double duration = 0.2) =>
        CheckState($"move mouse to ({x}, {y})") && _click.MoveMouseTo(x, y, duration);

    public bool MoveMouseCurve(int x, int y, MouseCurveType curveType = MouseCurveType.Bezier, double? duration = null) =>
        CheckState($"move mouse curve to ({x}, {y})") && _click.MoveMouseCurve(x, y, duration, curveType);

    public bool Drag(int startX, int startY, int endX, int endY, double duration = 0.5) =>
        CheckState($"drag from ({startX}, {startY}) to ({endX}, {endY})") && _click.Drag(startX, startY, endX, endY, duration);

    /// <summary>Cursor position (no state check).</summary>
    public (int X, int Y) GetMousePosition() => _click.GetMousePosition();
}
