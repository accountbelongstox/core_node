// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Linq;
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
    public double Distance;
    public double InteractDistance;
    public int Quality = -1;
    public int AncientRank = -1;
    public int Stack;
    public bool Equipped;
    public int DurabilityCur;
    public int DurabilityMax;
    public bool Elite;
    public bool Boss;
}

/// <summary>
/// Reads ROSBOT's actor and ACD lists: items on the ground, NPCs and nearby monsters, and the items the hero carries.
/// ROSBOT exposes no inventory slot, so carried items are the ACDs of the item ACD types (learned from ground items, D3 default
/// 2) that are not lying on the ground: backpack, stash and equipped together; Item_Equipped marks the worn ones.
/// Attributes are looked up by name in ROSBOT's own AttributeId enum, names of ACD-only items from its ActorId enum.
/// </summary>
internal static class WorldScanner
{
    public const double GroundItemRange = 80;
    public const double NpcRange = 120;
    public const int MaxGroundItems = 60;
    public const int MaxNpcs = 40;
    public const int MaxCarriedItems = 400;
    private const int DefaultItemAcdType = 2;

    private static readonly HashSet<int> ItemAcdTypes = new() { DefaultItemAcdType };
    private static readonly Dictionary<string, int> AttributeIds = new(StringComparer.Ordinal);

    public static List<EntityInfo> GroundItems(IActor[] actors) =>
        actors.Where(a => Safe(() => a.IsValid && a.IsItem, false) && Safe(() => a.Distance, float.MaxValue) <= GroundItemRange)
            .OrderBy(a => Safe(() => a.Distance, float.MaxValue))
            .Take(MaxGroundItems)
            .Select(a =>
            {
                var info = FromActor(a);
                var acd = Safe(() => a.CommData, null);
                if (acd != null)
                {
                    LearnItemType(acd);
                    FillItemAttributes(info, acd);
                }
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
            if (!Safe(() => acd.IsValid, false) || !ItemAcdTypes.Contains(Safe(() => acd.Type, -1))) continue;
            int acdId = Safe(() => acd.AcdId, 0);
            if (onGround.Contains(acdId)) continue;
            int sno = Safe(() => acd.SnoId, 0);
            string name = ActorName(sno);
            if (string.IsNullOrEmpty(name)) continue;
            var info = new EntityInfo { AcdId = acdId, Sno = sno, Name = name, InternalName = name };
            FillItemAttributes(info, acd);
            result.Add(info);
        }
        return result;
    }

    /// <summary>ROSBOT's ActorId enum name for an actor SNO id (its values are the SNO ids), or "".</summary>
    public static string ActorName(int sno) => Safe(() => Enum.GetName(typeof(ActorId), sno), null) ?? "";

    public static string ItemAcdTypesText => string.Join(",", ItemAcdTypes);

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

    private static void LearnItemType(IAcd acd)
    {
        int type = Safe(() => acd.Type, -1);
        if (type >= 0) ItemAcdTypes.Add(type);
    }

    private static void FillItemAttributes(EntityInfo info, IAcd acd)
    {
        info.Quality = Attribute(acd, "Item_Quality_Level", -1);
        info.AncientRank = Attribute(acd, "Ancient_Rank", -1);
        info.Stack = Attribute(acd, "ItemStackQuantityLo", 0);
        info.Equipped = Attribute(acd, "Item_Equipped", 0) != 0;
        info.DurabilityCur = Attribute(acd, "Durability_Cur", 0);
        info.DurabilityMax = Attribute(acd, "Durability_Max", 0);
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
