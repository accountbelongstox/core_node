// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Constants;

/// <summary>d3planner.* keys: maxroll D3 planner build matched against items seen in game (bridge plugin).</summary>
public static partial class ConfigKeys
{
    public const string D3PlannerUrl = "d3planner.url";
    public const string D3PlannerProfileIndex = "d3planner.profile_index";
    public const string D3PlannerBuildIndex = "d3planner.build_index";
    public const string D3PlannerNotify = "d3planner.notify";
    public const string D3PlannerNotifyPush = "d3planner.notify_push";
    /// <summary>Town visit: equip backpack items that bring the worn gear closer to the gear set (instead of ROSBOT salvaging them).</summary>
    public const string D3PlannerEquipInTown = "d3planner.equip_in_town";
    public const bool D3PlannerEquipInTownDefault = true;
    /// <summary>ROSBOT gambles at Kadala only for gear-set slots not yet aligned, once the blood shards are full.</summary>
    public const string D3PlannerGambleUnaligned = "d3planner.gamble_unaligned";
    public const bool D3PlannerGambleUnalignedDefault = true;
    /// <summary>D3 key that opens / closes the inventory (equip in town).</summary>
    public const string D3PlannerInventoryKey = "d3planner.inventory_key";
    public const string D3PlannerInventoryKeyDefault = "i";
}
