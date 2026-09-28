namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Factory for region-specific Battle.net operations. Returns Asia or CN implementation only; no mixing.
/// Logic 1:1 with Python get_battlenet_operation(path, region) returning BattlenetOperationAsia or BattlenetOperationCN.
/// </summary>
public static class BattlenetOperationFactory
{
    /// <summary>Get operation for the given region. region must be "asia" or "cn"; otherwise returns Asia as default.</summary>
    public static IBattlenetOperation GetOperation(string? region)
    {
        if (string.Equals(region, "cn", StringComparison.OrdinalIgnoreCase))
            return new BattlenetOperationCn();
        return new BattlenetOperationAsia();
    }
}
