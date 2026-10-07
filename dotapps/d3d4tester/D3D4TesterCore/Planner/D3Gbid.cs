// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Planner;

/// <summary>D3 GameBalanceId of an item record name: lowercase name hashed as hash = hash * 33 + char (32-bit wrap), the hash D3 uses for item GBIDs.</summary>
public static class D3Gbid
{
    private const int Multiplier = 33;

    public static int Of(string itemName)
    {
        int hash = 0;
        unchecked
        {
            foreach (char c in itemName.ToLowerInvariant()) hash = hash * Multiplier + c;
        }
        return hash;
    }
}
