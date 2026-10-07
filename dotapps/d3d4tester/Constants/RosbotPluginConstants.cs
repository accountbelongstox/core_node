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
    public const string RosbotProcessName = "RoS-BoT";
    public const string BridgeDllName = "CoreNodeBridge.dll";
    public const string BridgeStateFileName = "state.json";
    public const string BridgeCommandFileName = "command.txt";
    public const string BridgeFilterFileName = "pickup_filter.txt";
    /// <summary>Items / affix attributes the plugin reads (same name as CoreNodeBridge ItemWatch.FileName; the plugin cannot reference the app).</summary>
    public const string BridgeItemWatchFileName = "item_watch.txt";
    public const string BridgeActionMoveTo = "move_to";
    public const string BridgeActionInteract = "interact";
    public const string BridgeActionPickup = "pickup";
    public const string BridgeActionPickupFilter = "pickup_filter";
    public const string BridgeActionClickUi = "click_ui";
    public const string BridgeActionGoNpc = "go_npc";
    public const string BridgeActionSalvageAll = "salvage_all";
    public const string BridgeSalvageNormal = "normal";
    public const string BridgeSalvageMagic = "magic";
    public const string BridgeSalvageRare = "rare";
    /// <summary>Plugin InventorySlot names of the non-equipped item locations.</summary>
    public const string BridgeSlotBackpack = "Backpack";
    public const string BridgeSlotStash = "Stash";

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
    /// <summary>state.json older than this means the plugin is not running (disabled in ROSBOT, or ROSBOT stopped).</summary>
    public const int BridgeStaleSec = 5;
}
