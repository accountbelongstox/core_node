// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Gear-set alignment in town (d3planner build + bridge plugin), driven by the 1 s TickDriver.
/// Equip: while the backpack holds upgrades for unaligned planned items (D3PlannerService.Alignment), town_hold.txt asks the plugin to
/// hold the next town visit (ROSBOT's town run before it salvages, or follow mode before the banner). During the hold D3 comes to the
/// front, the inventory opens, every upgrade is right-clicked (equipped) and the hold is released. Each item is tried once per session,
/// so a swap the game resolves differently (ring hands) cannot loop. Equipping takes the GameControl lease; app exit clears the flag.
/// Gamble: RosbotGambleSettings keeps ROSBOT's Kadala gambling on the unaligned items only, from a full blood shard bar, until all align.
/// </summary>
public static class D3PlannerTownService
{
    private const string LogTag = "[D3PlannerTown]";
    private const int InventorySettleMs = 700;
    private const int EquipClickMs = 500;
    private const int LeaseWaitMs = 15000;
    private const string LeaseEquip = "town equip";

    private static readonly HashSet<int> Tried = new();
    private static bool? _holdWritten;
    private static int _equipping;
    private static int _installed;

    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(OnTick);
        ShutdownManager.RegisterShutdownHook(() => WriteHold(false, force: true));
    }

    private static void OnTick(IFlowTick tick)
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (snapshot.RosbotBridge is not { } state || !snapshot.RosbotBridgeFresh) return;
        var alignment = D3PlannerService.Build != null ? D3PlannerService.Alignment() : PlannerAlignment.Empty;
        UpdateGamble(alignment, state.MaxBloodShards);
        if (Volatile.Read(ref _equipping) == 1) return;
        List<PlannerUpgrade> upgrades;
        lock (Tried)
            upgrades = ConfigBinding.GetValue(ConfigKeys.D3PlannerEquipInTown, ConfigKeys.D3PlannerEquipInTownDefault)
                ? alignment.Upgrades.Where(u => !Tried.Contains(u.Item.AcdId)).ToList()
                : new List<PlannerUpgrade>();
        if (!state.TownHold)
        {
            WriteHold(upgrades.Count > 0);
            return;
        }
        if (Interlocked.Exchange(ref _equipping, 1) == 1) return;
        Task.Run(() => Equip(upgrades, state.UiInventoryOpen, state.TownHoldReason));
    }

    private static void Equip(IReadOnlyList<PlannerUpgrade> upgrades, bool inventoryOpen, string reason)
    {
        try
        {
            if (upgrades.Count == 0) return;
            using var lease = GameControl.TryAcquire(LeaseEquip, LeaseWaitMs);
            if (lease == null) return;
            ColorPrinter.Blue($"{LogTag} town hold ({reason}): equip {upgrades.Count} build item(s)");
            if (!D3Manager.Instance.ActivateWindow())
            {
                ColorPrinter.Yellow($"{LogTag} D3 window not activated, nothing equipped");
                return;
            }
            string key = ConfigBinding.GetValue(ConfigKeys.D3PlannerInventoryKey, ConfigKeys.D3PlannerInventoryKeyDefault);
            if (!inventoryOpen)
            {
                ClickHandler.Instance.PressKey(key);
                Thread.Sleep(InventorySettleMs);
            }
            var bag = D3InterfaceManager.Instance.CollectBagInfoQuik(forceRefresh: true);
            if (bag == null)
            {
                ColorPrinter.Yellow($"{LogTag} backpack grid not found, nothing equipped");
                return;
            }
            var offset = GameInterfaceData.Instance.WindowOffset;
            foreach (var upgrade in upgrades)
            {
                lock (Tried) Tried.Add(upgrade.Item.AcdId);
                var (x, y) = bag.SlotCenter(upgrade.Item.InvY, upgrade.Item.InvX);
                bool clicked = ClickHandler.Instance.ClickAtGameCoord(x, y, offset, button: MouseButton.Right);
                ColorPrinter.Green($"{LogTag} {(clicked ? "equipped" : "click failed")}: {D3PlannerService.SlotName(upgrade.Match.Planned)} "
                    + $"{D3PlannerService.ItemName(upgrade.Match.Planned)} (cell {upgrade.Item.InvX},{upgrade.Item.InvY}, affixes {upgrade.Match.OkStats}/{upgrade.Match.CheckedStats})");
                Thread.Sleep(EquipClickMs);
            }
            if (!inventoryOpen) ClickHandler.Instance.PressKey(key);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogTag} equip failed: {ex.Message}");
        }
        finally
        {
            WriteHold(false, force: true);
            Volatile.Write(ref _equipping, 0);
        }
    }

    private static void UpdateGamble(PlannerAlignment alignment, int maxShards)
    {
        if (D3PlannerService.Build is not { } build || D3PlannerService.Profile is not { } profile || alignment.Unaligned.Count == 0
            || !ConfigBinding.GetValue(ConfigKeys.D3PlannerGambleUnaligned, ConfigKeys.D3PlannerGambleUnalignedDefault))
        {
            RosbotGambleSettings.Restore();
            return;
        }
        var keys = alignment.Unaligned.Select(i => RosbotGambleSettings.KeyFor(i, profile, build.Class)).OfType<string>().ToHashSet(StringComparer.Ordinal);
        if (keys.Count == 0) RosbotGambleSettings.Restore();
        else RosbotGambleSettings.Apply(keys, maxShards);
    }

    private static void WriteHold(bool hold, bool force = false)
    {
        if (!force && _holdWritten == hold) return;
        if (RosbotBridgePluginService.SaveTownHold(hold)) _holdWritten = hold;
    }
}
