// PY-REF: pyapps/d3-check/utils/_obsolete_d3keyhelper.ahk (oneButtonAbandonHelper)
using DotApps.d3d4tester.Core.Blacksmith;
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.Assistant;

/// <summary>
/// Drop equipment with the inventory open: hover each gear slot to read its tier, and for every item the salvage keep rule would remove,
/// pick it up and click the window center (force-stand key held so the character does not move) to drop it (D3KeyHelper oneButtonAbandonHelper).
/// </summary>
public static class DropEquipment
{
    private const string LogTag = "[DropEquipment]";

    public static bool Run(string keep, ushort? standVk, int helperDelayMs, Func<bool> shouldStop)
    {
        var shared = GameInterfaceData.Instance;
        if (!BlacksmithHandler.HasBagLayout(shared, "drop equipment")) return false;
        var (ox, oy) = shared.WindowOffset;
        var (w, h) = shared.GameWindowSize;
        int dropX = ox + w / 2, dropY = oy + h / 2;
        ClickHandler.TryGetCursorPos(out int startX, out int startY);
        int dropped = 0;
        var handler = BlacksmithHandler.Instance;
        handler.ForEachGearSlotTier(shared, shouldStop, (slotX, slotY, info, tier) =>
        {
            if (!BlacksmithHandler.ShouldSalvage(info.Quality, tier, keep)) return;
            handler.ClickDirect(slotX, slotY);
            Thread.Sleep(helperDelayMs / 2);
            ClickHandler.MoveCursor(dropX, dropY);
            bool stand = standVk.HasValue && ClickHandler.SendVirtualKey(standVk.Value, down: true);
            ClickHandler.MouseButtonDown(MouseButton.Left);
            ClickHandler.MouseButtonUp(MouseButton.Left);
            if (stand) ClickHandler.SendVirtualKey(standVk!.Value, down: false);
            Thread.Sleep(helperDelayMs / 2);
            dropped++;
        });
        ClickHandler.MoveCursor(startX, startY);
        ColorPrinter.Green($"{LogTag} Done (dropped {dropped})");
        return true;
    }
}
