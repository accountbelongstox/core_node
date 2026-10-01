namespace DotApps.d3d4tester.Core.Flow.ActionGroups;

/// <summary>
/// Map teleport action group: minimize map -> wait one tick -> teleport (two clicks); fresh capture per step.
/// 1:1 Python d3utils/rosbot_flow/action_groups/map_teleport.py.
/// </summary>
public static class MapTeleportGroup
{
    public const string GroupId = "map_teleport";

    /// <summary>Context key provided by the extension flow: D3 window titles.</summary>
    public const string ContextKeyTitles = "titles";

    public static ActionGroupDef Create() => new(GroupId, new Func<Dictionary<string, object?>, ActionStepResult>[]
    {
        StepMinimize,
        StepWaitOneTick,
        StepTeleport,
    });

    private static ActionStepResult StepMinimize(Dictionary<string, object?> ctx)
    {
        if (!D3StartGameAndTeleport.HasGameWindowCapture())
            return ActionStepResult.Fail;
        return D3StartGameAndTeleport.StepC7bMinimizeOnly() ? ActionStepResult.Ok : ActionStepResult.Fail;
    }

    private static ActionStepResult StepWaitOneTick(Dictionary<string, object?> ctx) => ActionStepResult.Ok;

    private static ActionStepResult StepTeleport(Dictionary<string, object?> ctx)
    {
        if (!D3StartGameAndTeleport.HasGameWindowCapture())
            return ActionStepResult.Fail;
        return D3StartGameAndTeleport.StepC7bTeleportOnly() ? ActionStepResult.Done : ActionStepResult.Fail;
    }
}
