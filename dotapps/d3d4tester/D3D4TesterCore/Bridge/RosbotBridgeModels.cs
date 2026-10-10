// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DotApps.d3d4tester.Core.Bridge;

/// <summary>
/// Plugin date fields: ISO 8601 UTC, or "" / null for "not set" (the plugin's JsonWriter writes DateTime.MinValue as ""), read as
/// default instead of failing the whole state.
/// </summary>
public sealed class RosbotBridgeDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return default;
        string? text = reader.GetString();
        return string.IsNullOrEmpty(text) ? default
            : DateTime.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal);
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value == default ? "" : value.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture));
}

/// <summary>Area visit in the plugin's history.</summary>
public sealed record RosbotBridgeAreaVisit([property: JsonPropertyName("sno")] int Sno, [property: JsonPropertyName("utc")] DateTime Utc);

/// <summary>state.json written by the CoreNodeBridge ROSBOT plugin (field names fixed by tools/rosbot-plugin/CoreNodeBridge).</summary>
public sealed record RosbotBridgeState(
    [property: JsonPropertyName("updated_utc")] DateTime UpdatedUtc,
    [property: JsonPropertyName("plugin_version")] string PluginVersion,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("valid")] bool Valid,
    [property: JsonPropertyName("in_game")] bool InGame,
    [property: JsonPropertyName("level_area_sno")] int LevelAreaSno,
    [property: JsonPropertyName("level_area_since_utc")] DateTime LevelAreaSinceUtc,
    [property: JsonPropertyName("scene_sno")] int SceneSno,
    [property: JsonPropertyName("global_world_id")] int GlobalWorldId,
    [property: JsonPropertyName("world_id")] int WorldId,
    [property: JsonPropertyName("in_town")] bool InTown,
    [property: JsonPropertyName("in_rift")] bool InRift,
    [property: JsonPropertyName("greater_rift")] bool GreaterRift,
    [property: JsonPropertyName("nephalem_rift")] bool NephalemRift,
    [property: JsonPropertyName("greater_rift_level")] int GreaterRiftLevel,
    [property: JsonPropertyName("rift_keys")] int RiftKeys,
    [property: JsonPropertyName("blood_shards")] int BloodShards,
    [property: JsonPropertyName("paragon")] int Paragon,
    [property: JsonPropertyName("actor_class")] int ActorClass,
    [property: JsonPropertyName("health_pct")] double HealthPct,
    [property: JsonPropertyName("dead")] bool Dead,
    [property: JsonPropertyName("in_combat")] bool InCombat,
    [property: JsonPropertyName("inventory_full")] bool InventoryFull,
    [property: JsonPropertyName("sequence")] string Sequence,
    [property: JsonPropertyName("last_event")] string LastEvent,
    [property: JsonPropertyName("level_area_history")] IReadOnlyList<RosbotBridgeAreaVisit>? LevelAreaHistory)
{
    [JsonPropertyName("repair_needed")] public bool RepairNeeded { get; init; }
    /// <summary>The plugin was just enabled and does not read game data yet (ROSBOT's startup must not be disturbed).</summary>
    [JsonPropertyName("starting")] public bool Starting { get; init; }
    /// <summary>Blood shard cap of the hero (ROSBOT LocalPlayer.MaxShard); 0 = unknown (older plugin).</summary>
    [JsonPropertyName("max_blood_shards")] public int MaxBloodShards { get; init; }
    /// <summary>The plugin holds this town visit (ROSBOT's town run or follow) until the app clears town_hold.txt.</summary>
    [JsonPropertyName("town_hold")] public bool TownHold { get; init; }
    [JsonPropertyName("town_hold_reason")] public string TownHoldReason { get; init; } = "";
    [JsonPropertyName("town_hold_since_utc")] public DateTime TownHoldSinceUtc { get; init; }

    public bool BloodShardsFull => MaxBloodShards > 0 && BloodShards >= MaxBloodShards;
    [JsonPropertyName("monsters_nearby")] public int MonstersNearby { get; init; }
    [JsonPropertyName("elites_nearby")] public int ElitesNearby { get; init; }
    [JsonPropertyName("picked_count")] public int PickedCount { get; init; }
    [JsonPropertyName("item_acd_types")] public string ItemAcdTypes { get; init; } = "";
    [JsonPropertyName("pickup_filter_auto")] public bool PickupFilterAuto { get; init; }
    [JsonPropertyName("pickup_filter")] public string PickupFilter { get; init; } = "";
    [JsonPropertyName("item_watch_unknown")] public string ItemWatchUnknown { get; init; } = "";
    [JsonPropertyName("inventory_slot_supported")] public bool InventorySlotSupported { get; init; }
    [JsonPropertyName("inventory_cell_supported")] public bool InventoryCellSupported { get; init; }
    [JsonPropertyName("follow_enabled")] public bool FollowEnabled { get; init; }
    [JsonPropertyName("follow_state")] public string FollowState { get; init; } = "";
    [JsonPropertyName("follow_pickup")] public bool FollowPickup { get; init; }
    [JsonPropertyName("follow_mode")] public string FollowMode { get; init; } = "";
    [JsonPropertyName("follow_leader")] public string FollowLeader { get; init; } = "";
    [JsonPropertyName("follow_distance")] public double FollowDistance { get; init; } = -1;
    [JsonPropertyName("follow_revive")] public bool FollowRevive { get; init; }
    /// <summary>Town standby (app "return to town and stand by"): on, state (reviving / needs_town / in_town) and since when.</summary>
    [JsonPropertyName("standby_enabled")] public bool StandbyEnabled { get; init; }
    [JsonPropertyName("standby_state")] public string StandbyState { get; init; } = "";
    [JsonPropertyName("standby_since_utc")] public DateTime StandbySinceUtc { get; init; }
    [JsonPropertyName("last_event_utc")] public DateTime LastEventUtc { get; init; }
    [JsonPropertyName("players")] public IReadOnlyList<RosbotBridgeEntity> Players { get; init; } = Array.Empty<RosbotBridgeEntity>();
    [JsonPropertyName("ui_vendor_open")] public bool UiVendorOpen { get; init; }
    [JsonPropertyName("ui_salvage_open")] public bool UiSalvageOpen { get; init; }
    [JsonPropertyName("ui_inventory_open")] public bool UiInventoryOpen { get; init; }
    [JsonPropertyName("ground_items")] public IReadOnlyList<RosbotBridgeEntity> GroundItems { get; init; } = Array.Empty<RosbotBridgeEntity>();
    [JsonPropertyName("npcs")] public IReadOnlyList<RosbotBridgeEntity> Npcs { get; init; } = Array.Empty<RosbotBridgeEntity>();
    [JsonPropertyName("carried_items")] public IReadOnlyList<RosbotBridgeEntity> CarriedItems { get; init; } = Array.Empty<RosbotBridgeEntity>();
    [JsonPropertyName("pickups")] public IReadOnlyList<RosbotBridgePickup> Pickups { get; init; } = Array.Empty<RosbotBridgePickup>();
    [JsonPropertyName("last_command")] public RosbotBridgeCommandResult? LastCommand { get; init; }
    /// <summary>Command the plugin is executing right now (Ok / Message unused), or null.</summary>
    [JsonPropertyName("running_command")] public RosbotBridgeCommandResult? RunningCommand { get; init; }

    /// <summary>state.json older than this means the plugin is not running (disabled in ROSBOT, or ROSBOT stopped).</summary>
    public const int StaleSec = 5;

    public bool IsStale(DateTime nowUtc) => (nowUtc - UpdatedUtc).TotalSeconds > StaleSec;
}

/// <summary>Ground item, NPC or carried item from the plugin (Id = ROSBOT RActorId; carried items have only AcdId).</summary>
public sealed record RosbotBridgeEntity(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("acd_id")] int AcdId,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("internal_name")] string InternalName,
    [property: JsonPropertyName("sno")] int Sno,
    [property: JsonPropertyName("distance")] double Distance,
    [property: JsonPropertyName("interact_distance")] double InteractDistance,
    [property: JsonPropertyName("quality")] int Quality,
    [property: JsonPropertyName("ancient_rank")] int AncientRank,
    [property: JsonPropertyName("stack")] int Stack,
    [property: JsonPropertyName("equipped")] bool Equipped,
    [property: JsonPropertyName("durability_cur")] int DurabilityCur,
    [property: JsonPropertyName("durability_max")] int DurabilityMax,
    [property: JsonPropertyName("elite")] bool Elite,
    [property: JsonPropertyName("boss")] bool Boss,
    [property: JsonPropertyName("filter_match")] bool FilterMatch)
{
    [JsonPropertyName("slot")] public string Slot { get; init; } = "";
    /// <summary>Backpack / stash grid cell (column, row), -1 when the plugin cannot read it.</summary>
    [JsonPropertyName("inv_x")] public int InvX { get; init; } = -1;
    [JsonPropertyName("inv_y")] public int InvY { get; init; } = -1;
    /// <summary>Players: party slot from the town banners (0 unknown) and the Leader attribute.</summary>
    [JsonPropertyName("party_slot")] public int PartySlot { get; init; }
    [JsonPropertyName("is_leader")] public bool IsLeader { get; init; }
    [JsonPropertyName("gbid")] public int Gbid { get; init; }
    [JsonPropertyName("attrs")] public IReadOnlyDictionary<string, double>? Attrs { get; init; }
}

/// <summary>Live pickup (item vanished next to the hero) or stash event.</summary>
public sealed record RosbotBridgePickup(
    [property: JsonPropertyName("utc")] DateTime Utc,
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("internal_name")] string InternalName,
    [property: JsonPropertyName("sno")] int Sno,
    [property: JsonPropertyName("quality")] int Quality,
    [property: JsonPropertyName("ancient_rank")] int AncientRank)
{
    [JsonPropertyName("gbid")] public int Gbid { get; init; }
    [JsonPropertyName("attrs")] public IReadOnlyDictionary<string, double>? Attrs { get; init; }
}

public sealed record RosbotBridgeCommandResult(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("action")] string Action,
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("utc")] DateTime Utc);
