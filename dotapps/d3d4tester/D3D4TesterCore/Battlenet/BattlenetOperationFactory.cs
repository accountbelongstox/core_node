// PY-REF: pyapps/d3-check/d3utils/battlenet_operation.py
using System.Collections.Concurrent;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Region-specific Battle.net operation, singleton per region. Region: explicit "asia"/"cn", else ResolveRegion; unknown falls
/// back to Asia. 1:1 Python d3utils/battlenet_operation.py.
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

    /// <summary>
    /// The one region resolver for the running client and its account: the region the client UI shows, then the user's global
    /// choice, then GameInterfaceData, then the config cache; null when all are unknown. 1:1 Python _resolve_battlenet_region
    /// (+ DOT UI region and global choice first).
    /// </summary>
    public static string? ResolveRegion()
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        foreach (string? r in new[] { snapshot.BattlenetUiRegion, BattlenetManager.Instance.GetConfiguredRegion(), snapshot.BattlenetRegion })
            if (IsKnown(r)) return r;
        string? cached = BattlenetFlowHooks.RegionCacheProvider?.Invoke();
        return IsKnown(cached) ? cached : null;
    }

    private static bool IsKnown(string? region) => region == BattlenetConstants.RegionAsia || region == BattlenetConstants.RegionCn;
}
