// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// D3 character-screen layout on a 3-column grid (maxroll slot keys): left = shoulders, hands, left ring, main hand; center = head,
/// torso, belt, legs, feet; right = amulet, bracers, right ring, off hand; a last row for the three Kanai's Cube powers. Also maps the
/// ROSBOT InventorySlot names the bridge plugin publishes to these keys (D3 right hand = main hand).
/// </summary>
public static class D3PaperDollLayout
{
    public const int Columns = 3;
    public const int Rows = 6;

    public static readonly IReadOnlyDictionary<string, (int Row, int Column)> Cells = new Dictionary<string, (int, int)>(StringComparer.Ordinal)
    {
        ["shoulders"] = (0, 0), ["head"] = (0, 1), ["neck"] = (0, 2),
        ["hands"] = (1, 0), ["torso"] = (1, 1), ["wrists"] = (1, 2),
        ["leftfinger"] = (2, 0), ["waist"] = (2, 1), ["rightfinger"] = (2, 2),
        ["mainhand"] = (3, 0), ["legs"] = (3, 1), ["offhand"] = (3, 2),
        ["feet"] = (4, 1),
        ["kanai.weapon"] = (5, 0), ["kanai.armor"] = (5, 1), ["kanai.jewelry"] = (5, 2),
    };

    public static readonly IReadOnlyDictionary<string, string> FromInventorySlot = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["Head"] = "head", ["Torso"] = "torso", ["RightHand"] = "mainhand", ["LeftHand"] = "offhand", ["Hands"] = "hands",
        ["Waist"] = "waist", ["Feet"] = "feet", ["Shoulders"] = "shoulders", ["Legs"] = "legs", ["Bracers"] = "wrists",
        ["LeftFinger"] = "leftfinger", ["RightFinger"] = "rightfinger", ["Neck"] = "neck",
    };
}
