using System.Collections.Concurrent;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Region-specific Battle.net operation, singleton per region. Region: explicit "asia"/"cn", else GameInterfaceData, else config
/// ros_settings.battlenet_region_cache; unknown falls back to Asia. 1:1 Python d3utils/battlenet_operation.py.
/// </summary>
public static class BattlenetOperationFactory
{
    private static readonly ConcurrentDictionary<string, BattlenetOperationBase> Cache = new();

    /// <summary>1:1 Python get_battlenet_operation(region).</summary>
    public static IBattlenetOperation GetOperation(string? region = null) => GetOperationBase(region);

    /// <summary>Same singleton as GetOperation, typed as the shared base.</summary>
    public static BattlenetOperationBase GetOperationBase(string? region = null)
    {
        string resolved = (IsKnown(region) ? region : ResolveRegion()) ?? BattlenetConstants.RegionAsia;
        return Cache.GetOrAdd(resolved, r => r == BattlenetConstants.RegionCn ? new BattlenetOperationCn() : new BattlenetOperationAsia());
    }

    /// <summary>Asia login ops for the Asia singleton. 1:1 Python get_battlenet_asia_ops.</summary>
    public static BattlenetAsiaOps GetAsiaOps(string? region = null)
    {
        var op = GetOperationBase(region);
        return op is BattlenetOperationAsia asia ? asia.AsiaOps : new BattlenetAsiaOps(op);
    }

    /// <summary>GameInterfaceData region first, then config cache. 1:1 Python _resolve_battlenet_region.</summary>
    public static string? ResolveRegion()
    {
        string? r = GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;
        if (IsKnown(r)) return r;
        string? cached = BattlenetFlowHooks.RegionCacheProvider?.Invoke();
        return IsKnown(cached) ? cached : null;
    }

    private static bool IsKnown(string? region) => region == BattlenetConstants.RegionAsia || region == BattlenetConstants.RegionCn;
}
