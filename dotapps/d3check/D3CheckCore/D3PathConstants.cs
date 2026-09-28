namespace DotApps.d3check.Core;

/// <summary>
/// Path scan and ROSBOT constants aligned with Python providor.constants.common and providor.constants.d3.
/// </summary>
public static class D3PathConstants
{
    public const string BattleNetExeName = "Battle.net.exe";
    public const string DiabloIIIExeName = "Diablo III.exe";
    public static readonly string[] RosbotExePatterns = { "ros-bot*.exe", "RoS-BoT*.exe" };
    public const int PathScanMaxDepth = 6;

    /// <summary>Base directory for ROSBOT update convention: GameTools\{Asia|CN}_{version}\RosBot. 1:1 Python ROSBOT_GAMETOOLS_BASE.</summary>
    public const string RosbotGameToolsBase = @"D:\applications\GameTools";

    public const string RosbotDirNamespaceAsia = "Asia";
    public const string RosbotDirNamespaceCn = "CN";
    public const string RosbotFinalDirName = "RosBot";
    public const int RosbotZipMinSizeMb = 20;
    public const int RosbotZipMaxSizeMb = 50;
    public static readonly string[] RosbotZipKeywordsAsia = { "亚服", "asia", "Asia", "国际服", "global", "Global" };
    public static readonly string[] RosbotZipKeywordsCn = { "国服", "cn", "CN" };
}
