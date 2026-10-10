// PY-REF: none (DOT-only)
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>
/// Windows mouse / keyboard adapter of the agent: client points are shifted by the window's screen offset. Input is only sent while
/// the D4 window is in the foreground (switching away pauses the agent instead of stealing focus); move, pickup and interact are a
/// left click at the point, attack aims the cursor at the target and presses the skill key (left / right click keys click there).
/// </summary>
public sealed class D4AgentActuator
{
    private const double ClickDurationSec = 0.0;

    private readonly ClickHandler _click = ClickHandler.Instance;

    /// <summary>Executes the decision; false when nothing was sent (no action, window not in front, input failure).</summary>
    public bool Execute(D4AgentDecision decision, D4Frame frame)
    {
        if (decision.Action == D4ActionKind.None || !D4LiveFrameSource.IsForeground(frame.Hwnd)) return false;
        var (ox, oy) = frame.ScreenOffset;
        switch (decision.Action)
        {
            case D4ActionKind.PressKey:
                return decision.Key != null && _click.PressKey(decision.Key);
            case D4ActionKind.Move:
            case D4ActionKind.Pickup:
            case D4ActionKind.Interact:
                return decision.Target is { } p && _click.LeftClick(p.X + ox, p.Y + oy, ClickDurationSec, returnToOriginal: false);
            case D4ActionKind.Attack:
                if (decision.Target is not { } t) return false;
                int x = t.X + ox, y = t.Y + oy;
                return decision.Key switch
                {
                    D4AgentConstants.KeyLeftClick => _click.LeftClick(x, y, ClickDurationSec, returnToOriginal: false),
                    D4AgentConstants.KeyRightClick => _click.RightClick(x, y, ClickDurationSec, returnToOriginal: false),
                    { } key => _click.MoveMouseTo(x, y) && _click.PressKey(key),
                    _ => false,
                };
            default:
                return false;
        }
    }
}
