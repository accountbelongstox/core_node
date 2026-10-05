// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Monitor;

/// <summary>ROSBOT logs.txt markers used by the monitor (RBAssist $LOGSTRDEATH, $LOGSTRFAIL, $APORTALKEYS and main-loop literals).</summary>
public static class RosbotLogMarkers
{
    /// <summary>Lines are deduplicated by this timestamp prefix length ("yyyy-MM-dd HH:mm:ss").</summary>
    public const int TimestampPrefixLength = 19;

    public static readonly string[] Death =
    {
        "WARN : Dead", "WARN : Resurect", "INFO - Dead", "INFO - Resurect", "INFO - Armor is red and you're dead, exit game"
    };

    public static readonly string[] Fail =
    {
        "WARN : Run Rift failed", "WARN : Run failed", "WARN : Runstep failed, moving to next run", "INFO - Runstep failed, moving to next run",
        "Scrolling UIs lost. RunFailed", "INFO - Run failed", "failed, go to next Run", "run was not successfull", "> 100"
    };

    public const string NewRun = "INFO - Running";

    public static readonly string[] PortalKeys = { "x1_Heaven_PandemoniumPortal", "g_Portal_Square_Blue" };
    public const string PortalPause = "take portal but actionfound";
    public const string PortalResume = "move to portal success";
    public static readonly string[] PortalEnd = { "Take portal ended", "fighting with warden", "Town portal" };

    public const string ShrineInfinite = "x1_LR_Shrine_Infinite_Casting";
    public const string ShrineSpeed = "x1_LR_Shrine_Run_Speed";
    public static readonly string[] BuffReset = { "Vendor loop done", "Open Greater Rift Success" };

    /// <summary>RosBotGlobalSettings.ini key and the value that disables logs.txt.</summary>
    public const string DebugLevelKey = "DebugLevel";
    public const string DebugLevelNoLogs = "NoLogs";
}
