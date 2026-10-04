// PY-REF: pyapps/d3-check/utils/_obsolete_d3keyhelper.ahk (gambleHelper)
using DotApps.d3d4tester.Core.Bag;
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.Assistant;

/// <summary>
/// Blood shard gamble at Kadala: right-click the item under the cursor repeatedly (D3KeyHelper gambleHelper).
/// The click count is the bag capacity for the configured type (jewelry = 1 cell, other types = 2 cells), capped; unknown bag -> default count.
/// </summary>
public static class BloodShardGamble
{
    public const string TypeJewelry = "jewelry";
    private const int DefaultClicks = 15;
    private const int MaxClicks = 60;
    private const string LogTag = "[BloodShard]";

    public static bool Run(string? type, int helperDelayMs, Func<bool> shouldStop)
    {
        int clicks = ClickCount(type);
        ColorPrinter.Blue($"{LogTag} Gamble type={type ?? "-"}: right-click {clicks} times at cursor");
        int done = 0;
        for (; done < clicks; done++)
        {
            if (shouldStop()) break;
            ClickHandler.MouseButtonDown(MouseButton.Right);
            ClickHandler.MouseButtonUp(MouseButton.Right);
            Thread.Sleep(Math.Max(1, helperDelayMs / 4));
        }
        ColorPrinter.Green($"{LogTag} Done ({done} clicks)");
        return done > 0;
    }

    private static int ClickCount(string? type)
    {
        var layout = GameInterfaceData.Instance.BagLayout;
        var coords = GameInterfaceData.Instance.BagCoordinates;
        if (layout == null || coords == null) return DefaultClicks;
        bool Empty(int r, int c) => layout.Items.TryGetValue((r, c), out var i) && i.Type == BagSlotValues.TypeEmpty;
        int capacity = 0;
        if (type == TypeJewelry)
        {
            for (int r = 0; r < coords.Rows; r++)
                for (int c = 0; c < coords.Cols; c++)
                    if (Empty(r, c)) capacity++;
        }
        else
        {
            for (int c = 0; c < coords.Cols; c++)
                for (int r = 0; r + 1 < coords.Rows; r++)
                    if (Empty(r, c) && Empty(r + 1, c)) { capacity++; r++; }
        }
        return Math.Clamp(capacity, 0, MaxClicks);
    }
}
