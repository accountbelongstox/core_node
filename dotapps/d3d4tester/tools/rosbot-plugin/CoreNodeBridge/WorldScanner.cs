// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>Ground item, NPC or carried item as published to the app.</summary>
internal sealed class EntityInfo
{
    public uint Id;
    public int AcdId;
    public string Name = "";
    public string InternalName = "";
    public int Sno;
    public int Gbid;
    public double Distance;
    public double InteractDistance;
    public int Quality = -1;
    public int AncientRank = -1;
    public int Stack;
    public bool Equipped;
    /// <summary>ROSBOT InventorySlot name (Backpack, Stash, Head, ...), "" when unknown.</summary>
    public string Slot = "";
    /// <summary>Grid cell (column, row) inside the backpack / stash, -1 when unknown.</summary>
    public int InvX = -1;
    public int InvY = -1;
    public int DurabilityCur;
    public int DurabilityMax;
    public bool Elite;
    public bool Boss;
    /// <summary>Watched affix values (ItemWatch), null when the item is not watched.</summary>
    public Dictionary<string, double> Attrs;
}

/// <summary>
/// Reads ROSBOT's actor and ACD lists: items on the ground, NPCs and nearby monsters, and the items the hero has. Item ACDs are
/// those of ROSBOT's ActorType.Item (D3 value 8); their location comes from the InventorySlot-typed property of ROSBOT's ACD class
/// (read by reflection: the plugin API does not expose it, the member name is obfuscated but its enum type name is not), so equipped,
/// backpack and stash items are told apart; without it Item_Equipped marks the worn ones and the rest count as carried.
/// Attributes are looked up by name in ROSBOT's own AttributeId enum, names of ACD-only items from its ActorId enum. Every item
/// carries its GameBalanceId; items selected by the ItemWatch also carry the watched affix values.
/// </summary>
internal static class WorldScanner
{
    public const double GroundItemRange = 80;
    public const double NpcRange = 120;
    public const int MaxGroundItems = 60;
    public const int MaxNpcs = 40;
    public const int MaxCarriedItems = 400;
    private const int DefaultItemActorType = 8;
    private const string ActorTypeEnumName = "ActorType";
    private const string ActorTypeItem = "Item";
    private const string InventorySlotEnumName = "InventorySlot";
    private const string SlotUnknown = "Unknown";
    private const string SlotMerchant = "Merchant";

    private static readonly int ItemActorType = ResolveItemActorType();
    private static readonly Dictionary<Type, PropertyInfo> SlotProperties = new();
    private static readonly Dictionary<Type, (PropertyInfo X, PropertyInfo Y)> CellProperties = new();
    private const int BackpackColumns = 10;
    private const int BackpackRows = 6;
    private static readonly Dictionary<string, int> AttributeIds = new(StringComparer.Ordinal);

    /// <summary>Set by the plugin: items whose affixes are read.</summary>
    public static ItemWatch Watch;

    public static List<EntityInfo> GroundItems(IActor[] actors) =>
        actors.Where(a => Safe(() => a.IsValid && a.IsItem, false) && Safe(() => a.Distance, float.MaxValue) <= GroundItemRange)
            .OrderBy(a => Safe(() => a.Distance, float.MaxValue))
            .Take(MaxGroundItems)
            .Select(a =>
            {
                var info = FromActor(a);
                var acd = Safe(() => a.CommData, null);
                if (acd != null) FillItemAttributes(info, acd);
                return info;
            })
            .ToList();

    public static List<EntityInfo> Npcs(IActor[] actors) =>
        actors.Where(a => Safe(() => a.IsValid && a.IsNpc, false) && Safe(() => a.Distance, float.MaxValue) <= NpcRange)
            .OrderBy(a => Safe(() => a.Distance, float.MaxValue))
            .Take(MaxNpcs)
            .Select(FromActor)
            .ToList();

    public static (int Monsters, int Elites) MonsterCounts(IActor[] actors)
    {
        int monsters = 0, elites = 0;
        foreach (var a in actors)
        {
            if (!Safe(() => a.IsValid && a.IsMonster && !a.IsDead && a.IsHostile, false)) continue;
            monsters++;
            if (Safe(() => a.IsElite || a.IsBoss, false)) elites++;
        }
        return (monsters, elites);
    }

    public static List<EntityInfo> CarriedItems(IAcd[] acds, IEnumerable<EntityInfo> groundItems)
    {
        var onGround = new HashSet<int>(groundItems.Select(g => g.AcdId));
        var result = new List<EntityInfo>();
        foreach (var acd in acds)
        {
            if (result.Count >= MaxCarriedItems) break;
            if (!Safe(() => acd.IsValid, false) || Safe(() => acd.Type, -1) != ItemActorType) continue;
            int acdId = Safe(() => acd.AcdId, 0);
            if (onGround.Contains(acdId)) continue;
            string slot = InventorySlotName(acd);
            if (slot == SlotUnknown || slot == SlotMerchant) continue;
            int sno = Safe(() => acd.SnoId, 0);
            string name = ActorName(sno);
            var info = new EntityInfo { AcdId = acdId, Sno = sno, Name = name, InternalName = name, Slot = slot };
            FillItemAttributes(info, acd);
            ReadCell(info, acd);
            result.Add(info);
        }
        return result;
    }

    /// <summary>True once ROSBOT's ACD class exposed an InventorySlot property (equipped / backpack / stash are then exact).</summary>
    public static bool SlotSupported { get; private set; }

    /// <summary>ROSBOT InventorySlot name of the item ACD, "" when ROSBOT's ACD class has no such property.</summary>
    private static string InventorySlotName(IAcd acd)
    {
        var type = acd.GetType();
        if (!SlotProperties.TryGetValue(type, out var prop))
        {
            prop = type.GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
                .FirstOrDefault(p => p.PropertyType.IsEnum && p.PropertyType.Name == InventorySlotEnumName && p.GetIndexParameters().Length == 0);
            SlotProperties[type] = prop;
            SlotSupported |= prop != null;
        }
        return prop == null ? "" : Safe(() => prop.GetValue(acd)?.ToString(), "") ?? "";
    }

    /// <summary>True once backpack cells were read and every backpack item fell inside the 10 x 6 grid.</summary>
    public static bool CellSupported { get; private set; }

    /// <summary>
    /// Grid cell of the item: the two int properties declared right after the InventorySlot property of ROSBOT's ACD class (D3 keeps
    /// the location slot, column and row together). Backpack values outside the 10 x 6 grid disable the cells (published as -1).
    /// </summary>
    private static void ReadCell(EntityInfo info, IAcd acd)
    {
        var type = acd.GetType();
        if (!CellProperties.TryGetValue(type, out var cell))
        {
            var props = type.GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
                .Where(p => p.GetIndexParameters().Length == 0).OrderBy(p => p.MetadataToken).ToList();
            int slotIndex = props.FindIndex(p => p.PropertyType.IsEnum && p.PropertyType.Name == InventorySlotEnumName);
            var ints = slotIndex < 0 ? new List<PropertyInfo>() : props.Skip(slotIndex + 1).Where(p => p.PropertyType == typeof(int)).Take(2).ToList();
            cell = ints.Count == 2 ? (ints[0], ints[1]) : (null, null);
            CellProperties[type] = cell;
            CellSupported = cell.X != null;
        }
        if (cell.X == null || !CellSupported) return;
        int x = Safe(() => (int)cell.X.GetValue(acd), -1), y = Safe(() => (int)cell.Y.GetValue(acd), -1);
        if (info.Slot == "Backpack" && (x < 0 || x >= BackpackColumns || y < 0 || y >= BackpackRows))
        {
            CellSupported = false;
            return;
        }
        info.InvX = x;
        info.InvY = y;
    }

    /// <summary>ROSBOT's ActorType.Item value (found by enum name in ROSBOT's assembly), else the D3 value 8.</summary>
    private static int ResolveItemActorType()
    {
        try
        {
            var enumType = typeof(IActor).Assembly.GetTypes().FirstOrDefault(t => t.IsEnum && t.Name == ActorTypeEnumName && Enum.IsDefined(t, ActorTypeItem));
            return enumType == null ? DefaultItemActorType : Convert.ToInt32(Enum.Parse(enumType, ActorTypeItem));
        }
        catch (Exception ex) when (ex is ReflectionTypeLoadException or ArgumentException or InvalidCastException)
        {
            return DefaultItemActorType;
        }
    }

    /// <summary>ROSBOT's ActorId enum name for an actor SNO id (its values are the SNO ids), or "".</summary>
    public static string ActorName(int sno) => Safe(() => Enum.GetName(typeof(ActorId), sno), null) ?? "";

    public static string ItemAcdTypesText => ItemActorType.ToString();

    private static EntityInfo FromActor(IActor a) => new()
    {
        Id = Safe(() => a.RActorId, 0u),
        AcdId = Safe(() => a.AcdId, 0),
        Name = Safe(() => a.Name, "") ?? "",
        InternalName = Safe(() => a.InternalName, "") ?? "",
        Sno = Safe(() => a.ActorSnoId, 0),
        Distance = Safe(() => a.Distance, 0f),
        InteractDistance = Safe(() => a.Interactdistance, 0d),
        Elite = Safe(() => a.IsElite, false),
        Boss = Safe(() => a.IsBoss, false),
    };

    private static void FillItemAttributes(EntityInfo info, IAcd acd)
    {
        info.Quality = Attribute(acd, "Item_Quality_Level", -1);
        info.AncientRank = Attribute(acd, "Ancient_Rank", -1);
        info.Stack = Attribute(acd, "ItemStackQuantityLo", 0);
        info.Equipped = Attribute(acd, "Item_Equipped", 0) != 0;
        info.DurabilityCur = Attribute(acd, "Durability_Cur", 0);
        info.DurabilityMax = Attribute(acd, "Durability_Max", 0);
        info.Gbid = Safe(() => acd.Gball, 0);
        if (info.Slot.Length > 0) info.Equipped |= info.Slot != "Backpack" && info.Slot != "Stash";
        if (Watch != null && Watch.IsWatched(info.Gbid, info.InternalName)) info.Attrs = Watch.Read(acd);
    }

    private static int Attribute(IAcd acd, string name, int fallback)
    {
        if (!AttributeIds.TryGetValue(name, out int id))
        {
            id = Safe(() => (int)Enum.Parse(typeof(AttributeId), name), int.MinValue);
            AttributeIds[name] = id;
        }
        return id == int.MinValue ? fallback : Safe(() => acd.GetAttribute<int>(id), fallback);
    }

    public static T Safe<T>(Func<T> getter, T fallback)
    {
        try
        {
            return getter();
        }
        catch
        {
            return fallback;
        }
    }
}
