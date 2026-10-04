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
}
