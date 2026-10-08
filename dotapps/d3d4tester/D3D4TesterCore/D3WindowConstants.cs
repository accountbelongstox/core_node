// PY-REF: pyapps/d3-check/providor/constants/d3.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// D3 window title and exe constants. 1:1 with Python DIABLO_III_WINDOW_TITLES and DIABLO_III_EXE_NAME (providor.constants.d3).
/// Single source for D3 window finder; do not duplicate in app code.
/// </summary>
public static class D3WindowConstants
{
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

    /// <summary>Window class of the D3 client main window (RBAssist lookup): the primary, title-independent way to find D3.</summary>
    public const string DiabloIIIWindowClass = "D3 Main Window Class";

    /// <summary>A D3 window this tall (pixels) is a real game window, not a splash / loading stub (RBAssist ready check).</summary>
    public const int ReadyMinHeight = 500;

    /// <summary>Patch prompt shown while D3 starts; dismissed with Escape (RBAssist).</summary>
    public const string NewVersionPopupTitle = "New version";

    /// <summary>D3 client process names (64-bit client first): a running one means a launch is already in progress.</summary>
    public static readonly string[] DiabloIIIProcessNames = { "Diablo III64", "Diablo III" };
}
