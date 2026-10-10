// PY-REF: dotapps/d3d4tester/reference/py_d3check/utils/_obsolete_d3keyhelper.ahk (oneButtonReforgeHelper, oneButtonUpgradeConvertHelper)
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Blacksmith;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>
/// Kanai Cube reforge loop and material conversion on the open recipe page (D3KeyHelper helpers):
/// reforge = right-click item, Fill, Transmute, previous + next page (item returns to the bag), then check the result per mode;
/// convert = for every bag item of the material's source quality: right-click, Fill, Transmute, next + previous page.
/// </summary>
public static class KanaiRecipeHelper
{
    public const string ModeUntilAncient = "until_ancient";
    public const string ModeDoubleCrit = "double_crit";
    public const string ModeDoubleCritAncient = "double_crit_ancient";
    public static readonly string[] ReforgeModes = { ModeUntilAncient, ModeDoubleCrit, ModeDoubleCritAncient };

    public const string MaterialForgottenSoul = "forgotten_soul";
    public const string MaterialVeiledCrystal = "veiled_crystal";
    public const string MaterialArcaneDust = "arcane_dust";
    public static readonly string[] ConvertMaterials = { MaterialForgottenSoul, MaterialVeiledCrystal, MaterialArcaneDust };

    private const int MaxReforge = 10;
    private const string LogTag = "[KanaiRecipe]";
    private static readonly string[] CritChanceKeywords = { "Critical Hit Chance", "暴击几率", "暴擊機率", "暴击率" };
    private static readonly string[] CritDamageKeywords = { "Critical Hit Damage", "暴击伤害", "暴擊傷害" };

    /// <summary>Reforge the legendary under the cursor (else the first legendary in the bag) until the mode is satisfied, at most MaxReforge times.</summary>
    public static bool RunReforge(GameInterfaceData shared, string? mode, (int X, int Y)? cursor, int helperDelayMs, Func<bool> shouldStop)
    {
        string activeMode = mode != null && Array.IndexOf(ReforgeModes, mode) >= 0 ? mode : ModeUntilAncient;
        var target = FindTargetLegendary(shared, cursor);
        var bag = shared.BagCoordinates;
        if (target == null || bag == null)
        {
            ColorPrinter.Yellow($"{LogTag} No legendary item to reforge");
            return false;
        }
        var (row, col) = target.Value;
        var (ox, oy) = shared.WindowOffset;
        var (sx, sy) = bag.SlotCenter(row, col);
        ColorPrinter.Blue($"{LogTag} Reforge slot ({row},{col}) mode={activeMode}");
        for (int attempt = 1; attempt <= MaxReforge; attempt++)
        {
            if (shouldStop()) return false;
            Transmute(shared, sx + ox, sy + oy, helperDelayMs, returnByPrevFirst: true);
            var read = BlacksmithHandler.Instance.ReadSlotTier(shared, row, col);
            string tier = read?.Tier ?? BagSlotValues.TierNormal;
            bool ancientPlus = tier != BagSlotValues.TierNormal;
            bool doubleCrit = activeMode != ModeUntilAncient && HasDoubleCrit(shared);
            bool done = activeMode switch
            {
                ModeDoubleCrit => doubleCrit,
                ModeDoubleCritAncient => doubleCrit && ancientPlus,
                _ => ancientPlus,
            };
            ColorPrinter.Gray($"{LogTag} Attempt {attempt}: tier={tier} doubleCrit={doubleCrit}");
            if (done)
            {
                ColorPrinter.Green($"{LogTag} Reforge target reached after {attempt} attempt(s)");
                return true;
            }
        }
        ColorPrinter.Yellow($"{LogTag} Reforge stopped after {MaxReforge} attempts");
        return false;
    }

    /// <summary>Convert every bag item of the material's source quality (legendary only when the salvage keep rule would remove it).</summary>
    public static bool RunConvert(GameInterfaceData shared, string? material, string keep, int helperDelayMs, Func<bool> shouldStop)
    {
        string activeMaterial = material != null && Array.IndexOf(ConvertMaterials, material) >= 0 ? material : MaterialForgottenSoul;
        var bag = shared.BagCoordinates;
        if (!BlacksmithHandler.HasBagLayout(shared, "kanai convert") || bag == null) return false;
        var (ox, oy) = shared.WindowOffset;
        int converted = 0;
        foreach (var (r, c, info) in BlacksmithHandler.GearSlots(shared))
        {
            if (shouldStop()) break;
            if (!IsConvertSource(shared, activeMaterial, keep, r, c, info.Quality)) continue;
            var (sx, sy) = bag.SlotCenter(r, c);
            Transmute(shared, sx + ox, sy + oy, helperDelayMs, returnByPrevFirst: false);
            converted++;
        }
        ColorPrinter.Green($"{LogTag} Convert {activeMaterial} done ({converted} items)");
        return true;
    }

    private static bool IsConvertSource(GameInterfaceData shared, string material, string keep, int r, int c, string quality) => material switch
    {
        MaterialVeiledCrystal => quality == BagSlotValues.QualityRare,
        MaterialArcaneDust => quality == BagSlotValues.QualityMagic,
        _ => IsLegendary(quality)
             && BlacksmithHandler.ShouldSalvage(quality, BlacksmithHandler.Instance.ReadSlotTier(shared, r, c)?.Tier ?? BagSlotValues.TierAncient, keep),
    };

    /// <summary>Right-click the item into the cube, Fill, Transmute, then flip pages so the result goes back to the bag.</summary>
    internal static void Transmute(GameInterfaceData shared, int itemX, int itemY, int helperDelayMs, bool returnByPrevFirst)
    {
        var (ox, oy) = shared.WindowOffset;
        var click = StateAwareClickHandler.Instance;
        int step = Math.Max(1, helperDelayMs / 4);
        var (fx, fy) = D3StandardCoordinates.GetScaledKanaiPutMaterialButton();
        var (tx, ty) = D3StandardCoordinates.GetScaledConversionButton();
        var (px, py) = D3StandardCoordinates.GetScaledKanaiRecipePrevPageButton();
        var (nx, ny) = D3StandardCoordinates.GetScaledKanaiNextPageButton();
        var (firstX, firstY) = returnByPrevFirst ? (px, py) : (nx, ny);
        var (secondX, secondY) = returnByPrevFirst ? (nx, ny) : (px, py);
        click.RightClick(itemX, itemY, 0);
        Thread.Sleep(step);
        click.LeftClick(fx + ox, fy + oy, 0);
        Thread.Sleep(step);
        click.LeftClick(tx + ox, ty + oy, 0);
        Thread.Sleep(step);
        click.LeftClick(firstX + ox, firstY + oy, 0);
        Thread.Sleep(step);
        click.LeftClick(secondX + ox, secondY + oy, 0);
        Thread.Sleep(helperDelayMs);
    }

    private static (int Row, int Col)? FindTargetLegendary(GameInterfaceData shared, (int X, int Y)? cursor)
    {
        var bag = shared.BagCoordinates;
        var layout = shared.BagLayout;
        if (bag == null || layout == null) return null;
        if (cursor is { } p)
        {
            var (ox, oy) = shared.WindowOffset;
            int col = (int)Math.Floor((p.X - ox - bag.TopLeft.X) / (bag.Width / (double)bag.Cols));
            int row = (int)Math.Floor((p.Y - oy - bag.TopLeft.Y) / (bag.Height / (double)bag.Rows));
            if (row >= 0 && row < bag.Rows && col >= 0 && col < bag.Cols && layout.Items.TryGetValue((row, col), out var info))
            {
                if (info.Type == BagSlotValues.TypeItem2SlotBottom && row > 0 && layout.Items.TryGetValue((row - 1, col), out var top))
                {
                    row--;
                    info = top;
                }
                if (IsLegendary(info.Quality)) return (row, col);
            }
        }
        foreach (var (r, c, info) in BlacksmithHandler.GearSlots(shared))
            if (IsLegendary(info.Quality)) return (r, c);
        return null;
    }

    private static bool IsLegendary(string quality) => quality is BagSlotValues.QualityLegendary or BagSlotValues.QualityLegendarySet;

    /// <summary>OCR the item tooltip (left of the bag, shown while the slot is hovered) for both crit chance and crit damage.</summary>
    private static bool HasDoubleCrit(GameInterfaceData shared)
    {
        string text = string.Join('\n', KanaiTooltipReader.Capture(shared) ?? Array.Empty<string>());
        return CritChanceKeywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase))
               && CritDamageKeywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
    }
}
