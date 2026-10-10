// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Constants;

/// <summary>ROSBOT plugin config files driven by the ROSBOT page options (formats read from the plugins' own LoadConfig).</summary>
public static class RosbotPluginConstants
{
    public const string PluginsDirName = "plugins";

    /// <summary>ExtPickup ("extra pickup when only primals are picked"): extpick.cfg, one line pickup=&lt;internal names, comma separated&gt;.</summary>
    public const string ExtPickupDirName = "ExtPickup";
    public const string ExtPickupConfigFileName = "extpick.cfg";
    public const string ExtPickupKey = "pickup";
    public static readonly string[] ExtPickupItems =
    {
        "P72_Soulshard_01", "P72_Soulshard_02", "P72_Soulshard_03", "P72_Soulshard_04",
        "P72_Soulshard_05", "P72_Soulshard_06", "P72_Soulshard_07", "P72_Consumable_Add_Soul_Shard_Ranks_flippy",
    };

    /// <summary>BlackWhiteGay ("blue rift fast exit"): rsttcp.cfg key=value lines; enableBlue=True resets the connection at the end of a blue rift.</summary>
    public const string FastExitDirName = "BlackWhiteGay";
    public const string FastExitConfigFileName = "rsttcp.cfg";
    public const string FastExitEnableBlueKey = "enableBlue";

    /// <summary>
    /// CoreNodeBridge (tools/rosbot-plugin): this app's own ROSBOT plugin, bundled under tools\rosbot-plugins and installed to
    /// &lt;ROSBOT&gt;\plugins\CoreNodeBridge; it writes the game state to state.json there once per second.
    /// </summary>
    public const string BridgeDirName = "CoreNodeBridge";
    public const string BridgeDllName = "CoreNodeBridge.dll";
    public const string BridgeStateFileName = "state.json";
    public const string BridgeCommandFileName = "command.txt";
    /// <summary>Plugin drops a command older than this unrun (same as CoreNodeBridge BridgeCommands.CommandMaxAgeSec).</summary>
    public const int BridgeCommandMaxAgeSec = 60;
    public const string BridgeFilterFileName = "pickup_filter.txt";
    /// <summary>Items / affix attributes the plugin reads (same name as CoreNodeBridge ItemWatch.FileName; the plugin cannot reference the app).</summary>
    public const string BridgeItemWatchFileName = "item_watch.txt";
    /// <summary>App town work flag (same name as CoreNodeBridge TownHold.FileName): "1" = hold the next town visit, "0" = none / done.</summary>
    public const string BridgeTownHoldFileName = "town_hold.txt";
    public const string BridgeTownHoldOn = "1";
    public const string BridgeTownHoldOff = "0";
    /// <summary>Pickup record kind for an item put into the stash (other kinds are pickups from the ground).</summary>
    public const string BridgePickupKindStash = "stash";

    public const string BridgeActionMoveTo = "move_to";
    public const string BridgeActionInteract = "interact";
    public const string BridgeActionPickup = "pickup";
    public const string BridgeActionPickupFilter = "pickup_filter";
    public const string BridgeActionClickUi = "click_ui";
    public const string BridgeActionGoNpc = "go_npc";
    public const string BridgeActionSalvageAll = "salvage_all";
    public const string BridgeActionFollow = "follow";
    /// <summary>Plugin command: wait for and click UI elements in order (value = ids / paths separated by BridgeUiSequenceSeparator).</summary>
    public const string BridgeActionUiSequence = "ui_sequence";
    public const string BridgeUiSequenceSeparator = "|";
    /// <summary>Plugin command: town standby on / off (TownStandby; value BridgeStandbyOn / BridgeStandbyOff).</summary>
    public const string BridgeActionStandby = "standby";
    public const string BridgeStandbyOn = "on";
    public const string BridgeStandbyOff = "off";
    /// <summary>Plugin command: hold ROSBOT inside the plugin (PulseHold; value BridgeHoldOn / BridgeHoldOff, off also ends standby).</summary>
    public const string BridgeActionHold = "hold";
    public const string BridgeHoldOn = "on";
    public const string BridgeHoldOff = "off";
    public const string BridgeFollowOff = "off";
    /// <summary>Follow targets (plugin FollowMode modes): nearest player, the selected player, the party leader, party slot 1-4.</summary>
    public const string BridgeFollowNearest = "nearest";
    public const string BridgeFollowSelected = "selected";
    public const string BridgeFollowLeader = "leader";
    public const string BridgeFollowSlot = "slot";
    public static readonly (string Mode, int Slot)[] BridgeFollowTargets =
    {
        (BridgeFollowLeader, 0), (BridgeFollowSlot, 1), (BridgeFollowSlot, 2), (BridgeFollowSlot, 3), (BridgeFollowSlot, 4),
        (BridgeFollowNearest, 0), (BridgeFollowSelected, 0),
    };
    /// <summary>Banner slot choices for follow: 0 = try every banner, else the leader's party slot.</summary>
    public static readonly int[] BridgeFollowBannerSlots = { 0, 1, 2, 3, 4 };
    /// <summary>Banner of party slot 1 = the party leader (who formed the party).</summary>
    public const int BridgeFollowLeaderSlot = 1;
    public const string BridgeSalvageNormal = "normal";
    public const string BridgeSalvageMagic = "magic";
    public const string BridgeSalvageRare = "rare";
    /// <summary>Plugin InventorySlot names of the non-equipped item locations.</summary>
    public const string BridgeSlotBackpack = "Backpack";
    public const string BridgeSlotStash = "Stash";
    /// <summary>
    /// ROSBOT's InventorySlot enum is one behind the live game for the vendor locations: vendor stock (e.g. Kadala's gamble items)
    /// prints as Socketed, gems inside sockets as InSocket; both are not the hero's items and are hidden.
    /// </summary>
    public static readonly HashSet<string> BridgeHiddenSlots = new(StringComparer.Ordinal) { "Socketed", "InSocket", "Merchant" };
    /// <summary>Equipped potion locations as published (Gold / 17 in this D3 version).</summary>
    public static readonly HashSet<string> BridgePotionSlots = new(StringComparer.Ordinal) { "Gold", "17" };

    /// <summary>Town NPCs reachable from the NPC tab: exact actor name (shortcut actors such as PT_Blacksmith_RepairShortcut excluded) and label key.</summary>
    public static readonly (string ActorName, string LabelKey)[] BridgeTownNpcs =
    {
        ("PT_Blacksmith", I18nKeys.RosbotBridgeNpcBlacksmith),
        ("PT_Jeweler", I18nKeys.RosbotBridgeNpcJeweler),
        ("PT_Mystic", I18nKeys.RosbotBridgeNpcMystic),
        ("X1_RandomItemNPC", I18nKeys.RosbotBridgeNpcKadala),
        ("KanaiCube_Stand", I18nKeys.RosbotBridgeNpcKanai),
    };
    public const string BridgeBundledDir = "tools\\rosbot-plugins\\CoreNodeBridge";
    public const string BridgeAreaNamesFileName = "rosbot_area_names.json";
}
