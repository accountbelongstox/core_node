namespace DotApps.d3d4tester.Core.Flow.ActionGroups;

/// <summary>Step result: Ok = advance to the next step next tick; Done = group finished; Fail = abort.</summary>
public enum ActionStepResult
{
    Ok,
    Done,
    Fail,
}

/// <summary>One action group: id and ordered steps; each tick runs one step. 1:1 Python action_groups.ActionGroupDef.</summary>
public sealed class ActionGroupDef
{
    public ActionGroupDef(string id, IReadOnlyList<Func<Dictionary<string, object?>, ActionStepResult>> steps)
    {
        Id = id;
        Steps = steps;
    }

    public string Id { get; }

    public IReadOnlyList<Func<Dictionary<string, object?>, ActionStepResult>> Steps { get; }

    public ActionStepResult RunStep(int stepIndex, Dictionary<string, object?> context)
    {
        if (stepIndex < 0 || stepIndex >= Steps.Count)
            return ActionStepResult.Fail;
        return Steps[stepIndex](context);
    }
}

/// <summary>
/// Registry of one-step-per-tick action groups (e.g. map teleport). While a group runs, the tick runs only one step.
/// 1:1 Python d3utils/rosbot_flow/action_groups/__init__.py.
/// </summary>
public static class ActionGroupRegistry
{
    private static readonly object Lock = new();
    private static readonly Dictionary<string, ActionGroupDef> Registry = new(StringComparer.Ordinal)
    {
        [MapTeleportGroup.GroupId] = MapTeleportGroup.Create(),
    };

    public static void Register(ActionGroupDef group)
    {
        lock (Lock) Registry[group.Id] = group;
    }

    public static ActionGroupDef? Get(string? groupId)
    {
        if (string.IsNullOrEmpty(groupId)) return null;
        lock (Lock) return Registry.TryGetValue(groupId, out var g) ? g : null;
    }

    public static IReadOnlyDictionary<string, ActionGroupDef> GetRegistry()
    {
        lock (Lock) return new Dictionary<string, ActionGroupDef>(Registry);
    }
}
