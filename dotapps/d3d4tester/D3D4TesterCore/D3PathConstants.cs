// PY-REF: pyapps/d3-check/providor/constants/common.py
// PY-REF: pyapps/d3-check/providor/constants/d3.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Path scan and ROSBOT constants aligned with Python providor.constants.common and providor.constants.d3.
/// </summary>
public static class D3PathConstants
{
    public const string DiabloIIIExeName = "Diablo III.exe";
    public static readonly string[] RosbotExePatterns = { "ros-bot*.exe", "RoS-BoT*.exe" };
    public const int PathScanMaxDepth = 6;

    /// <summary>Debug output folders (1:1 Python pytools/tmp and .cache) shared by every debug dump.</summary>
    public const string PytoolsDirName = "pytools";
    public const string TmpDirName = "tmp";
    public const string CacheDirName = ".cache";
    /// <summary>Timestamps in debug / export file names (seconds, milliseconds).</summary>
    public const string FileTimestampFormat = "yyyyMMdd_HHmmss";
    public const string FileTimestampMsFormat = "yyyyMMdd_HHmmss_fff";

    /// <summary>Fallback GameTools folder for ROSBOT updates when no ROSBOT path is set (normally it follows the scanned ROSBOT, see RosbotGameToolsLayout).</summary>
    public const string RosbotGameToolsBase = @"E:\applications\GameTools";

    public const string RosbotDirNamespaceAsia = "Asia";
    public const string RosbotDirNamespaceCn = "CN";
    public const string RosbotDirKeywordAsiaCjk = "亚服";
    public const string RosbotDirKeywordAsiaEn = "Asia";
    public const string RosbotDirKeywordCnCjk = "国服";
    public const string RosbotFinalDirName = "RosBot";
    public const int RosbotZipMinSizeMb = 20;
    public const int RosbotZipMaxSizeMb = 50;
    public static readonly string[] RosbotZipKeywordsAsia = { "亚服", "asia", "Asia", "国际服", "global", "Global" };
    public static readonly string[] RosbotZipKeywordsCn = { "国服", "cn", "CN" };
}
