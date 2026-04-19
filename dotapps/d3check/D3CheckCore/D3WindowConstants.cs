namespace DotApps.d3check.Core;

/// <summary>
/// D3 window title and exe constants. 1:1 with Python DIABLO_III_WINDOW_TITLES and DIABLO_III_EXE_NAME (providor.constants.d3).
/// Single source for D3 window finder; do not duplicate in app code.
/// </summary>
public static class D3WindowConstants
{
    /// <summary>Process exe name for Diablo III. 1:1 Python DIABLO_III_EXE_NAME. Same as D3PathConstants.DiabloIIIExeName.</summary>
    public const string DiabloIIIExeName = "Diablo III.exe";

    /// <summary>Window titles that identify D3 (match_mode "in" = title contains any). 1:1 Python DIABLO_III_WINDOW_TITLES.</summary>
    public static readonly string[] DiabloIIIWindowTitles =
    {
        "Diablo III",
        "暗黑破坏神III",
        "暗黑破壞神III",
        "Diablo III - Blizzard Entertainment",
        "暗黑破坏神III - 暴雪娱乐",
        "暗黑破壞神III - 暴雪娛樂",
        "Diablo III (32-bit)",
        "Diablo III (64-bit)",
        "暗黑破坏神III (32位)",
        "暗黑破坏神III (64位)",
        "暗黑破壞神III (32位)",
        "暗黑破壞神III (64位)",
        "III"
    };
}
