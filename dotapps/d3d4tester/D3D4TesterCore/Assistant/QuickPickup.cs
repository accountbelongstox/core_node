// PY-REF: pyapps/d3-check/utils/_obsolete_d3keyhelper.ahk (lootHelper)
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.Assistant;

/// <summary>
/// Quick pickup: cursor near the character (window center) -> left-click repeatedly to pick up items; elsewhere -> one click (D3KeyHelper lootHelper).
/// </summary>
public static class QuickPickup
{
    private const int Clicks = 30;
    private const double ReferenceHeight = 1440.0;
    private const double NearHalfWidthAtReference = 600.0;
    private const double NearHalfHeightAtReference = 500.0;
    private const string LogTag = "[QuickPickup]";

    public static bool Run(int helperDelayMs, Func<bool> shouldStop)
    {
        var shared = GameInterfaceData.Instance;
        var (ox, oy) = shared.WindowOffset;
        var (w, h) = shared.GameWindowSize;
        if (w <= 0 || h <= 0 || !ClickHandler.TryGetCursorPos(out int x, out int y))
        {
            ColorPrinter.Yellow($"{LogTag} No game window size or cursor");
            return false;
        }
        double scale = h / ReferenceHeight;
        bool nearCharacter = Math.Abs(x - ox - w / 2.0) < NearHalfWidthAtReference * scale
                             && Math.Abs(y - oy - h / 2.0) < NearHalfHeightAtReference * scale;
        int clicks = nearCharacter ? Clicks : 1;
        ColorPrinter.Blue($"{LogTag} {(nearCharacter ? "near character" : "away from character")}: {clicks} left clicks");
        int done = 0;
        for (; done < clicks; done++)
        {
            if (shouldStop()) break;
            ClickHandler.MouseButtonDown(MouseButton.Left);
            ClickHandler.MouseButtonUp(MouseButton.Left);
            Thread.Sleep(Math.Max(1, helperDelayMs / 2));
        }
        return done > 0;
    }
}
